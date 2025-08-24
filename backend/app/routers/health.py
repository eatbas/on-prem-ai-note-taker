"""Health check endpoints"""

from typing import Any, Dict
from fastapi import APIRouter

from ..core.config import settings
from ..clients.ollama_client import OllamaClient

router = APIRouter(prefix="/api", tags=["health"])

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


@router.get("/health")
def health() -> Dict[str, Any]:
    """Basic health check with system information"""
    return {
        "status": "ok",
        "whisper_model": settings.whisper_model_name,
        "ollama_model": settings.ollama_model,
        "allowed_languages": settings.allowed_languages,
        "vps_optimizations": {
            "whisper_device": settings.whisper_device,
            "whisper_cpu_threads": settings.whisper_cpu_threads,
            "ollama_cpu_threads": settings.ollama_cpu_threads
        }
    }


@router.get("/vps/health")
def vps_health() -> Dict[str, Any]:
    """Return connectivity status for remote Ollama VPS."""
    ollama = _ollama_client.check_health()
    return {"ollama": ollama, "base_url": settings.ollama_base_url}
