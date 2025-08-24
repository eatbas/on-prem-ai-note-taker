"""
Utility functions for the AI Note Taker backend.
This module contains shared functions to avoid circular imports.
"""

import logging
from typing import Optional
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets
from .config import settings
from faster_whisper import WhisperModel

logger = logging.getLogger("on_prem_note_taker")

# Initialize security for basic auth
security = HTTPBasic()


def require_basic_auth(credentials: HTTPBasicCredentials = Depends(security)) -> None:
    """Enforce HTTP Basic auth if username/password are set in settings.
    If not set, auth is disabled and the request is allowed."""
    if not settings.basic_auth_username or not settings.basic_auth_password:
        return None
    if not credentials:
        raise HTTPException(status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"})
    is_user_ok = secrets.compare_digest(credentials.username or "", settings.basic_auth_username)
    is_pass_ok = secrets.compare_digest(credentials.password or "", settings.basic_auth_password)
    if not (is_user_ok and is_pass_ok):
        raise HTTPException(status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"})
    return None


def get_whisper_model() -> WhisperModel:
    """Get or create the Whisper model instance."""
    try:
        # Initialize Whisper model with VPS optimizations
        model = WhisperModel(
            settings.whisper_model_name,  # First positional argument is the model name
            compute_type=settings.whisper_compute_type,
            device=settings.whisper_device,
            cpu_threads=settings.whisper_cpu_threads,
            memory_limit_gb=settings.whisper_memory_limit_gb,
            download_root=settings.whisper_download_root,
            local_files_only=False,
            beam_size=settings.whisper_beam_size,
            # Enable speaker identification
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=100
            )
        )
        logger.info(f"Whisper model {settings.whisper_model_name} loaded successfully")
        return model
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load Whisper model: {e}")


def validate_language(language: Optional[str]) -> str:
    """Validate and normalize language code."""
    if not language or language == "auto":
        return "auto"
    
    # Normalize language codes
    language = language.lower().strip()
    
    # Check if language is in allowed list
    if language in settings.allowed_languages:
        return language
    
    # Try to map common variations
    language_mapping = {
        "turkish": "tr",
        "türkçe": "tr",
        "english": "en",
        "ingilizce": "en",
        "auto": "auto"
    }
    
    if language in language_mapping:
        mapped_language = language_mapping[language]
        if mapped_language in settings.allowed_languages:
            return mapped_language
    
    # If strict validation is enabled, reject invalid languages
    if settings.force_language_validation:
        allowed_str = ", ".join(settings.allowed_languages)
        raise HTTPException(
            status_code=400, 
            detail=f"Language '{language}' not supported. Allowed languages: {allowed_str}"
        )
    
    # Fallback to auto if validation is not strict
    logger.warning(f"Unsupported language '{language}', falling back to auto-detect")
    return "auto"
