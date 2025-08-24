"""Transcription-related Pydantic models"""

from typing import List, Optional
from pydantic import BaseModel


class TranscriptionSegment(BaseModel):
    start: float
    end: float
    text: str


class TranscriptionResponse(BaseModel):
    language: Optional[str]
    duration: Optional[float]
    text: str
    segments: List[TranscriptionSegment]


class TranscribeAndSummarizeResponse(BaseModel):
    transcript: TranscriptionResponse
    summary: str
