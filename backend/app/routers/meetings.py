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
    BackgroundTasks,
    Request  # 🚨 PHASE 3.3: Add Request for rate limiting
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
from ..database import get_db
from ..models import Meeting, Transcription, Summary, Speaker, SpeakerSegment
from ..models import User, Workspace
from ..models.user import get_or_create_user, get_or_create_user_from_header
from ..core.utils import require_basic_auth, get_whisper_model, validate_language
from ..clients.ollama_client import OllamaClient
from ..workers.chunked_service import chunked_service
from ..workers.progress import job_store, Phase
# 🚨 PHASE 3.3: Import rate limiting
from ..core.rate_limiter import get_rate_limiter

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
logger = logging.getLogger(__name__)


@router.get("/user/profile")
async def get_user_profile(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get current user profile including workspace information"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    # Get or create user
    user_id = get_user_from_header(x_user_id, db)
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get workspace information if user has one
    workspace_info = None
    if user.workspace_id:
        workspace = db.query(Workspace).filter(Workspace.id == user.workspace_id).first()
        if workspace:
            workspace_info = {
                "id": workspace.id,
                "name": workspace.name,
                "description": workspace.description
            }
    
    return {
        "id": user.id,
        "username": user.username,
        "workspace": workspace_info,
        "has_workspace": workspace_info is not None
    }




# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


def get_user_from_header(x_user_id: Optional[str], db: Session) -> str:
    """Get or create user based on X-User-Id header using centralized user creation"""
    user = get_or_create_user_from_header(db, x_user_id)
    return user.id


# ==========================================
# ASYNC BACKGROUND PROCESSING FUNCTION (Phase 3.2)
# ==========================================

async def process_meeting_audio_background(
    job_id: str,
    meeting_id: str,
    audio_file_path: str,
    language: str,
    user_id: str,
    file_size_mb: float
):
    """
    🚨 PHASE 3.2: Background function to process meeting audio with memory management.
    🚨 PHASE 3.3: With intelligent rate limiting and queue management.
    
    This function runs in the background to prevent VPS freezing during Whisper processing.
    It provides real-time progress updates and comprehensive error handling.
    """
    from ..core.memory_manager import memory_manager
    from ..core.utils import get_whisper_model
    from ..clients.ollama_client import OllamaClient
    from ..core.prompts import get_single_summary_prompt
    
    # 🚨 PHASE 3.3: Get rate limiter for queue management
    rate_limiter = get_rate_limiter()
    user_identifier = f"user:{user_id}"
    
    # Initialize Ollama client
    ollama_client = OllamaClient(
        base_url=settings.ollama_base_url,
        default_model=settings.ollama_model,
        timeout_seconds=settings.ollama_timeout_seconds,
    )
    
    try:
        logger.info(f"🚀 Starting background processing for job {job_id}, meeting {meeting_id}")
        
        # Update job status to processing
        job_store.update(job_id, phase=Phase.TRANSCRIBING, progress=5.0, 
                        message=f"Starting processing for {file_size_mb:.1f}MB audio file...")
        
        # 🚨 PHASE 3.1: Check memory before starting
        initial_memory = memory_manager.get_memory_usage()
        initial_mb = initial_memory.get('process', {}).get('rss_mb', 0)
        logger.info(f"💾 Starting with memory usage: {initial_mb:.1f}MB")
        
        # Validate language
        validated_language = validate_language(language)
        
        try:
            # 🚨 PHASE 3.1: Monitor memory before model loading
            memory_manager.monitor_memory_usage()
            
            # Load Whisper model
            job_store.update(job_id, progress=10.0, message="Loading Whisper model...")
            model = get_whisper_model()
            
            job_store.update(job_id, progress=15.0, message="Model loaded, starting transcription...")
            
            # 🚨 PHASE 3.1: Monitor memory before transcription
            memory_manager.monitor_memory_usage()
            
            # Transcribe with progress updates
            logger.info(f"🎵 Starting transcription for {audio_file_path} ({file_size_mb:.1f}MB)")
            
            segments, info = model.transcribe(
                audio_file_path,
                language=validated_language if validated_language != "auto" else None,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=settings.whisper_vad_min_silence_ms,
                    speech_pad_ms=settings.whisper_vad_speech_pad_ms
                ),
                beam_size=settings.whisper_beam_size,
                best_of=settings.whisper_best_of,
                temperature=settings.whisper_temperature,
                condition_on_previous_text=settings.whisper_condition_on_previous_text,
                word_timestamps=settings.whisper_word_timestamps,
                initial_prompt=settings.whisper_initial_prompt,
                compression_ratio_threshold=settings.whisper_compression_ratio_threshold,
                log_prob_threshold=settings.whisper_log_prob_threshold
            )
            
            # 🚨 PHASE 3.1: Monitor memory after transcription
            memory_manager.monitor_memory_usage()
            logger.info(f"✅ Transcription completed for meeting {meeting_id}")
            
            job_store.update(job_id, progress=60.0, message="Transcription completed, processing segments...")
            
            # Process segments
            segments_out = []
            text_parts = []
            segments_list = list(segments)
            total_segments = len(segments_list)
            
            for i, s in enumerate(segments_list):
                text_cleaned = s.text.strip()
                if text_cleaned:
                    segments_out.append({
                        "start": float(s.start),
                        "end": float(s.end),
                        "text": text_cleaned
                    })
                    text_parts.append(text_cleaned)
                
                # Update progress every 10 segments or 5%
                if i % max(1, total_segments // 20) == 0 or i % 10 == 0:
                    progress = min(75, 60 + (i / total_segments * 15))
                    job_store.update(job_id, progress=progress, 
                                   message=f"Processed {i}/{total_segments} segments")
            
            # Generate transcript
            transcript_text = "\n".join(text_parts).strip()
            job_store.update(job_id, progress=80.0, message="Generating summary...")
            
            # Choose language for summary
            if validated_language in ("tr", "en"):
                lang_code = validated_language
            elif hasattr(info, "language") and info.language in ("tr", "en"):
                lang_code = info.language
            else:
                lang_code = "tr"  # Default to Turkish
            
            # Generate summary
            prompt = get_single_summary_prompt(lang_code).format(transcript=transcript_text)
            summary = ollama_client.generate(
                prompt,
                options={
                    "temperature": 0.2,
                    "top_p": 0.8,
                    "top_k": 10,
                    "num_predict": 300,
                },
            )
            
            job_store.update(job_id, progress=90.0, message="Saving results...")
            
            # Save to database
            db = next(get_db())
            try:
                # Update meeting record
                meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
                if meeting:
                    meeting.duration = info.duration if hasattr(info, "duration") else None
                    meeting.language = info.language if hasattr(info, "language") else validated_language
                
                # Save transcription
                transcription = Transcription(
                    meeting_id=meeting_id,
                    text=transcript_text,
                    language=info.language if hasattr(info, "language") else validated_language,
                )
                db.add(transcription)
                
                # Save summary
                summary_obj = Summary(
                    meeting_id=meeting_id,
                    summary_text=summary,
                    model_used=settings.ollama_model,
                )
                db.add(summary_obj)
                
                db.commit()
                logger.info(f"📝 Results saved to database for meeting {meeting_id}")
                
            except Exception as db_error:
                logger.error(f"❌ Database save failed for meeting {meeting_id}: {db_error}")
                # Don't fail the job for database errors
            
            # Job completed successfully
            job_store.update(
                job_id,
                phase=Phase.DONE,
                progress=100.0,
                message="Meeting processing completed successfully",
                current=total_segments,
                total=total_segments
            )
            
            logger.info(f"✅ Background processing completed successfully for meeting {meeting_id}")
            
            # 🚨 PHASE 3.3: Mark processing as successful in rate limiter
            processing_time = initial_memory.get('process', {}).get('rss_mb', 0) * 0.1  # Rough processing time estimate
            rate_limiter.remove_from_queue(user_identifier, success=True, processing_time=processing_time)
            
        finally:
            # 🚨 PHASE 3.1: Critical cleanup after processing
            try:
                logger.info(f"🧹 Starting memory cleanup for job {job_id}")
                
                # Force Whisper model cleanup
                cleanup_success = memory_manager.cleanup_whisper_model(force=True)
                
                # Log final memory state
                final_memory = memory_manager.get_memory_usage()
                final_mb = final_memory.get('process', {}).get('rss_mb', 0)
                memory_freed = initial_mb - final_mb
                
                logger.info(f"💾 Memory cleanup completed for job {job_id}")
                logger.info(f"📊 Memory stats: Initial: {initial_mb:.1f}MB, Final: {final_mb:.1f}MB, Freed: {memory_freed:.1f}MB")
                
                if cleanup_success:
                    logger.info(f"✅ Whisper model cleanup successful for job {job_id}")
                else:
                    logger.warning(f"⚠️ Whisper model cleanup had issues for job {job_id}")
                    
            except Exception as cleanup_error:
                logger.error(f"❌ Memory cleanup failed for job {job_id}: {cleanup_error}")
            
            # Cleanup temp file
            try:
                os.remove(audio_file_path)
                logger.debug(f"🗑️ Temp file removed: {audio_file_path}")
            except OSError as e:
                logger.warning(f"Failed to remove temp file {audio_file_path}: {e}")
                
    except Exception as e:
        # Job failed - ensure cleanup and error reporting
        try:
            logger.error(f"❌ Job {job_id} failed for meeting {meeting_id}, forcing emergency cleanup")
            memory_manager.cleanup_whisper_model(force=True)
        except Exception as emergency_cleanup_error:
            logger.error(f"❌ Emergency cleanup failed: {emergency_cleanup_error}")
        
        # 🚨 PHASE 3.3: Mark processing as failed in rate limiter
        rate_limiter.remove_from_queue(user_identifier, success=False)
        
        error_message = f"Meeting processing failed: {str(e)}"
        job_store.update(
            job_id,
            phase=Phase.ERROR,
            message=error_message
        )
        logger.error(f"❌ Background processing failed for meeting {meeting_id}: {e}")
        
        # Cleanup temp file on error
        try:
            os.remove(audio_file_path)
        except OSError:
            pass


@router.get("", response_model=List[MeetingResponse])
async def list_meetings(
    search: Optional[str] = Query(None, description="Search in title, summary, and transcript"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    scope: Optional[str] = Query(None, description="Filter by scope: 'personal', 'workspace', or 'all'"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> List[MeetingResponse]:
    """List meetings accessible to the current user with workspace support"""
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and their workspace
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter
    # Users can see: 1) Their own meetings, 2) Meetings from their workspace
    access_filters = [Meeting.user_id == user_id]
    
    if current_user.workspace_id:
        # Add workspace meetings filter
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    # Apply access control
    query = db.query(Meeting).filter(or_(*access_filters))
    
    # Apply scope filter if specified
    if scope == "personal":
        query = query.filter(Meeting.is_personal == True)
    elif scope == "workspace":
        if current_user.workspace_id:
            query = query.filter(
                (Meeting.workspace_id == current_user.workspace_id) & 
                (Meeting.is_personal == False)
            )
        else:
            # User has no workspace, return empty for workspace scope
            query = query.filter(False)
    # scope == "all" or None: no additional filtering
    
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
            workspace_id=meeting.workspace_id,
            is_personal=meeting.is_personal,
        ))
    
    return response


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    """Get a specific meeting by ID with workspace access control"""
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and their workspace
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter for single meeting
    access_filters = [Meeting.user_id == user_id]
    
    if current_user.workspace_id:
        # Add workspace meetings filter
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        or_(*access_filters)
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
        workspace_id=meeting.workspace_id,
        is_personal=meeting.is_personal,
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
    """Start a new meeting with language and workspace scope selection"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    # Validate language
    try:
        validated_language = validate_language(request.language)
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    
    # Get or create user from header
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and validate workspace scope
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Determine meeting scope and workspace assignment
    workspace_id = None
    is_personal = True
    
    if request.scope == "workspace":
        if not current_user.workspace_id:
            raise HTTPException(
                status_code=400, 
                detail="Cannot create workspace meeting: user is not assigned to any workspace"
            )
        workspace_id = current_user.workspace_id
        is_personal = False
    elif request.scope == "personal":
        # Personal meeting - workspace_id stays None, is_personal stays True
        pass
    else:
        raise HTTPException(
            status_code=400, 
            detail="Invalid scope. Must be 'personal' or 'workspace'"
        )
    
    # Create meeting record
    meeting_id = str(uuid.uuid4())
    meeting = Meeting(
        id=meeting_id,
        user_id=user_id,
        title=request.title,
        language=validated_language,
        tags=json.dumps(request.tags) if request.tags else None,
        workspace_id=workspace_id,
        is_personal=is_personal,
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


# Removed process_dual_meeting endpoint - now using single-stream audio approach


# ==========================================
# ASYNC PROCESSING ENDPOINTS (Phase 3.2)
# ==========================================

@router.post("/{meeting_id}/process-async")
async def process_meeting_async(
    meeting_id: str,
    audio_file: UploadFile = File(...),
    language: Optional[str] = Form(default="auto"),
    use_celery: Optional[bool] = Form(default=True),  # 🚨 PHASE 3.4: Choose processing method
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    request: Request,  # 🚨 PHASE 3.3: Add request for rate limiting
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    🚨 PHASE 3.2: Process meeting audio asynchronously to prevent VPS freezing.
    🚨 PHASE 3.3: With intelligent rate limiting and queue management.
    🚨 PHASE 3.4: Support both Celery (persistent) and FastAPI (lightweight) processing.
    
    This endpoint immediately returns a job ID and processes the audio in the background,
    allowing the VPS to remain responsive during heavy Whisper model operations.
    
    Processing Options:
    - use_celery=True: Robust job persistence, retry logic, distributed workers (default)
    - use_celery=False: Lightweight FastAPI background tasks (faster startup)
    """
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    # 🚨 PHASE 3.3: Apply rate limiting with intelligent feedback
    rate_limiter = get_rate_limiter()
    allowed, rate_info = rate_limiter.check_rate_limit(request, "upload")
    
    if not allowed:
        error_type = rate_info.get("type", "unknown")
        error_message = rate_info.get("message", "Rate limit exceeded")
        retry_after = rate_info.get("retry_after", 60)
        
        # Add user to queue for feedback even if rate limited
        user_identifier = rate_limiter._get_user_identifier(request)
        if error_type != "too_frequent":
            queue_info = rate_limiter.add_to_queue(user_identifier, "upload")
            rate_info["queue_info"] = queue_info
        
        logger.warning(f"🚫 Rate limit exceeded for {user_identifier}: {error_message}")
        
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limited",
                "message": error_message,
                "retry_after": retry_after,
                "rate_limit_info": rate_info,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Get current user
    user_id = get_user_from_header(x_user_id, db)
    
    # Verify meeting exists and belongs to user  
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter
    access_filters = [Meeting.user_id == user_id]
    if current_user.workspace_id:
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        or_(*access_filters)
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Validate file
    if not audio_file.filename:
        raise HTTPException(status_code=400, detail="Audio file must have a filename")
    
    # Read and validate file size
    content = await audio_file.read()
    size_mb = len(content) / (1024 * 1024)
    
    # 🚨 PHASE 3.1: Check memory constraints before processing
    from ..core.memory_manager import validate_file_size
    
    if size_mb > settings.max_upload_mb:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB"
        )
    
    if not validate_file_size(len(content)):
        raise HTTPException(
            status_code=413,
            detail=f"File size {size_mb:.1f} MB exceeds current memory constraints. Please try again later."
        )
    
    # Validate language
    try:
        validated_language = validate_language(language)
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    
    # Generate job ID for async processing
    job_id = f"meeting_sync_{meeting_id[:8]}_{datetime.utcnow().strftime('%H%M%S')}"
    
    # Create job in store with initial status
    job_store.create(job_id, Phase.QUEUED)
    
    # Save audio to temp file for background processing
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    # 🚨 PHASE 3.4: Choose processing method based on use_celery parameter
    if use_celery:
        # Use Celery for robust, persistent processing
        try:
            from ..workers.celery_tasks import process_meeting_audio_celery
            from ..core.celery_app import celery_app
            
            # Submit Celery task
            celery_task = process_meeting_audio_celery.delay(
                job_id,
                meeting_id,
                tmp_path,
                validated_language,
                user_id,
                size_mb
            )
            
            # Store Celery task ID for tracking
            job_store.update(job_id, 
                           phase=Phase.QUEUED, 
                           progress=5.0, 
                           message=f"Celery task queued: {celery_task.id}")
            
            logger.info(f"🚀 Started Celery processing job {job_id} (task: {celery_task.id}) for meeting {meeting_id} ({size_mb:.1f}MB)")
            
            processing_method = "celery"
            task_info = {
                "celery_task_id": celery_task.id,
                "worker_queue": "audio_processing",
                "features": ["persistent", "retryable", "distributed"]
            }
            
        except ImportError:
            logger.warning("⚠️ Celery not available, falling back to FastAPI background tasks")
            use_celery = False
        except Exception as e:
            logger.error(f"❌ Celery task failed to start: {e}, falling back to FastAPI background tasks")
            use_celery = False
    
    if not use_celery:
        # Use FastAPI background tasks for lightweight processing
        background_tasks.add_task(
            process_meeting_audio_background,
            job_id,
            meeting_id,
            tmp_path,
            validated_language,
            user_id,
            size_mb
        )
        
        logger.info(f"🚀 Started FastAPI background processing job {job_id} for meeting {meeting_id} ({size_mb:.1f}MB)")
        
        processing_method = "fastapi"
        task_info = {
            "background_task": True,
            "features": ["lightweight", "immediate"]
        }
    
    # 🚨 PHASE 3.3: Add user to processing queue for tracking
    user_identifier = rate_limiter._get_user_identifier(request)
    queue_info = rate_limiter.add_to_queue(user_identifier, "upload")
    
    # Return immediately with job tracking info
    return {
        "job_id": job_id,
        "meeting_id": meeting_id,
        "status": "queued",
        "message": f"Meeting processing started using {processing_method}. File size: {size_mb:.1f}MB",
        "progress_url": f"/api/jobs/{job_id}/status",
        "estimated_duration_minutes": max(2, size_mb * 0.5),  # Rough estimate: 30 seconds per MB
        "processing_method": processing_method,
        "task_info": task_info,
        "queue_info": queue_info,
        "rate_limit_info": rate_info
    }


@router.get("/{meeting_id}/processing-status")
async def get_meeting_processing_status(
    meeting_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get the current processing status for a meeting"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    user_id = get_user_from_header(x_user_id, db)
    
    # Check if meeting exists and belongs to user
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    access_filters = [Meeting.user_id == user_id]
    if current_user.workspace_id:
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        or_(*access_filters)
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Look for active job for this meeting
    # Note: This is a simplified approach. In a real system, you'd store job references in the meeting
    
    return {
        "meeting_id": meeting_id,
        "status": "completed",  # Placeholder - would be dynamic based on job status
        "message": "Meeting processing status retrieved"
    }


# ==========================================
# CELERY MANAGEMENT ENDPOINTS (Phase 3.4)
# ==========================================

@router.get("/celery/status")
async def get_celery_status(
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Get Celery worker status and queue information"""
    try:
        from ..core.celery_app import celery_app
        
        # Get active workers
        inspect = celery_app.control.inspect()
        active_workers = inspect.active()
        registered_tasks = inspect.registered()
        worker_stats = inspect.stats()
        
        # Get queue information
        active_queues = inspect.active_queues()
        
        return {
            "status": "available",
            "active_workers": len(active_workers) if active_workers else 0,
            "worker_details": active_workers,
            "registered_tasks": registered_tasks,
            "worker_stats": worker_stats,
            "active_queues": active_queues,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except ImportError:
        return {
            "status": "not_available",
            "message": "Celery not installed or configured",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/celery/tasks/{task_id}")
async def get_celery_task_status(
    task_id: str,
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Get status of a specific Celery task"""
    try:
        from ..core.celery_app import celery_app
        from celery.result import AsyncResult
        
        # Get task result
        result = AsyncResult(task_id, app=celery_app)
        
        task_info = {
            "task_id": task_id,
            "status": result.status,
            "state": result.state,
            "ready": result.ready(),
            "successful": result.successful(),
            "failed": result.failed(),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add result/error information if available
        if result.ready():
            if result.successful():
                task_info["result"] = result.result
            elif result.failed():
                task_info["error"] = str(result.info)
                task_info["traceback"] = result.traceback
        else:
            # Task is still running, get progress info
            if result.info and isinstance(result.info, dict):
                task_info["progress"] = result.info
        
        return task_info
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Celery not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {e}")


@router.post("/celery/tasks/{task_id}/revoke")
async def revoke_celery_task(
    task_id: str,
    terminate: bool = False,
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Revoke (cancel) a Celery task"""
    try:
        from ..core.celery_app import celery_app
        
        # Revoke the task
        celery_app.control.revoke(task_id, terminate=terminate)
        
        return {
            "task_id": task_id,
            "action": "revoked",
            "terminated": terminate,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except ImportError:
        raise HTTPException(status_code=503, detail="Celery not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revoke task: {e}")


@router.get("/system/redis-status")
async def get_redis_status(
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Check Redis connection and status"""
    try:
        import redis
        from ..core.config import settings
        
        # Connect to Redis
        r = redis.from_url(settings.redis_url)
        
        # Test connection
        r.ping()
        
        # Get Redis info
        info = r.info()
        
        return {
            "status": "connected",
            "redis_version": info.get("redis_version"),
            "connected_clients": info.get("connected_clients"),
            "used_memory_human": info.get("used_memory_human"),
            "total_commands_processed": info.get("total_commands_processed"),
            "uptime_in_seconds": info.get("uptime_in_seconds"),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except ImportError:
        return {
            "status": "not_available",
            "message": "Redis client not installed",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# ==========================================
# RATE LIMITING & QUEUE MANAGEMENT ENDPOINTS (Phase 3.3)
# ==========================================

@router.get("/queue/status")
async def get_queue_status(
    request: Request,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Get current queue status and position for the user"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    rate_limiter = get_rate_limiter()
    user_identifier = rate_limiter._get_user_identifier(request)
    
    queue_info = rate_limiter.get_queue_position(user_identifier)
    
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "queue_info": queue_info,
        "message": "Queue status retrieved successfully"
    }


@router.get("/queue/retry-recommendation")
async def get_retry_recommendation(
    request: Request,
    last_error: Optional[str] = Query(None, description="Last error message for context"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Get intelligent retry recommendation with exponential backoff"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    rate_limiter = get_rate_limiter()
    user_identifier = rate_limiter._get_user_identifier(request)
    
    retry_info = rate_limiter.get_retry_recommendation(user_identifier, last_error)
    
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "retry_info": retry_info,
        "message": "Retry recommendation retrieved successfully"
    }


@router.post("/queue/force-cleanup")
async def force_queue_cleanup(
    request: Request,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Force cleanup user from queue (admin operation)"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    rate_limiter = get_rate_limiter()
    user_identifier = rate_limiter._get_user_identifier(request)
    
    # Force remove from queue
    rate_limiter.remove_from_queue(user_identifier, success=False)
    
    return {
        "status": "completed",
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"User {user_identifier} removed from queue"
    }


# ==========================================
# AUDIO STREAMING ENDPOINTS (Phase 4.1)
# ==========================================

@router.get("/{meeting_id}/audio/stream")
async def stream_meeting_audio(
    meeting_id: str,
    range: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
):
    """
    🚨 PHASE 4.1: Stream audio file from VPS with HTTP range support.
    
    Supports partial content requests for efficient audio streaming and seeking.
    """
    from fastapi.responses import FileResponse, StreamingResponse
    from fastapi import HTTPException, status
    import mimetypes
    
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and check access
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter
    access_filters = [Meeting.user_id == user_id]
    if current_user.workspace_id:
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        or_(*access_filters)
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if audio file exists
    audio_path = meeting.audio_file_path or meeting.file_path  # Fallback to legacy path
    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Get file info
    file_size = os.path.getsize(audio_path)
    
    # Determine content type
    content_type = mimetypes.guess_type(audio_path)[0]
    if not content_type:
        # Default based on file extension or format
        if meeting.audio_format:
            content_type = f"audio/{meeting.audio_format}"
        else:
            content_type = "audio/wav"  # Default
    
    # Handle range requests for audio streaming
    if range:
        # Parse range header: "bytes=start-end"
        try:
            range_header = range.replace("bytes=", "")
            start, end = range_header.split("-")
            start = int(start) if start else 0
            end = int(end) if end else file_size - 1
            
            # Validate range
            if start >= file_size or end >= file_size or start > end:
                raise HTTPException(
                    status_code=416, 
                    detail="Requested range not satisfiable",
                    headers={"Content-Range": f"bytes */{file_size}"}
                )
            
            # Stream the requested range
            chunk_size = end - start + 1
            
            def stream_file_range():
                with open(audio_path, "rb") as f:
                    f.seek(start)
                    remaining = chunk_size
                    while remaining:
                        chunk_read_size = min(8192, remaining)  # 8KB chunks
                        chunk = f.read(chunk_read_size)
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            
            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            }
            
            return StreamingResponse(
                stream_file_range(),
                status_code=206,  # Partial Content
                headers=headers,
                media_type=content_type
            )
            
        except ValueError:
            # Invalid range format, fall back to full file
            logger.warning(f"Invalid range header: {range}")
            pass
    
    # Return full file if no range requested or range parsing failed
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
    }
    
    return FileResponse(
        audio_path,
        media_type=content_type,
        headers=headers,
        filename=f"{meeting.title}.{meeting.audio_format or 'wav'}"
    )


@router.get("/{meeting_id}/audio/metadata")
async def get_meeting_audio_metadata(
    meeting_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get audio metadata for a meeting"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and check access
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter
    access_filters = [Meeting.user_id == user_id]
    if current_user.workspace_id:
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        or_(*access_filters)
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if audio file exists
    audio_path = meeting.audio_file_path or meeting.file_path
    audio_exists = audio_path and os.path.exists(audio_path)
    
    return {
        "meeting_id": meeting_id,
        "has_audio": audio_exists,
        "audio_metadata": {
            "duration": meeting.duration,
            "format": meeting.audio_format,
            "size_bytes": meeting.audio_size_bytes,
            "sample_rate": meeting.audio_sample_rate,
            "channels": meeting.audio_channels,
            "file_path": meeting.audio_file_path,
        } if audio_exists else None,
        "streaming_url": f"/api/meetings/{meeting_id}/audio/stream" if audio_exists else None,
        "timestamp": datetime.utcnow().isoformat()
    }


# ==========================================
# DUPLICATE PREVENTION ENDPOINTS
# ==========================================

@router.get("/check/{meeting_id}")
async def check_meeting_exists(
    meeting_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, bool]:
    """Check if a meeting exists on VPS (for duplicate prevention)"""
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and their workspace for access control
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter (same as list_meetings)
    access_filters = [Meeting.user_id == user_id]
    
    if current_user.workspace_id:
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    # Check if meeting exists with access control
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        or_(*access_filters)
    ).first()
    
    return {"exists": meeting is not None}


@router.get("/synced")
async def get_synced_meeting_ids(
    scope: Optional[str] = Query(None, description="Filter by scope: 'personal', 'workspace', or 'all'"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get list of synced meeting IDs for duplicate prevention"""
    user_id = get_user_from_header(x_user_id, db)
    
    # Get current user and their workspace
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build access control filter (same as list_meetings)
    access_filters = [Meeting.user_id == user_id]
    
    if current_user.workspace_id:
        access_filters.append(
            (Meeting.workspace_id == current_user.workspace_id) & 
            (Meeting.is_personal == False)
        )
    
    # Apply access control
    query = db.query(Meeting.id, Meeting.updated_at, Meeting.title).filter(or_(*access_filters))
    
    # Apply scope filter if specified
    if scope == "personal":
        query = query.filter(Meeting.is_personal == True)
    elif scope == "workspace":
        if current_user.workspace_id:
            query = query.filter(
                (Meeting.workspace_id == current_user.workspace_id) & 
                (Meeting.is_personal == False)
            )
        else:
            # User has no workspace, return empty for workspace scope
            query = query.filter(False)
    # scope == "all" or None: no additional filtering
    
    meetings = query.all()
    
    return [
        {
            "id": meeting.id,
            "updated_at": meeting.updated_at.isoformat(),
            "title": meeting.title
        } for meeting in meetings
    ]


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
