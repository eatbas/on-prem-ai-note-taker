"""Progress tracking API endpoints"""

import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Header, Depends

from ..workers.progress import job_store
from ..core.utils import require_basic_auth

router = APIRouter(prefix="/api/progress", tags=["progress"])
logger = logging.getLogger(__name__)


@router.get("/{job_id}")
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


@router.post("/{job_id}/cancel")
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


@router.get("/stats")
async def get_progress_stats(
    _auth: None = Depends(require_basic_auth),
) -> Dict[str, Any]:
    """Get progress store statistics"""
    return job_store.get_stats()
