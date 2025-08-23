from __future__ import annotations

import os
import tempfile
import json
from typing import Any, Dict, List, Optional
import asyncio
import logging
import secrets
import uuid

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from faster_whisper import WhisperModel

from .config import settings
from .ollama_client import OllamaClient
from .database import get_db, get_or_create_user, Meeting, Transcription, Summary
from .queue_manager import queue_manager


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

# Optional Basic Auth
security = HTTPBasic()

def require_basic_auth(credentials: HTTPBasicCredentials = Depends(security)) -> None:
	"""Enforce HTTP Basic auth if username/password are set in settings.
	If not set, auth is disabled and the request is allowed."""
	if not settings.basic_auth_username and not settings.basic_auth_password:
		return None
	if not credentials:
		raise HTTPException(status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"})
	is_user_ok = secrets.compare_digest(credentials.username or "", settings.basic_auth_username)
	is_pass_ok = secrets.compare_digest(credentials.password or "", settings.basic_auth_password)
	if not (is_user_ok and is_pass_ok):
		raise HTTPException(status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"})
	return None


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


@app.on_event("shutdown")
async def shutdown_event():
	"""Cleanup queue manager"""
	if settings.use_queue_system:
		await queue_manager.stop_workers()
		logger.info("Queue management system stopped")


def get_whisper_model() -> WhisperModel:
	global _whisper_model
	if _whisper_model is None:
		logger.info(f"Loading Whisper model: {settings.whisper_model_name} with compute_type: {settings.whisper_compute_type}")
		try:
			_whisper_model = WhisperModel(
				settings.whisper_model_name,
				device="cpu",  # Force CPU to prevent GPU memory issues
				compute_type=settings.whisper_compute_type,
				download_root=settings.whisper_download_root,
				local_files_only=False
			)
			logger.info(f"Whisper model {settings.whisper_model_name} loaded successfully and cached")
		except Exception as e:
			logger.error(f"Failed to load Whisper model: {str(e)}")
			raise
	return _whisper_model


def get_transcribe_semaphore() -> asyncio.Semaphore:
	global _transcribe_semaphore
	if _transcribe_semaphore is None:
		_concurrency = max(1, settings.max_concurrency)
		_transcribe_semaphore = asyncio.Semaphore(_concurrency)
	return _transcribe_semaphore


@app.get("/api/health")
def health() -> Dict[str, Any]:
	return {
		"status": "ok",
		"whisper_model": settings.whisper_model_name,
		"ollama_model": settings.ollama_model,
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
		logger.info("Transcribe request: filename=%s size_mb=%.2f lang=%s user=%s", file.filename, size_mb, language, x_user_id)

		# Save to a temp file for faster-whisper consumption
		with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "audio")[1]) as tmp:
			tmp.write(content)
			tmp_path = tmp.name

		segments_out: List[TranscriptionSegment] = []
		text_parts: List[str] = []
		language_out: Optional[str] = None
		duration_out: Optional[float] = None

		try:
			# Optimized transcription with better VAD settings
			segments, info = model.transcribe(
				tmp_path,
				language=language,
				vad_filter=vad_filter,
				vad_parameters=dict(
					min_silence_duration_ms=500,
					speech_pad_ms=100
				),
				beam_size=1,  # Faster decoding
				best_of=1,   # Single pass
				temperature=0.0  # Deterministic output
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


def require_admin_auth(credentials: HTTPBasicCredentials = Depends(security)) -> None:
	"""Enforce admin authentication - uses same basic auth but could be extended"""
	if not settings.basic_auth_username and not settings.basic_auth_password:
		return None
	if not credentials:
		raise HTTPException(status_code=401, detail="Admin access required", headers={"WWW-Authenticate": "Basic"})
	is_user_ok = secrets.compare_digest(credentials.username or "", settings.basic_auth_username)
	is_pass_ok = secrets.compare_digest(credentials.password or "", settings.basic_auth_password)
	if not (is_user_ok and is_pass_ok):
		raise HTTPException(status_code=401, detail="Admin access required", headers={"WWW-Authenticate": "Basic"})
	return None


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


