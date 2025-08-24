"""Job-related Pydantic models"""

from typing import Any, Dict, Optional
from pydantic import BaseModel


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
