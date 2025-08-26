"""Summarization-related Pydantic models"""

from typing import Optional
from pydantic import BaseModel


class SummarizeRequest(BaseModel):
    text: str
    model: Optional[str] = None
    language: Optional[str] = None  # 'tr' | 'en' | 'auto' (optional)


class SummarizeResponse(BaseModel):
    summary: str
