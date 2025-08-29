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
    workspace_id: Optional[int] = None
    is_personal: bool = True


class UpdateMeetingRequest(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None


class StartMeetingRequest(BaseModel):
    title: str
    language: str = "auto"  # "tr", "en", or "auto"
    tags: Optional[List[str]] = []
    scope: str = "personal"  # "personal" or "workspace"


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
    workspace_id: Optional[int] = None
    workspace_name: Optional[str] = None


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
    workspace_id: Optional[int] = None
    workspace_name: Optional[str] = None
    is_personal: bool = True


class UserWorkspaceAssignmentRequest(BaseModel):
    """Schema for assigning a user to a workspace"""
    workspace_id: Optional[int] = None  # None to remove workspace assignment
