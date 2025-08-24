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
from ..database import get_db, get_or_create_user, Meeting, Transcription, Summary
from ..core.utils import require_basic_auth, get_whisper_model, validate_language
from ..clients.ollama_client import OllamaClient
from ..workers.chunked_service import chunked_service
from ..workers.progress import job_store, Phase

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
logger = logging.getLogger(__name__)

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


@router.get("", response_model=List[MeetingResponse])
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


@router.get("/{meeting_id}", response_model=MeetingResponse)
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


@router.put("/{meeting_id}", response_model=MeetingResponse)
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


@router.put("/{meeting_id}/tags", response_model=MeetingResponse)
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


@router.delete("/{meeting_id}")
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
