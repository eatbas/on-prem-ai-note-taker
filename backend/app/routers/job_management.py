"""Job management API endpoints"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Depends, Query
from fastapi.responses import StreamingResponse

from ..schemas.jobs import JobSubmitRequest, JobSubmitResponse, JobStatusResponse, JobCancelResponse
from ..core.config import settings
from ..database import get_db
from ..models import JobType, JobStatus
from ..workers.job_manager import job_manager
from ..core.utils import require_basic_auth

router = APIRouter(prefix="/api/jobs", tags=["job_management"])
logger = logging.getLogger(__name__)


@router.post("/submit", response_model=JobSubmitResponse)
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


@router.get("/{job_id}/status", response_model=JobStatusResponse)
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


@router.post("/{job_id}/cancel", response_model=JobCancelResponse)
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


@router.get("/{job_id}/stream")
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
        raise HTTPException(
            status_code=400, 
            detail="User ID required (either X-User-Id header or user_id query parameter)"
        )
    
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
