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


def get_whisper_model(model_config: dict = None) -> WhisperModel:
    """
    Get or create the Whisper model instance with memory management and optimization.
    
    Args:
        model_config: Optional configuration from WhisperOptimizer for optimal settings
    """
    from .memory_manager import memory_manager
    
    try:
        # 🚨 PHASE 3.1: Check memory pressure before loading model
        memory_info = memory_manager.get_memory_usage()
        current_mb = memory_info.get('process', {}).get('rss_mb', 0)
        
        logger.info(f"💾 Current memory usage: {current_mb:.1f}MB before Whisper model loading")
        
        # Force cleanup if memory pressure is detected
        if memory_manager.check_memory_pressure():
            logger.warning("🧹 Memory pressure detected, forcing cleanup before model load...")
            memory_manager.cleanup_whisper_model(force=True)
        
        # 🚨 PHASE 3.5: Use optimized configuration if provided
        if model_config:
            model_size = model_config.get('model_size', settings.whisper_model_name)
            compute_type = model_config.get('compute_type', settings.whisper_compute_type)
            device = model_config.get('device', settings.whisper_device)
            cpu_threads = model_config.get('cpu_threads', settings.whisper_cpu_threads)
            
            logger.info(f"🎯 Using optimized Whisper configuration: {model_size} "
                       f"(compute_type={compute_type}, threads={cpu_threads})")
        else:
            # Fallback to settings configuration
            model_size = settings.whisper_model_name
            compute_type = settings.whisper_compute_type
            device = settings.whisper_device
            cpu_threads = settings.whisper_cpu_threads
        
        # FAILSAFE: Force CPU-compatible settings if float16 fails
        if device == "cpu" and compute_type not in ["int8", "float32"]:
            logger.warning(f"Forcing compute_type from {compute_type} to 'int8' for CPU device")
            compute_type = "int8"
        
        logger.info(f"Loading Whisper model: {model_size} with device={device}, compute_type={compute_type}")
        
        # Initialize Whisper model with VPS optimizations
        # Note: beam_size, word_timestamps, vad_filter are transcribe() parameters, not constructor parameters
        model = WhisperModel(
            model_size,  # Use optimized model size
            compute_type=compute_type,
            device=device,
            cpu_threads=cpu_threads,
            download_root=settings.whisper_download_root,
            local_files_only=False
        )
        
        # 🚨 PHASE 3.1: Register model with memory manager for cleanup tracking
        memory_manager.register_whisper_model(model)
        
        # Log memory usage after model loading
        after_memory = memory_manager.get_memory_usage()
        after_mb = after_memory.get('process', {}).get('rss_mb', 0)
        model_memory_mb = after_mb - current_mb
        
        logger.info(f"✅ Whisper model {model_size} loaded successfully")
        logger.info(f"💾 Memory usage after loading: {after_mb:.1f}MB (model used ~{model_memory_mb:.1f}MB)")
        
        return model
        
    except Exception as e:
        # 🚀 FAILSAFE: Try alternative compute types for CPU compatibility
        if "float16" in str(e) and device == "cpu":
            logger.warning(f"Float16 failed, trying CPU-compatible alternatives: {e}")
            
            for fallback_compute_type in ["int8", "float32"]:
                try:
                    logger.info(f"🔄 Attempting fallback with compute_type={fallback_compute_type}")
                    
                    # Force cleanup before retry
                    memory_manager.cleanup_whisper_model(force=True)
                    
                    model = WhisperModel(
                        settings.whisper_model_name,
                        compute_type=fallback_compute_type,
                        device="cpu",
                        cpu_threads=settings.whisper_cpu_threads,
                        download_root=settings.whisper_download_root,
                        local_files_only=False
                    )
                    
                    # Register fallback model
                    memory_manager.register_whisper_model(model)
                    
                    logger.info(f"✅ FALLBACK SUCCESS: Whisper model loaded with compute_type={fallback_compute_type}")
                    return model
                except Exception as fallback_error:
                    logger.warning(f"❌ Fallback {fallback_compute_type} failed: {fallback_error}")
                    continue
        
        # Force cleanup on failure
        memory_manager.cleanup_whisper_model(force=True)
        
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
