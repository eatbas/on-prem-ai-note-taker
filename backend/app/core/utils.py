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
        # 🚀 STAGE 1 OPTIMIZATION: Ensure CPU-compatible settings for VPS
        compute_type = settings.whisper_compute_type
        device = settings.whisper_device
        
        # FAILSAFE: Force CPU-compatible settings if float16 fails
        if device == "cpu" and compute_type not in ["int8", "float32"]:
            logger.warning(f"Forcing compute_type from {compute_type} to 'int8' for CPU device")
            compute_type = "int8"
        
        logger.info(f"Loading Whisper model: {settings.whisper_model_name} with device={device}, compute_type={compute_type}")
        
        # Initialize Whisper model with VPS optimizations
        # Note: beam_size, word_timestamps, vad_filter are transcribe() parameters, not constructor parameters
        model = WhisperModel(
            settings.whisper_model_name,  # First positional argument is the model name
            compute_type=compute_type,
            device=device,
            cpu_threads=settings.whisper_cpu_threads,
            download_root=settings.whisper_download_root,
            local_files_only=False
        )
        logger.info(f"✅ Whisper model {settings.whisper_model_name} loaded successfully with device={device}, compute_type={compute_type}")
        return model
    except Exception as e:
        # 🚀 FAILSAFE: Try alternative compute types for CPU compatibility
        if "float16" in str(e) and device == "cpu":
            logger.warning(f"Float16 failed, trying CPU-compatible alternatives: {e}")
            
            for fallback_compute_type in ["int8", "float32"]:
                try:
                    logger.info(f"🔄 Attempting fallback with compute_type={fallback_compute_type}")
                    model = WhisperModel(
                        settings.whisper_model_name,
                        compute_type=fallback_compute_type,
                        device="cpu",
                        cpu_threads=settings.whisper_cpu_threads,
                        download_root=settings.whisper_download_root,
                        local_files_only=False
                    )
                    logger.info(f"✅ FALLBACK SUCCESS: Whisper model loaded with compute_type={fallback_compute_type}")
                    return model
                except Exception as fallback_error:
                    logger.warning(f"❌ Fallback {fallback_compute_type} failed: {fallback_error}")
                    continue
        
        logger.error(f"❌ CRITICAL: All Whisper model loading attempts failed: {e}")
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
