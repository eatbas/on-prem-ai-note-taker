"""Job API endpoints for FastAPI application"""

import os
import tempfile
import json
import asyncio
import logging
from typing import Any, Dict, Optional
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Header, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .workers.progress import job_store, Phase
from .core.config import settings
from .clients.ollama_client import OllamaClient
from .database import get_db
from .models import Meeting, Transcription, Summary
from .models.user import get_or_create_user
from .core.utils import get_whisper_model, validate_language, require_basic_auth
from .core.prompts import get_single_summary_prompt

# Initialize router and logger
router = APIRouter(prefix="/api/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


# Request/Response Models
class TranscribeAndSummarizeRequest(BaseModel):
    language: str = "auto"


class JobSubmitResponse(BaseModel):
    job_id: str
    status: str = "submitted"
    message: str = "Job submitted successfully"


class JobStatusResponse(BaseModel):
    id: str
    phase: str
    progress: float
    eta_seconds: Optional[float]
    message: str
    current: int
    total: int
    started_at: Optional[str]
    updated_at: str
    is_complete: bool
    is_running: bool


class JobCancelResponse(BaseModel):
    job_id: str
    cancelled: bool
    message: str


# Background task functions
async def process_transcribe_and_summarize_job(
    job_id: str,
    file_content: bytes,
    file_name: str,
    language: str,
    user_id: str
):
    """Background task to process transcription and summarization with memory management"""
    from .core.memory_manager import memory_manager, validate_file_size
    
    try:
        # 🚨 PHASE 3.1: Validate file size against memory constraints
        if not validate_file_size(len(file_content)):
            error_msg = f"File too large for current memory constraints: {len(file_content) / 1024 / 1024:.1f}MB"
            logger.error(error_msg)
            job_store.update(job_id, phase=Phase.ERROR, progress=0.0, message=error_msg)
            raise ValueError(error_msg)
        
        # Log initial memory state
        initial_memory = memory_manager.get_memory_usage()
        logger.info(f"💾 Starting job {job_id} with memory usage: {initial_memory.get('process', {}).get('rss_mb', 0):.1f}MB")
        
        # Update job to processing
        job_store.update(job_id, phase=Phase.TRANSCRIBING, progress=5.0, message="Starting transcription...")
        
        # Validate language
        validated_language = validate_language(language)
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        try:
            # 🚨 PHASE 3.1: Monitor memory before model loading
            memory_manager.monitor_memory_usage()
            
            # Get Whisper model
            model = get_whisper_model()
            job_store.update(job_id, progress=10.0, message="Model loaded, transcribing audio...")
            
            # 🚨 PHASE 3.1: Monitor memory before transcription
            memory_manager.monitor_memory_usage()
            
            # Transcribe with configured quality settings
            logger.info(f"🎵 Starting transcription for {file_name} ({len(file_content) / 1024 / 1024:.1f}MB)")
            segments, info = model.transcribe(
                tmp_path,
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
            logger.info(f"✅ Transcription completed for {file_name}")
            
            # Process segments with progress updates
            segments_out = []
            text_parts = []
            segment_count = 0
            
            # Convert segments to list for length calculation
            segments_list = list(segments)
            total_segments = len(segments_list)
            
            for s in segments_list:
                text_cleaned = s.text.strip()
                if text_cleaned:
                    segments_out.append({
                        "start": float(s.start),
                        "end": float(s.end),
                        "text": text_cleaned
                    })
                    text_parts.append(text_cleaned)
                
                segment_count += 1
                # Update progress every 5 segments or at least every 10%
                if segment_count % max(1, total_segments // 10) == 0 or segment_count % 5 == 0:
                    progress = min(70, 10 + (segment_count / total_segments * 60))
                    job_store.update(
                        job_id,
                        progress=progress,
                        current=segment_count,
                        total=total_segments,
                        message=f"Transcribed {segment_count}/{total_segments} segments"
                    )
            
            # Transcription complete
            job_store.update(job_id, progress=75.0, message="Transcription completed, starting summarization...")
            
            # Generate summary
            transcript_text = "\n".join(text_parts).strip()
            job_store.update(job_id, progress=80.0, message="Generating summary...")
            
            # Choose language for summary
            # Priority: 1) User specified language, 2) Whisper detected language, 3) Default to Turkish
            if validated_language in ("tr", "en"):
                lang_code = validated_language
            elif hasattr(info, "language") and info.language in ("tr", "en"):
                lang_code = info.language
            else:
                # Default to Turkish for auto/unknown languages
                lang_code = "tr"

            prompt = get_single_summary_prompt(lang_code).format(transcript=transcript_text)
            summary = _ollama_client.generate(
                prompt,
                options={
                    "temperature": 0.2,
                    "top_p": 0.8,
                    "top_k": 10,
                    "num_predict": 300,
                },
            )
            
            # Update to finalizing
            job_store.update(job_id, progress=90.0, message="Finalizing results...")
            
            # Save to database if user exists
            try:
                db = next(get_db())
                user = get_or_create_user(db)
                
                # Create meeting record
                meeting_id = job_id  # Use job_id as meeting_id for simplicity
                meeting = Meeting(
                    id=meeting_id,
                    user_id=user.id,
                    title=f"Meeting {meeting_id[:8]}",
                    language=validated_language,
                    duration=info.duration if hasattr(info, "duration") else None
                )
                db.add(meeting)
                
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
                
            except Exception as db_error:
                # Log database error but don't fail the job
                print(f"Database save failed for job {job_id}: {db_error}")
            
            # Job completed successfully
            job_store.update(
                job_id,
                phase=Phase.DONE,
                progress=100.0,
                message="Transcription and summarization completed successfully",
                current=total_segments,
                total=total_segments
            )
            
        finally:
            # 🚨 PHASE 3.1: Critical memory cleanup after processing
            try:
                logger.info(f"🧹 Starting memory cleanup for job {job_id}")
                
                # Force Whisper model cleanup
                cleanup_success = memory_manager.cleanup_whisper_model(force=True)
                
                # Log final memory state
                final_memory = memory_manager.get_memory_usage()
                final_mb = final_memory.get('process', {}).get('rss_mb', 0)
                initial_mb = initial_memory.get('process', {}).get('rss_mb', 0)
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
                os.remove(tmp_path)
                logger.debug(f"🗑️ Temp file removed: {tmp_path}")
            except OSError as e:
                logger.warning(f"Failed to remove temp file {tmp_path}: {e}")
                
    except Exception as e:
        # Job failed - ensure cleanup even on failure
        try:
            from .core.memory_manager import memory_manager
            logger.error(f"❌ Job {job_id} failed, forcing emergency cleanup")
            memory_manager.cleanup_whisper_model(force=True)
        except Exception as emergency_cleanup_error:
            logger.error(f"❌ Emergency cleanup failed: {emergency_cleanup_error}")
        
        error_message = f"Job failed: {str(e)}"
        job_store.update(
            job_id,
            phase=Phase.ERROR,
            message=error_message
        )
        print(f"Job {job_id} failed: {e}")


# API Endpoints
@router.post("/transcribe-and-summarize", response_model=JobSubmitResponse, status_code=202)
async def submit_transcribe_and_summarize_job(
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    _: None = Depends(require_basic_auth),
):
    """Submit a transcription and summarization job"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    
    # Read and validate file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    
    # 🚨 PHASE 3.1: Check both size limit and memory constraints
    from .core.memory_manager import validate_file_size
    
    if size_mb > settings.max_upload_mb:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB"
        )
    
    if not validate_file_size(len(content)):
        raise HTTPException(
            status_code=413,
            detail=f"File size {size_mb:.1f} MB exceeds current memory constraints. Please try again later or upload a smaller file."
        )
    
    # Validate language
    try:
        validated_language = validate_language(language)
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    
    # Generate job ID
    job_id = f"job_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{x_user_id[:8]}"
    
    # Create job in store
    job_store.create(job_id, Phase.QUEUED)
    
    # Add background task
    background_tasks.add_task(
        process_transcribe_and_summarize_job,
        job_id,
        content,
        file.filename,
        validated_language,
        x_user_id
    )
    
    return JobSubmitResponse(
        job_id=job_id,
        status="submitted",
        message="Transcription and summarization job submitted successfully"
    )


@router.get("/{job_id}/status", response_model=JobStatusResponse, status_code=200)
async def get_job_status(
    job_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
):
    """Get the current status of a job"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    job_status = job_store.get(job_id)
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(**job_status.to_dict())


@router.post("/{job_id}/cancel", response_model=JobCancelResponse, status_code=202)
async def cancel_job(
    job_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
):
    """Cancel a running job"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    success = job_store.cancel(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel job")
    
    return JobCancelResponse(
        job_id=job_id,
        cancelled=True,
        message="Job cancelled successfully"
    )


@router.get("/{job_id}/events")
async def stream_job_events(
    job_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
):
    """Stream job progress events using Server-Sent Events (SSE)"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    if not settings.enable_sse:
        raise HTTPException(status_code=503, detail="SSE not enabled")
    
    job_status = job_store.get(job_id)
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    async def event_stream():
        """Stream progress events"""
        # Send initial status
        yield f"data: {json.dumps(job_status.to_dict())}\n\n"
        
        # Monitor for changes
        last_updated = job_status.updated_at
        while True:
            try:
                # Check for updates every 500ms
                await asyncio.sleep(0.5)
                
                current_status = job_store.get(job_id)
                if not current_status:
                    # Job was deleted
                    yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                    break
                
                # Check if status changed
                if current_status.updated_at != last_updated:
                    last_updated = current_status.updated_at
                    yield f"data: {json.dumps(current_status.to_dict())}\n\n"
                    
                    # Stop streaming if job is complete
                    if current_status.phase in [Phase.DONE, Phase.ERROR, Phase.CANCELED]:
                        break
                
                # Send keepalive every 30 seconds
                if int(datetime.utcnow().timestamp()) % 30 == 0:
                    yield ": keepalive\n\n"
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                yield f"data: {json.dumps({'error': f'Stream error: {str(e)}'})}\n\n"
                break
    
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


# 🚨 PHASE 3.1: Memory monitoring endpoints
@router.get("/memory/stats")
async def get_memory_stats(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
):
    """Get current VPS memory usage statistics"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    try:
        from .core.memory_manager import get_memory_stats
        memory_stats = get_memory_stats()
        
        return {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "memory": memory_stats,
            "message": "Memory statistics retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Failed to get memory stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get memory statistics: {str(e)}")


@router.post("/memory/cleanup")
async def force_memory_cleanup(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
):
    """Force emergency memory cleanup (admin operation)"""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    
    try:
        from .core.memory_manager import emergency_cleanup
        
        # Get memory before cleanup
        before_stats = get_memory_stats()
        before_mb = before_stats.get('process', {}).get('rss_mb', 0)
        
        # Force cleanup
        cleanup_success = emergency_cleanup()
        
        # Get memory after cleanup
        after_stats = get_memory_stats()
        after_mb = after_stats.get('process', {}).get('rss_mb', 0)
        
        memory_freed = before_mb - after_mb
        
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            "cleanup_success": cleanup_success,
            "memory_freed_mb": round(memory_freed, 2),
            "memory_before_mb": round(before_mb, 2),
            "memory_after_mb": round(after_mb, 2),
            "message": f"Emergency cleanup completed. Freed {memory_freed:.1f}MB of memory."
        }
    except Exception as e:
        logger.error(f"Emergency cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Emergency cleanup failed: {str(e)}")
