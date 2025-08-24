"""Summarization-related Pydantic models"""

from typing import Optional
from pydantic import BaseModel


class SummarizeRequest(BaseModel):
    text: str
    model: Optional[str] = None


class SummarizeResponse(BaseModel):
    summary: str
