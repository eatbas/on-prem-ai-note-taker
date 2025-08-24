"""Queue management API endpoints"""

import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Header, Depends

from ..schemas.summarization import SummarizeRequest
from ..core.config import settings
from ..core.utils import require_basic_auth
from ..workers.queue_manager import queue_manager

router = APIRouter(prefix="/api/queue", tags=["queue"])
logger = logging.getLogger(__name__)


@router.post("/transcribe")
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
        raise HTTPException(
            status_code=413, 
            detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB"
        )
    
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


@router.post("/summarize")
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


@router.get("/task/{task_id}/status")
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


@router.get("/task/{task_id}/result")
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
        raise HTTPException(
            status_code=202, 
            detail=f"Task not completed, current status: {status.get('status')}"
        )
    
    result = await queue_manager.get_task_result(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task result not found")
    
    return result


@router.get("/stats")
async def admin_get_queue_stats(
    _auth: None = Depends(require_basic_auth),
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
