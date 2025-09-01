"""Pydantic schemas for API requests and responses"""

from .transcription import (
    TranscriptionSegment,
    TranscriptionResponse,
    TranscribeAndSummarizeResponse,
)
from .summarization import (
    SummarizeRequest,
    SummarizeResponse,
)
from .jobs import (
    JobSubmitRequest,
    JobSubmitResponse,
    JobStatusResponse,
    JobCancelResponse,
)
from .meetings import (
    MeetingResponse,
    UpdateMeetingRequest,
    StartMeetingRequest,
    StartMeetingResponse,
    AdminUserResponse,
    AdminMeetingResponse,
    UserWorkspace,
)
from .chat import (
    ChatRequest,
    ChatResponse,
)

__all__ = [
    # Transcription schemas
    "TranscriptionSegment",
    "TranscriptionResponse", 
    "TranscribeAndSummarizeResponse",
    # Summarization schemas
    "SummarizeRequest",
    "SummarizeResponse",
    # Job schemas
    "JobSubmitRequest",
    "JobSubmitResponse",
    "JobStatusResponse",
    "JobCancelResponse",
    # Meeting schemas
    "MeetingResponse",
    "UpdateMeetingRequest",
    "StartMeetingRequest",
    "StartMeetingResponse",
    "AdminUserResponse",
    "AdminMeetingResponse",
    "UserWorkspace",
    # Chat schemas
    "ChatRequest",
    "ChatResponse",
]