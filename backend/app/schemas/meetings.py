"""Meeting-related Pydantic models"""

from typing import List, Optional
from pydantic import BaseModel


class MeetingResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    transcription: Optional[str]
    summary: Optional[str]
    duration: Optional[float]
    language: Optional[str] = "auto"
    tags: Optional[List[str]] = []


class UpdateMeetingRequest(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None


class StartMeetingRequest(BaseModel):
    title: str
    language: str = "auto"  # "tr", "en", or "auto"
    tags: Optional[List[str]] = []


class StartMeetingResponse(BaseModel):
    meeting_id: str
    job_id: str
    message: str
    language: str


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
    language: Optional[str] = "auto"
    has_transcription: bool
    has_summary: bool
    tags: Optional[List[str]] = []
