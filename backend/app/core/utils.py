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
from .whisper_cpp_adapter import WhisperModel

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


def get_whisper_model(model_config: dict = None) -> WhisperModel:
    """
    Get or create the whisper.cpp model instance with HTTP client optimization.
    
    Args:
        model_config: Optional configuration from WhisperOptimizer for optimal settings
    """
    from .memory_manager import memory_manager
    
    try:
        # 🚨 PHASE 3.1: Check memory pressure (less critical for whisper.cpp HTTP client)
        memory_info = memory_manager.get_memory_usage()
        current_mb = memory_info.get('process', {}).get('rss_mb', 0)
        
        logger.info(f"💾 Current memory usage: {current_mb:.1f}MB before whisper.cpp client setup")
        
        # 🚨 PHASE 3.5: Use optimized configuration if provided
        if model_config:
            model_name = model_config.get('model_name', settings.whisper_model_name)
            # whisper.cpp client doesn't use these parameters directly
            logger.info(f"🎯 Using optimized whisper.cpp configuration: {model_name}")
        else:
            # Fallback to settings configuration
            model_name = settings.whisper_model_name
        
        logger.info(f"Loading whisper.cpp client with model: {model_name}")
        
        # Initialize whisper.cpp model wrapper
        # This creates an HTTP client instead of loading model into memory
        model = WhisperModel(
            model_size_or_path=model_name,
            device="cpu",  # whisper.cpp service handles CPU optimization
            device_index=0,
            compute_type="int8",  # Handled by whisper.cpp service
            cpu_threads=settings.whisper_cpu_threads or 4
        )
        
        # 🚨 PHASE 3.1: Register model with memory manager (lightweight for HTTP client)
        memory_manager.register_whisper_model(model)
        
        # Log memory usage after client setup (should be minimal)
        after_memory = memory_manager.get_memory_usage()
        after_mb = after_memory.get('process', {}).get('rss_mb', 0)
        client_memory_mb = after_mb - current_mb
        
        logger.info(f"✅ whisper.cpp client initialized successfully")
        logger.info(f"💾 Memory usage after setup: {after_mb:.1f}MB (client used ~{client_memory_mb:.1f}MB)")
        
        return model
        
    except Exception as e:
        # Force cleanup on failure
        memory_manager.cleanup_whisper_model(force=True)
        
        logger.error(f"❌ CRITICAL: whisper.cpp client setup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize whisper.cpp client: {e}")


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
