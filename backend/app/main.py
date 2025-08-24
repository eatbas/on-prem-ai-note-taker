from __future__ import annotations

import os
import tempfile
import json
from typing import Any, Dict, List, Optional
import asyncio
import logging
import uuid
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from faster_whisper import WhisperModel

from .config import settings
from .ollama_client import OllamaClient
from .database import get_db, get_or_create_user, Meeting, Transcription, Summary, JobType, JobStatus, Job, User

from .queue_manager import queue_manager
from .job_manager import job_manager, JobPhase
from .progress import job_store, Phase  # Import new progress module
from .api import router as jobs_router  # Import the new jobs API router
from .chunked_service import chunked_service  # Import the new chunked service
from .prompts import get_chunk_prompt, get_merge_prompt  # Import prompts
from .utils import require_basic_auth, get_whisper_model, validate_language  # Import from utils to avoid circular import


app = FastAPI(title="On-Prem AI Note Taker", version="0.1.0")

# Logging
_level = getattr(logging, settings.log_level.upper(), logging.INFO)
logging.basicConfig(level=_level)
logger = logging.getLogger("on_prem_note_taker")

# CORS
if settings.allowed_origins == ["*"]:
	allow_origins = ["*"]
else:
	allow_origins = settings.allowed_origins

app.add_middleware(
	CORSMiddleware,
	allow_origins=allow_origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# Include the jobs API router
app.include_router(jobs_router)


class TranscriptionSegment(BaseModel):
	start: float
	end: float
	text: str


class TranscriptionResponse(BaseModel):
	language: Optional[str]
	duration: Optional[float]
	text: str
	segments: List[TranscriptionSegment]


class SummarizeRequest(BaseModel):
	text: str
	model: Optional[str] = None


class SummarizeResponse(BaseModel):
	summary: str


class TranscribeAndSummarizeResponse(BaseModel):
	transcript: TranscriptionResponse
	summary: str


# New job-related models
class JobSubmitRequest(BaseModel):
	job_type: str
	input_data: Dict[str, Any]


class JobSubmitResponse(BaseModel):
	job_id: str
	status: str
	message: str


class JobStatusResponse(BaseModel):
	id: str
	type: str
	status: str
	progress_percent: float
	current_phase: str
	phase_progress: float
	estimated_remaining_seconds: Optional[float]
	created_at: Optional[str]
	started_at: Optional[str]
	completed_at: Optional[str]
	result_data: Optional[Dict[str, Any]]
	error_message: Optional[str]


class JobCancelResponse(BaseModel):
	job_id: str
	cancelled: bool
	message: str


_whisper_model: Optional[WhisperModel] = None
_transcribe_semaphore: Optional[asyncio.Semaphore] = None
_ollama_client = OllamaClient(
	base_url=settings.ollama_base_url,
	default_model=settings.ollama_model,
	timeout_seconds=settings.ollama_timeout_seconds,
)


# Task handlers for the queue system
async def handle_transcription_task(data: Dict[str, Any]) -> Dict[str, Any]:
	"""Handle transcription task from queue"""
	# This is a simplified version - in a real implementation, you'd need to
	# handle file storage and retrieval from the queue data
	# For now, we'll just return a placeholder
	return {"status": "transcription_completed", "text": "Queued transcription result"}


async def handle_summarization_task(data: Dict[str, Any]) -> Dict[str, Any]:
	"""Handle summarization task from queue"""
	text = data.get("text", "")
	model = data.get("model")
	
	summary = _ollama_client.summarize(text, model=model)
	return {"summary": summary}


async def handle_transcribe_and_summarize_task(data: Dict[str, Any]) -> Dict[str, Any]:
	"""Handle combined transcription and summarization task from queue"""
	# This would need to be implemented with proper file handling
	return {"status": "transcribe_and_summarize_completed"}


@app.on_event("startup")
async def startup_event():
	"""Initialize queue manager and register handlers"""
	if settings.use_queue_system:
		# Configure queue manager
		queue_manager.redis_url = settings.redis_url
		queue_manager.max_workers = settings.queue_max_workers
		
		# Register task handlers
		queue_manager.register_handler("transcription", handle_transcription_task)
		queue_manager.register_handler("summarization", handle_summarization_task)
		queue_manager.register_handler("transcribe_and_summarize", handle_transcribe_and_summarize_task)
		
		# Initialize queue manager
		await queue_manager.initialize()
		logger.info("Queue management system initialized")
	
	# Initialize job manager and register handlers
	job_manager.register_handler(JobType.TRANSCRIPTION, handle_transcription_job)
	job_manager.register_handler(JobType.SUMMARIZATION, handle_summarization_job)
	job_manager.register_handler(JobType.TRANSCRIBE_AND_SUMMARIZE, handle_transcribe_and_summarize_job)
	logger.info("Job management system initialized")


@app.on_event("shutdown")
async def shutdown_event():
	"""Cleanup queue manager and job manager"""
	if settings.use_queue_system:
		await queue_manager.stop_workers()
		logger.info("Queue management system stopped")
	
	# Cleanup job manager
	await job_manager.cleanup_completed_jobs()
	logger.info("Job management system stopped")


# get_whisper_model function moved to utils.py to avoid circular import


def get_transcribe_semaphore() -> asyncio.Semaphore:
	global _transcribe_semaphore
	if _transcribe_semaphore is None:
		_concurrency = max(1, settings.max_concurrency)
		_transcribe_semaphore = asyncio.Semaphore(_concurrency)
	return _transcribe_semaphore


# validate_language function moved to utils.py to avoid circular import


@app.get("/api/health")
def health() -> Dict[str, Any]:
	return {
		"status": "ok",
		"whisper_model": settings.whisper_model_name,
		"ollama_model": settings.ollama_model,
		"allowed_languages": settings.allowed_languages,
		"vps_optimizations": {
			"whisper_device": settings.whisper_device,
			"whisper_cpu_threads": settings.whisper_cpu_threads,
			"ollama_cpu_threads": settings.ollama_cpu_threads
		}
	}


@app.get("/api/vps/health")
def vps_health() -> Dict[str, Any]:
    """Return connectivity status for remote Ollama VPS."""
    ollama = _ollama_client.check_health()
    return {"ollama": ollama, "base_url": settings.ollama_base_url}


@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe(
	file: UploadFile = File(...),
	language: Optional[str] = Form(default=None),
	vad_filter: bool = Form(default=True),
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> TranscriptionResponse:
	sem = get_transcribe_semaphore()
	model = get_whisper_model()

	async with sem:
		# Read and validate size
		content = await file.read()
		size_mb = len(content) / (1024 * 1024)
		if size_mb > settings.max_upload_mb:
			raise HTTPException(status_code=413, detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB")
		
		# Validate language
		validated_language = validate_language(language)
		logger.info("Transcribe request: filename=%s size_mb=%.2f lang=%s validated_lang=%s user=%s", 
			file.filename, size_mb, language, validated_language, x_user_id)

		# Save to a temp file for faster-whisper consumption
		with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "audio")[1]) as tmp:
			tmp.write(content)
			tmp_path = tmp.name

		segments_out: List[TranscriptionSegment] = []
		text_parts: List[str] = []
		language_out: Optional[str] = None
		duration_out: Optional[float] = None

		try:
			# VPS-optimized transcription with better VAD settings
			segments, info = model.transcribe(
				tmp_path,
				language=validated_language if validated_language != "auto" else None,
				vad_filter=vad_filter,
				vad_parameters=dict(
					min_silence_duration_ms=500,
					speech_pad_ms=100
				),
				beam_size=1,  # Faster decoding for VPS
				best_of=1,   # Single pass for speed
				temperature=0.0,  # Deterministic output
				compression_ratio_threshold=2.4,  # VPS optimization
				log_prob_threshold=-1.0  # VPS optimization
			)
			language_out = info.language if hasattr(info, "language") else None
			duration_out = info.duration if hasattr(info, "duration") else None
			
			# Process segments efficiently
			for s in segments:
				text_cleaned = s.text.strip()
				if text_cleaned:  # Skip empty segments
					segments_out.append(
						TranscriptionSegment(start=float(s.start), end=float(s.end), text=text_cleaned)
					)
					text_parts.append(text_cleaned)
			
			logger.info(f"Transcription completed: {len(segments_out)} segments, language: {language_out}, duration: {duration_out:.2f}s")
			
		finally:
			try:
				os.remove(tmp_path)
			except OSError:
				pass

		return TranscriptionResponse(
			language=language_out,
			duration=duration_out,
			text="\n".join(text_parts).strip(),
			segments=segments_out,
		)


@app.post("/api/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest) -> SummarizeResponse:
	summary_text = _ollama_client.summarize(req.text, model=req.model)
	return SummarizeResponse(summary=summary_text)


class ChatRequest(BaseModel):
	prompt: str
	model: Optional[str] = None


class ChatResponse(BaseModel):
	response: str


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
	"""Ask Llama any question"""
	logger.info(f"Chat request received: prompt_length={len(req.prompt)}, model={req.model}")
	try:
		response_text = _ollama_client.generate(req.prompt, model=req.model)
		logger.info(f"Chat response generated: response_length={len(response_text)}")
		return ChatResponse(response=response_text)
	except Exception as e:
		logger.error(f"Chat request failed: {str(e)}")
		raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")


@app.post("/api/transcribe-and-summarize", response_model=TranscribeAndSummarizeResponse)
async def transcribe_and_summarize(
	file: UploadFile = File(...),
	language: Optional[str] = Form(default=None),
	vad_filter: bool = Form(default=True),
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> TranscribeAndSummarizeResponse:
	sem = get_transcribe_semaphore()
	async with sem:
		# Get or create user
		user = get_or_create_user(db)
		
		# Create meeting record
		meeting_id = str(uuid.uuid4())
		meeting = Meeting(
			id=meeting_id,
			user_id=user.id,
			title=f"Meeting {meeting_id[:8]}",  # Default title
		)
		db.add(meeting)
		
		# Transcribe
		transcript = await transcribe(file=file, language=language, vad_filter=vad_filter, x_user_id=x_user_id)  # type: ignore[arg-type]
		
		# Save transcription to database
		transcription = Transcription(
			meeting_id=meeting_id,
			text=transcript.text,
			language=transcript.language,
		)
		db.add(transcription)
		
		# Update meeting duration if available
		if transcript.duration:
			meeting.duration = transcript.duration
		
		# Summarize
		summary = _ollama_client.summarize(transcript.text)
		
		# Save summary to database
		summary_obj = Summary(
			meeting_id=meeting_id,
			summary_text=summary,
			model_used=settings.ollama_model,
		)
		db.add(summary_obj)
		
		# Commit all changes
		db.commit()
		
		return TranscribeAndSummarizeResponse(transcript=transcript, summary=summary)


class MeetingResponse(BaseModel):
	id: str
	title: str
	created_at: str
	updated_at: str
	transcription: Optional[str]
	summary: Optional[str]
	duration: Optional[float]
	tags: Optional[List[str]] = []


@app.get("/api/meetings")
async def list_meetings(
	search: Optional[str] = Query(None, description="Search in title, summary, and transcript"),
	tag: Optional[str] = Query(None, description="Filter by tag"),
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> List[MeetingResponse]:
	"""List all meetings for the current user with optional search and tag filtering"""
	user = get_or_create_user(db)
	
	query = db.query(Meeting).filter(Meeting.user_id == user.id)
	
	# Apply tag filter
	if tag:
		query = query.filter(Meeting.tags.like(f'%"{tag}"%'))
	
	# Apply search filter
	if search:
		search_term = f"%{search}%"
		# Search in meeting title
		meeting_filter = Meeting.title.like(search_term)
		
		# Also search in transcriptions and summaries
		transcription_subquery = db.query(Transcription.meeting_id).filter(
			Transcription.text.like(search_term)
		).subquery()
		
		summary_subquery = db.query(Summary.meeting_id).filter(
			Summary.summary_text.like(search_term)
		).subquery()
		
		query = query.filter(or_(
			meeting_filter,
			Meeting.id.in_(transcription_subquery),
			Meeting.id.in_(summary_subquery)
		))
	
	meetings = query.order_by(Meeting.created_at.desc()).all()
	
	response = []
	for meeting in meetings:
		# Get first transcription and summary
		transcription = db.query(Transcription).filter(
			Transcription.meeting_id == meeting.id
		).first()
		
		summary = db.query(Summary).filter(
			Summary.meeting_id == meeting.id
		).first()
		
		# Parse tags from JSON string
		tags = []
		if meeting.tags:
			try:
				tags = json.loads(meeting.tags)
			except (json.JSONDecodeError, TypeError):
				tags = []
		
		response.append(MeetingResponse(
			id=meeting.id,
			title=meeting.title,
			created_at=meeting.created_at.isoformat(),
			updated_at=meeting.updated_at.isoformat(),
			transcription=transcription.text if transcription else None,
			summary=summary.summary_text if summary else None,
			duration=meeting.duration,
			tags=tags,
		))
	
	return response


@app.get("/api/meetings/{meeting_id}")
async def get_meeting(
	meeting_id: str,
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> MeetingResponse:
	"""Get a specific meeting by ID"""
	user = get_or_create_user(db)
	
	meeting = db.query(Meeting).filter(
		Meeting.id == meeting_id,
		Meeting.user_id == user.id
	).first()
	
	if not meeting:
		raise HTTPException(status_code=404, detail="Meeting not found")
	
	transcription = db.query(Transcription).filter(
		Transcription.meeting_id == meeting.id
	).first()
	
	summary = db.query(Summary).filter(
		Summary.meeting_id == meeting.id
	).first()
	
	# Parse tags from JSON string
	tags = []
	if meeting.tags:
		try:
			tags = json.loads(meeting.tags)
		except (json.JSONDecodeError, TypeError):
			tags = []
	
	return MeetingResponse(
		id=meeting.id,
		title=meeting.title,
		created_at=meeting.created_at.isoformat(),
		updated_at=meeting.updated_at.isoformat(),
		transcription=transcription.text if transcription else None,
		summary=summary.summary_text if summary else None,
		duration=meeting.duration,
		tags=tags,
	)


class UpdateMeetingRequest(BaseModel):
	title: Optional[str] = None
	tags: Optional[List[str]] = None


@app.put("/api/meetings/{meeting_id}")
async def update_meeting(
	meeting_id: str,
	title: Optional[str] = Form(None),
	tags: Optional[str] = Form(None, description="JSON array of tags"),
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> MeetingResponse:
	"""Update meeting title and/or tags"""
	user = get_or_create_user(db)
	
	meeting = db.query(Meeting).filter(
		Meeting.id == meeting_id,
		Meeting.user_id == user.id
	).first()
	
	if not meeting:
		raise HTTPException(status_code=404, detail="Meeting not found")
	
	# Update title if provided
	if title is not None:
		meeting.title = title
	
	# Update tags if provided
	if tags is not None:
		try:
			# Parse tags from JSON string or handle direct array
			if isinstance(tags, str):
				parsed_tags = json.loads(tags) if tags else []
			else:
				parsed_tags = tags
			meeting.tags = json.dumps(parsed_tags)
		except (json.JSONDecodeError, TypeError):
			raise HTTPException(status_code=400, detail="Invalid tags format")
	
	db.commit()
	
	return await get_meeting(meeting_id, _auth, db)


@app.put("/api/meetings/{meeting_id}/tags")
async def update_meeting_tags(
	meeting_id: str,
	request: UpdateMeetingRequest,
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> MeetingResponse:
	"""Update meeting tags only"""
	user = get_or_create_user(db)
	
	meeting = db.query(Meeting).filter(
		Meeting.id == meeting_id,
		Meeting.user_id == user.id
	).first()
	
	if not meeting:
		raise HTTPException(status_code=404, detail="Meeting not found")
	
	if request.tags is not None:
		meeting.tags = json.dumps(request.tags)
		db.commit()
	
	return await get_meeting(meeting_id, _auth, db)


@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(
	meeting_id: str,
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> Dict[str, str]:
	"""Delete a meeting and all associated data"""
	user = get_or_create_user(db)
	
	meeting = db.query(Meeting).filter(
		Meeting.id == meeting_id,
		Meeting.user_id == user.id
	).first()
	
	if not meeting:
		raise HTTPException(status_code=404, detail="Meeting not found")
	
	# Delete the meeting (cascading will handle related records)
	db.delete(meeting)
	db.commit()
	
	return {"message": "Meeting deleted successfully"}


@app.get("/api/tags")
async def get_all_tags(
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> Dict[str, int]:
	"""Get all available tags with their usage counts"""
	user = get_or_create_user(db)
	
	meetings = db.query(Meeting).filter(
		Meeting.user_id == user.id,
		Meeting.tags.isnot(None)
	).all()
	
	tag_counts = {}
	for meeting in meetings:
		try:
			tags = json.loads(meeting.tags) if meeting.tags else []
			for tag in tags:
				tag_counts[tag] = tag_counts.get(tag, 0) + 1
		except (json.JSONDecodeError, TypeError):
			continue
	
	return tag_counts


# Admin endpoints for VPS management
class AdminUserResponse(BaseModel):
	id: str
	username: str
	created_at: str
	meeting_count: int


class AdminMeetingResponse(BaseModel):
	id: str
	user_id: str
	username: str
	title: str
	created_at: str
	updated_at: str
	duration: Optional[float]
	has_transcription: bool
	has_summary: bool
	tags: Optional[List[str]] = []


def require_admin_auth(credentials: HTTPBasicCredentials = Depends(require_basic_auth)) -> None:
	"""Enforce admin authentication - uses same basic auth but could be extended"""
	# This function now just calls require_basic_auth from utils
	# The actual auth logic is handled there
	pass


@app.get("/api/admin/users")
async def admin_list_users(
	_auth: None = Depends(require_admin_auth),
	db: Session = Depends(get_db),
) -> List[AdminUserResponse]:
	"""Admin: List all users with meeting counts"""
	users = db.query(User).all()
	
	response = []
	for user in users:
		meeting_count = db.query(Meeting).filter(Meeting.user_id == user.id).count()
		response.append(AdminUserResponse(
			id=user.id,
			username=user.username,
			created_at=user.created_at.isoformat(),
			meeting_count=meeting_count,
		))
	
	return response


@app.get("/api/admin/meetings")
async def admin_list_meetings(
	user_id: Optional[str] = Query(None, description="Filter by user ID"),
	search: Optional[str] = Query(None, description="Search in title, summary, transcript"),
	limit: int = Query(50, description="Maximum number of meetings to return"),
	offset: int = Query(0, description="Number of meetings to skip"),
	_auth: None = Depends(require_admin_auth),
	db: Session = Depends(get_db),
) -> Dict[str, Any]:
	"""Admin: List all meetings across all users"""
	query = db.query(Meeting)
	
	# Apply user filter
	if user_id:
		query = query.filter(Meeting.user_id == user_id)
	
	# Apply search filter
	if search:
		search_term = f"%{search}%"
		meeting_filter = Meeting.title.like(search_term)
		
		transcription_subquery = db.query(Transcription.meeting_id).filter(
			Transcription.text.like(search_term)
		).subquery()
		
		summary_subquery = db.query(Summary.meeting_id).filter(
			Summary.summary_text.like(search_term)
		).subquery()
		
		query = query.filter(or_(
			meeting_filter,
			Meeting.id.in_(transcription_subquery),
			Meeting.id.in_(summary_subquery)
		))
	
	# Get total count for pagination
	total_count = query.count()
	
	# Apply pagination
	meetings = query.order_by(Meeting.created_at.desc()).offset(offset).limit(limit).all()
	
	response_meetings = []
	for meeting in meetings:
		# Get user info
		user = db.query(User).filter(User.id == meeting.user_id).first()
		
		# Check if transcription and summary exist
		has_transcription = db.query(Transcription).filter(Transcription.meeting_id == meeting.id).first() is not None
		has_summary = db.query(Summary).filter(Summary.meeting_id == meeting.id).first() is not None
		
		# Parse tags
		tags = []
		if meeting.tags:
			try:
				tags = json.loads(meeting.tags)
			except (json.JSONDecodeError, TypeError):
				tags = []
		
		response_meetings.append(AdminMeetingResponse(
			id=meeting.id,
			user_id=meeting.user_id,
			username=user.username if user else "Unknown",
			title=meeting.title,
			created_at=meeting.created_at.isoformat(),
			updated_at=meeting.updated_at.isoformat(),
			duration=meeting.duration,
			has_transcription=has_transcription,
			has_summary=has_summary,
			tags=tags,
		))
	
	return {
		"meetings": response_meetings,
		"total_count": total_count,
		"offset": offset,
		"limit": limit,
		"has_more": offset + len(response_meetings) < total_count
	}


@app.delete("/api/admin/meetings/{meeting_id}")
async def admin_delete_meeting(
	meeting_id: str,
	_auth: None = Depends(require_admin_auth),
	db: Session = Depends(get_db),
) -> Dict[str, str]:
	"""Admin: Delete any meeting"""
	meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
	
	if not meeting:
		raise HTTPException(status_code=404, detail="Meeting not found")
	
	db.delete(meeting)
	db.commit()
	
	return {"message": "Meeting deleted successfully"}


@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(
	user_id: str,
	_auth: None = Depends(require_admin_auth),
	db: Session = Depends(get_db),
) -> Dict[str, str]:
	"""Admin: Delete user and all their meetings"""
	user = db.query(User).filter(User.id == user_id).first()
	
	if not user:
		raise HTTPException(status_code=404, detail="User not found")
	
	# Delete all meetings for this user (cascading will handle related data)
	meetings = db.query(Meeting).filter(Meeting.user_id == user_id).all()
	for meeting in meetings:
		db.delete(meeting)
	
	# Delete the user
	db.delete(user)
	db.commit()
	
	return {"message": f"User {user.username} and all their data deleted successfully"}


@app.get("/api/admin/stats")
async def admin_get_stats(
	_auth: None = Depends(require_admin_auth),
	db: Session = Depends(get_db),
) -> Dict[str, Any]:
	"""Admin: Get system statistics"""
	total_users = db.query(User).count()
	total_meetings = db.query(Meeting).count()
	total_transcriptions = db.query(Transcription).count()
	total_summaries = db.query(Summary).count()
	
	# Recent activity (last 7 days)
	from datetime import datetime, timedelta
	week_ago = datetime.utcnow() - timedelta(days=7)
	recent_meetings = db.query(Meeting).filter(Meeting.created_at >= week_ago).count()
	
	# Average meeting duration
	avg_duration = db.query(func.avg(Meeting.duration)).filter(Meeting.duration.isnot(None)).scalar() or 0
	
	# Top tags
	meetings_with_tags = db.query(Meeting).filter(Meeting.tags.isnot(None)).all()
	tag_counts = {}
	for meeting in meetings_with_tags:
		try:
			tags = json.loads(meeting.tags) if meeting.tags else []
			for tag in tags:
				tag_counts[tag] = tag_counts.get(tag, 0) + 1
		except (json.JSONDecodeError, TypeError):
			continue
	
	top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
	
	return {
		"total_users": total_users,
		"total_meetings": total_meetings,
		"total_transcriptions": total_transcriptions,
		"total_summaries": total_summaries,
		"recent_meetings_7d": recent_meetings,
		"average_meeting_duration_minutes": round(avg_duration / 60, 2) if avg_duration else 0,
		"top_tags": top_tags,
		"system_info": {
			"whisper_model": settings.whisper_model_name,
			"ollama_model": settings.ollama_model,
			"ollama_base_url": settings.ollama_base_url,
		}
	}


# Queue management endpoints
@app.post("/api/queue/transcribe")
async def queue_transcribe_task(
	file: UploadFile = File(...),
	language: Optional[str] = Form(default=None),
	vad_filter: bool = Form(default=True),
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> Dict[str, str]:
	"""Queue a transcription task for processing"""
	if not settings.use_queue_system:
		raise HTTPException(status_code=503, detail="Queue system not available")
	
	# Read and validate file
	content = await file.read()
	size_mb = len(content) / (1024 * 1024)
	if size_mb > settings.max_upload_mb:
		raise HTTPException(status_code=413, detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB")
	
	# Store file temporarily (in a real implementation, you'd save to a shared storage)
	task_data = {
		"file_content": content.hex(),  # Store as hex string
		"file_name": file.filename,
		"language": language,
		"vad_filter": vad_filter,
		"user_id": x_user_id
	}
	
	task_id = await queue_manager.enqueue_task(
		task_type="transcription",
		user_id=x_user_id or "anonymous",
		data=task_data,
		priority=1
	)
	
	return {"task_id": task_id, "status": "queued"}


@app.post("/api/queue/summarize")
async def queue_summarize_task(
	request: SummarizeRequest,
	_: None = Depends(require_basic_auth),
) -> Dict[str, str]:
	"""Queue a summarization task for processing"""
	if not settings.use_queue_system:
		raise HTTPException(status_code=503, detail="Queue system not available")
	
	task_data = {
		"text": request.text,
		"model": request.model
	}
	
	task_id = await queue_manager.enqueue_task(
		task_type="summarization",
		user_id="anonymous",  # Could be extracted from auth context
		data=task_data,
		priority=0
	)
	
	return {"task_id": task_id, "status": "queued"}


@app.get("/api/queue/task/{task_id}/status")
async def get_queue_task_status(
	task_id: str,
	_: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
	"""Get the status of a queued task"""
	if not settings.use_queue_system:
		raise HTTPException(status_code=503, detail="Queue system not available")
	
	status = await queue_manager.get_task_status(task_id)
	if not status:
		raise HTTPException(status_code=404, detail="Task not found")
	
	return status


@app.get("/api/queue/task/{task_id}/result")
async def get_queue_task_result(
	task_id: str,
	_: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
	"""Get the result of a completed queued task"""
	if not settings.use_queue_system:
		raise HTTPException(status_code=503, detail="Queue system not available")
	
	# Check if task is completed
	status = await queue_manager.get_task_status(task_id)
	if not status:
		raise HTTPException(status_code=404, detail="Task not found")
	
	if status.get("status") != "completed":
		raise HTTPException(status_code=202, detail=f"Task not completed, current status: {status.get('status')}")
	
	result = await queue_manager.get_task_result(task_id)
	if not result:
		raise HTTPException(status_code=404, detail="Task result not found")
	
	return result


@app.get("/api/admin/queue/stats")
async def admin_get_queue_stats(
	_auth: None = Depends(require_admin_auth),
) -> Dict[str, Any]:
	"""Admin: Get queue statistics"""
	if not settings.use_queue_system:
		return {"queue_enabled": False, "message": "Queue system not available"}
	
	stats = await queue_manager.get_queue_stats()
	
	return {
		"queue_enabled": True,
		"max_workers": queue_manager.max_workers,
		"redis_url": queue_manager.redis_url,
		"stats": stats
	}


# New Job Management APIs
@app.post("/api/jobs/submit", response_model=JobSubmitResponse)
async def submit_job(
	request: JobSubmitRequest,
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> JobSubmitResponse:
	"""Submit a new job for async processing"""
	if not x_user_id:
		raise HTTPException(status_code=400, detail="X-User-Id header required")
	
	try:
		job_type = JobType(request.job_type)
	except ValueError:
		raise HTTPException(status_code=400, detail=f"Invalid job type: {request.job_type}")
	
	job_id = await job_manager.submit_job(x_user_id, job_type, request.input_data)
	
	return JobSubmitResponse(
		job_id=job_id,
		status="submitted",
		message="Job submitted successfully"
	)


@app.get("/api/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
	job_id: str,
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> JobStatusResponse:
	"""Get the current status of a job"""
	if not x_user_id:
		raise HTTPException(status_code=400, detail="X-User-Id header required")
	
	status = await job_manager.get_job_status(job_id, x_user_id)
	if not status:
		raise HTTPException(status_code=404, detail="Job not found")
	
	return JobStatusResponse(**status)


@app.post("/api/jobs/{job_id}/cancel", response_model=JobCancelResponse)
async def cancel_job(
	job_id: str,
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> JobCancelResponse:
	"""Cancel a running job"""
	if not x_user_id:
		raise HTTPException(status_code=400, detail="X-User-Id header required")
	
	cancelled = await job_manager.cancel_job(job_id, x_user_id)
	
	return JobCancelResponse(
		job_id=job_id,
		cancelled=cancelled,
		message="Job cancelled successfully" if cancelled else "Job not found or already completed"
	)


@app.get("/api/jobs/{job_id}/stream")
async def stream_job_progress(
	job_id: str,
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	user_id: Optional[str] = Query(default=None, description="User ID for EventSource compatibility"),
	_: None = Depends(require_basic_auth),
):
	"""Stream job progress updates using Server-Sent Events (SSE)"""
	if not settings.enable_sse:
		raise HTTPException(status_code=503, detail="SSE not enabled")
	
	# Support both header and query parameter for user ID
	actual_user_id = x_user_id or user_id
	if not actual_user_id:
		raise HTTPException(status_code=400, detail="User ID required (either X-User-Id header or user_id query parameter)")
	
	async def event_stream():
		"""Stream progress events"""
		# Send initial status
		status = await job_manager.get_job_status(job_id, actual_user_id)
		if not status:
			yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
			return
		
		yield f"data: {json.dumps(status)}\n\n"
		
		# Subscribe to progress updates
		progress_queue = asyncio.Queue()
		
		def progress_callback(progress):
			asyncio.create_task(progress_queue.put(progress))
		
		job_manager.subscribe_to_progress(job_id, progress_callback)
		
		try:
			while True:
				try:
					# Wait for progress updates with timeout
					progress = await asyncio.wait_for(progress_queue.get(), timeout=30.0)
					yield f"data: {json.dumps(progress.__dict__)}\n\n"
					
					# Stop streaming if job is completed
					if progress.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
						break
						
				except asyncio.TimeoutError:
					# Send keepalive
					yield f": keepalive\n\n"
					
		finally:
			job_manager.unsubscribe_from_progress(job_id, progress_callback)
	
	return StreamingResponse(
		event_stream(),
		media_type="text/event-stream",
		headers={
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "*"
		}
	)


# New Progress Module APIs
@app.get("/api/progress/{job_id}")
async def get_progress_status(
	job_id: str,
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
	"""Get progress status using the new progress module"""
	if not x_user_id:
		raise HTTPException(status_code=400, detail="X-User-Id header required")
	
	job_status = job_store.get(job_id)
	if not job_status:
		raise HTTPException(status_code=404, detail="Job not found")
	
	return job_status.to_dict()


@app.post("/api/progress/{job_id}/cancel")
async def cancel_progress_job(
	job_id: str,
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
	_: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
	"""Cancel a job using the new progress module"""
	if not x_user_id:
		raise HTTPException(status_code=400, detail="X-User-Id header required")
	
	success = job_store.cancel(job_id)
	if not success:
		raise HTTPException(status_code=400, detail="Failed to cancel job")
	
	return {"job_id": job_id, "cancelled": True, "message": "Job cancelled successfully"}


@app.get("/api/progress/stats")
async def get_progress_stats(
	_auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
	"""Get progress store statistics"""
	return job_store.get_stats()


# Job Handler Functions
async def handle_transcription_job(job: Job, progress_tracker) -> Dict[str, Any]:
	"""Handle transcription job with progress tracking"""
	import tempfile
	import os
	
	input_data = json.loads(job.input_data)
	file_content = bytes.fromhex(input_data["file_content"])
	file_name = input_data["file_name"]
	language = input_data.get("language")
	vad_filter = input_data.get("vad_filter", True)
	
	# Validate language
	validated_language = validate_language(language)
	
	# Update progress
	progress_tracker.update_progress(10, JobPhase.INITIALIZING, 100, "Processing audio file")
	
	# Save to temp file
	with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as tmp:
		tmp.write(file_content)
		tmp_path = tmp.name
	
	try:
		# Get model
		model = get_whisper_model()
		progress_tracker.update_progress(20, JobPhase.TRANSCRIBING, 0, "Starting transcription")
		
		# Transcribe with progress updates
		segments, info = model.transcribe(
			tmp_path,
			language=validated_language if validated_language != "auto" else None,
			vad_filter=vad_filter,
			vad_parameters=dict(
				min_silence_duration_ms=500,
				speech_pad_ms=100
			),
			beam_size=1,
			best_of=1,
			temperature=0.0,
			compression_ratio_threshold=2.4,
			log_prob_threshold=-1.0
		)
		
		# Process segments with progress updates
		segments_out = []
		text_parts = []
		segment_count = 0
		
		for s in segments:
			text_cleaned = s.text.strip()
			if text_cleaned:
				segments_out.append({
					"start": float(s.start),
					"end": float(s.end),
					"text": text_cleaned
				})
				text_parts.append(text_cleaned)
			
			segment_count += 1
			# Update progress every 10 segments
			if segment_count % 10 == 0:
				phase_progress = min(90, 20 + (segment_count * 70 / max(1, len(segments))))
				progress_tracker.update_progress(
					phase_progress, 
					JobPhase.TRANSCRIBING, 
					segment_count / max(1, len(segments)) * 100,
					f"Transcribed {segment_count} segments"
				)
		
		progress_tracker.update_progress(100, JobPhase.FINALIZING, 100, "Transcription completed")
		
		return {
			"language": info.language if hasattr(info, "language") else None,
			"duration": info.duration if hasattr(info, "duration") else None,
			"text": "\n".join(text_parts).strip(),
			"segments": segments_out
		}
		
	finally:
		try:
			os.remove(tmp_path)
		except OSError:
			pass


async def handle_summarization_job(job: Job, progress_tracker) -> Dict[str, Any]:
	"""Handle summarization job with progress tracking"""
	input_data = json.loads(job.input_data)
	text = input_data["text"]
	model = input_data.get("model")
	
	progress_tracker.update_progress(10, JobPhase.INITIALIZING, 100, "Preparing summarization")
	
	progress_tracker.update_progress(50, JobPhase.SUMMARIZING, 0, "Generating summary")
	
	summary = _ollama_client.summarize(text, model=model)
	
	progress_tracker.update_progress(100, JobPhase.FINALIZING, 100, "Summary completed")
	
	return {"summary": summary}


async def handle_transcribe_and_summarize_job(job: Job, progress_tracker) -> Dict[str, Any]:
	"""Handle combined transcription and summarization job"""
	# First transcribe
	transcription_result = await handle_transcription_job(job, progress_tracker)
	
	# Then summarize
	progress_tracker.update_progress(80, JobPhase.SUMMARIZING, 0, "Generating summary from transcript")
	
	summary_result = await handle_summarization_job(job, progress_tracker)
	
	progress_tracker.update_progress(100, JobPhase.FINALIZING, 100, "Transcription and summarization completed")
	
	return {
		"transcript": transcription_result,
		"summary": summary_result["summary"]
	}


# New Meeting Management with Language Selection
class StartMeetingRequest(BaseModel):
    title: str
    language: str = "auto"  # "tr", "en", or "auto"
    tags: Optional[List[str]] = []


class StartMeetingResponse(BaseModel):
    meeting_id: str
    job_id: str
    message: str
    language: str


@app.post("/api/meetings/start", response_model=StartMeetingResponse)
async def start_meeting(
    request: StartMeetingRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> StartMeetingResponse:
    """Start a new meeting with language selection"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    # Validate language
    try:
        validated_language = validate_language(request.language)
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    
    # Get or create user
    user = get_or_create_user(db)
    
    # Create meeting record
    meeting_id = str(uuid.uuid4())
    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        title=request.title,
        tags=json.dumps(request.tags) if request.tags else None
    )
    db.add(meeting)
    db.commit()
    
    # Create job for processing
    job_id = f"meeting_{meeting_id[:8]}_{datetime.utcnow().strftime('%H%M%S')}"
    job_store.create(job_id, Phase.QUEUED)
    
    logger.info(f"Started meeting {meeting_id} with language {validated_language}")
    
    return StartMeetingResponse(
        meeting_id=meeting_id,
        job_id=job_id,
        message=f"Meeting '{request.title}' started successfully",
        language=validated_language
    )


@app.post("/api/meetings/{meeting_id}/upload-audio")
async def upload_meeting_audio(
    meeting_id: str,
    file: UploadFile = File(...),
    language: Optional[str] = Form(default="auto"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Upload audio for an existing meeting and start processing"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    
    # Read and validate file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_upload_mb:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB"
        )
    
    # Validate language
    try:
        validated_language = validate_language(language)
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    
    # Verify meeting exists and belongs to user
    user = get_or_create_user(db)
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == user.id
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Generate job ID
    job_id = f"audio_{meeting_id[:8]}_{datetime.utcnow().strftime('%H%M%S')}"
    
    # Create job in store
    job_store.create(job_id, Phase.QUEUED)
    
    # Save audio to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    # Add background task for chunked processing
    background_tasks.add_task(
        chunked_service.process_audio_file,
        job_id,
        tmp_path,
        validated_language,
        x_user_id
    )
    
    # Update meeting with job reference
    meeting.tags = json.dumps([*json.loads(meeting.tags or "[]"), f"job:{job_id}"])
    db.commit()
    
    return {
        "meeting_id": meeting_id,
        "job_id": job_id,
        "status": "processing",
        "message": f"Audio uploaded and processing started for meeting '{meeting.title}'",
        "language": validated_language
    }


