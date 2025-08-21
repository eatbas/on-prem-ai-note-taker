from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Optional
import asyncio
import logging
import secrets
import uuid

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from faster_whisper import WhisperModel

from .config import settings
from .ollama_client import OllamaClient
from .database import get_db, get_or_create_user, Meeting, Transcription, Summary


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


def get_whisper_model() -> WhisperModel:
	global _whisper_model
	if _whisper_model is None:
		_whisper_model = WhisperModel(
			settings.whisper_model_name,
			compute_type=settings.whisper_compute_type,
			download_root=settings.whisper_download_root,
		)
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
			segments, info = model.transcribe(
				tmp_path,
				language=language,
				vad_filter=vad_filter,
			)
			language_out = info.language if hasattr(info, "language") else None
			duration_out = info.duration if hasattr(info, "duration") else None
			for s in segments:
				segments_out.append(
					TranscriptionSegment(start=float(s.start), end=float(s.end), text=s.text.strip())
				)
				text_parts.append(s.text.strip())
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
	transcription: Optional[str]
	summary: Optional[str]
	duration: Optional[float]


@app.get("/api/meetings")
async def list_meetings(
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> List[MeetingResponse]:
	"""List all meetings for the current user"""
	user = get_or_create_user(db)
	
	meetings = db.query(Meeting).filter(
		Meeting.user_id == user.id
	).order_by(Meeting.created_at.desc()).all()
	
	response = []
	for meeting in meetings:
		# Get first transcription and summary
		transcription = db.query(Transcription).filter(
			Transcription.meeting_id == meeting.id
		).first()
		
		summary = db.query(Summary).filter(
			Summary.meeting_id == meeting.id
		).first()
		
		response.append(MeetingResponse(
			id=meeting.id,
			title=meeting.title,
			created_at=meeting.created_at.isoformat(),
			transcription=transcription.text if transcription else None,
			summary=summary.summary_text if summary else None,
			duration=meeting.duration,
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
	
	return MeetingResponse(
		id=meeting.id,
		title=meeting.title,
		created_at=meeting.created_at.isoformat(),
		transcription=transcription.text if transcription else None,
		summary=summary.summary_text if summary else None,
		duration=meeting.duration,
	)


@app.put("/api/meetings/{meeting_id}")
async def update_meeting(
	meeting_id: str,
	title: str = Form(...),
	_auth: None = Depends(require_basic_auth),
	db: Session = Depends(get_db),
) -> MeetingResponse:
	"""Update meeting title"""
	user = get_or_create_user(db)
	
	meeting = db.query(Meeting).filter(
		Meeting.id == meeting_id,
		Meeting.user_id == user.id
	).first()
	
	if not meeting:
		raise HTTPException(status_code=404, detail="Meeting not found")
	
	meeting.title = title
	db.commit()
	
	return await get_meeting(meeting_id, _auth, db)



