"""Chat-related Pydantic models"""

from typing import Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
