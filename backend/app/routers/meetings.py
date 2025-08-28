"""Meeting management API endpoints"""

import json
import tempfile
import os
import uuid
import asyncio
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import (
    APIRouter, 
    File, 
    UploadFile, 
    Form, 
    HTTPException, 
    Header, 
    Depends, 
    Query,
    BackgroundTasks
)
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..schemas.meetings import (
    MeetingResponse,
    UpdateMeetingRequest,
    StartMeetingRequest,
    StartMeetingResponse,
)
from ..core.config import settings
from ..database import get_db, get_or_create_user, Meeting, Transcription, Summary, Speaker, SpeakerSegment
from ..core.utils import require_basic_auth, get_whisper_model, validate_language
from ..clients.ollama_client import OllamaClient
from ..workers.chunked_service import chunked_service
from ..workers.progress import job_store, Phase
from ..database import User

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
logger = logging.getLogger(__name__)

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


def get_user_from_header(x_user_id: Optional[str], db: Session) -> str:
    """Get or create user based on X-User-Id header"""
    if x_user_id:
        # Extract username from user ID format: user_{username}
        if x_user_id.startswith('user_'):
            username = x_user_id[5:]  # Remove 'user_' prefix
        else:
            username = x_user_id
        
        # Get or create user with this username
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(
                id=x_user_id,
                username=username
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user.id
    
    # Fallback to system username if no header provided
    user = get_or_create_user(db)
    return user.id


@router.get("", response_model=List[MeetingResponse])
async def list_meetings(
    search: Optional[str] = Query(None, description="Search in title, summary, and transcript"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> List[MeetingResponse]:
    """List all meetings for the current user with optional search and tag filtering"""
    user_id = get_user_from_header(x_user_id, db)
    
    query = db.query(Meeting).filter(Meeting.user_id == user_id)
    
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
            language=meeting.language or "auto",
            tags=tags,
        ))
    
    return response


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    """Get a specific meeting by ID"""
    user_id = get_user_from_header(x_user_id, db)
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == user_id
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
        language=meeting.language or "auto",
        tags=tags,
    )


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: str,
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None, description="JSON array of tags"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    """Update meeting title and/or tags"""
    user_id = get_user_from_header(x_user_id, db)
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == user_id
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
    
    return await get_meeting(meeting_id, x_user_id, _auth, db)


@router.put("/{meeting_id}/tags", response_model=MeetingResponse)
async def update_meeting_tags(
    meeting_id: str,
    request: UpdateMeetingRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    """Update meeting tags only"""
    user_id = get_user_from_header(x_user_id, db)
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == user_id
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if request.tags is not None:
        meeting.tags = json.dumps(request.tags)
        db.commit()
    
    return await get_meeting(meeting_id, x_user_id, _auth, db)


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Delete a meeting and all associated data including audio files"""
    user_id = get_user_from_header(x_user_id, db)
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == user_id
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Delete audio file if it exists
    if meeting.file_path:
        try:
            import os
            if os.path.exists(meeting.file_path):
                os.remove(meeting.file_path)
                logger.info(f"Deleted audio file: {meeting.file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete audio file {meeting.file_path}: {e}")
            # Continue with meeting deletion even if file deletion fails
    
    # Delete the meeting (cascading will handle related records)
    db.delete(meeting)
    db.commit()
    
    return {"message": "Meeting deleted successfully"}


@router.post("/start", response_model=StartMeetingResponse)
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
    
    # Get or create user from header
    user_id = get_user_from_header(x_user_id, db)
    
    # Create meeting record
    meeting_id = str(uuid.uuid4())
    meeting = Meeting(
        id=meeting_id,
        user_id=user_id,
        title=request.title,
        language=validated_language,
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


@router.post("/{meeting_id}/upload-audio")
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
    user_id = get_user_from_header(x_user_id, db)
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == user_id
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Generate job ID
    job_id = f"audio_{meeting_id[:8]}_{datetime.utcnow().strftime('%H%M%S')}"
    
    # Create job in store
    job_store.create(job_id, Phase.QUEUED)
    
    # Save audio to temp file
    with tempfile.NamedTemporaryFile(
        delete=False, 
        suffix=os.path.splitext(file.filename)[1]
    ) as tmp:
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


@router.post("/auto-process")
async def auto_process_meeting(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default="auto"),
    title: Optional[str] = Form(default="Auto-recorded meeting"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Automatically process a meeting recording with transcription and summarization"""
    from ..services.meeting_service import MeetingService
    
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    service = MeetingService()
    return await service.auto_process_meeting(file, language, title, x_user_id, db)


@router.post("/{meeting_id}/process-dual")
async def process_dual_meeting(
    meeting_id: str,
    microphone_audio: Optional[UploadFile] = File(None),
    speaker_audio: Optional[UploadFile] = File(None),
    language: Optional[str] = Form(default="auto"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Process dual audio files (microphone and speaker) for a meeting"""
    from ..services.meeting_service import MeetingService
    
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    if not microphone_audio and not speaker_audio:
        raise HTTPException(status_code=400, detail="At least one audio file (microphone or speaker) is required")
    
    # Get meeting from database
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    service = MeetingService()
    return await service.auto_process_dual_meeting(
        microphone_audio, speaker_audio, language, meeting.title, x_user_id, db
    )


@router.get("/{meeting_id}/speakers", response_model=List[Dict[str, Any]])
async def get_meeting_speakers(
    meeting_id: str,
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get all speakers for a meeting"""
    # Verify meeting exists
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get speakers with their segments
    speakers = (
        db.query(Speaker)
        .filter(Speaker.meeting_id == meeting_id)
        .all()
    )
    
    speakers_data = []
    for speaker in speakers:
        segments = (
            db.query(SpeakerSegment)
            .filter(SpeakerSegment.speaker_id == speaker.id)
            .order_by(SpeakerSegment.start_time)
            .all()
        )
        
        speakers_data.append({
            "id": speaker.id,
            "original_speaker_id": speaker.original_speaker_id,
            "custom_name": speaker.custom_name,
            "speaker_type": speaker.speaker_type,
            "total_segments": speaker.total_segments,
            "total_duration": speaker.total_duration,
            "segments": [
                {
                    "id": seg.id,
                    "start_time": seg.start_time,
                    "end_time": seg.end_time,
                    "text": seg.text,
                    "confidence": seg.confidence,
                }
                for seg in segments
            ]
        })
    
    return speakers_data


@router.put("/{meeting_id}/speakers/{speaker_id}/name")
async def update_speaker_name(
    meeting_id: str,
    speaker_id: str,
    new_name: str = Form(...),
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update a speaker's custom name"""
    # Verify meeting exists
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Find speaker
    speaker = (
        db.query(Speaker)
        .filter(Speaker.id == speaker_id, Speaker.meeting_id == meeting_id)
        .first()
    )
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    # Update name
    speaker.custom_name = new_name
    speaker.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": f"Speaker name updated to '{new_name}'",
        "speaker_id": speaker_id,
        "original_speaker_id": speaker.original_speaker_id,
        "custom_name": speaker.custom_name,
    }
