"""Chat API endpoints for talking to Llama"""

import logging
from fastapi import APIRouter, HTTPException

from ..schemas.chat import ChatRequest, ChatResponse
from ..core.config import settings
from ..clients.ollama_client import OllamaClient

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Ask Llama any question"""
    logger.info(f"Chat request received: prompt_length={len(req.prompt)}, model={req.model}")
    try:
        response_text = _ollama_client.generate(req.prompt, model=req.model)
        logger.info(f"Chat response generated: response_length={len(response_text)}")
        return ChatResponse(response=response_text)
    except Exception as e:
        logger.error(f"Chat request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")
