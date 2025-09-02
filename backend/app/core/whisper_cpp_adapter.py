"""
Adapter to seamlessly replace faster-whisper with whisper.cpp
This allows existing code to work without major refactoring
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Union, AsyncGenerator, Tuple

from ..clients.whisper_cpp_client import WhisperCppClient, WhisperCppModel, load_model
from .whisper_optimizer import get_whisper_optimizer

logger = logging.getLogger(__name__)

# Create async wrapper for the whisper.cpp client
async def create_whisper_model(
    model_size_or_path: str,
    device: str = "cpu",
    device_index: int = 0,
    compute_type: str = "int8", 
    cpu_threads: int = 4,
    **kwargs
) -> WhisperCppModel:
    """
    Create whisper.cpp model with async support
    Compatible with faster-whisper API
    """
    
    # Get optimal configuration from optimizer
    optimizer = get_whisper_optimizer()
    
    # For compatibility, we ignore some faster-whisper specific params
    logger.info(f"🎙️ Creating whisper.cpp model: {model_size_or_path}")
    
    model = load_model(
        model_size_or_path=model_size_or_path,
        device=device,
        device_index=device_index,
        compute_type=compute_type,
        cpu_threads=cpu_threads,
        **kwargs
    )
    
    # Test connectivity
    if hasattr(model, 'client'):
        healthy = await model.client.health_check()
        if not healthy:
            logger.warning("⚠️ whisper.cpp service health check failed")
    
    return model

class WhisperCppAdapter:
    """
    Adapter class to replace faster-whisper imports
    This maintains API compatibility while using whisper.cpp
    """
    
    @staticmethod
    def WhisperModel(*args, **kwargs):
        """
        Synchronous wrapper for WhisperCppModel creation
        For compatibility with existing synchronous code
        """
        return WhisperCppModel(*args, **kwargs)
    
    @staticmethod 
    async def WhisperModelAsync(*args, **kwargs):
        """
        Async wrapper for WhisperCppModel creation
        For new async code
        """
        return await create_whisper_model(*args, **kwargs)

# Export adapter for import replacement
WhisperModel = WhisperCppAdapter.WhisperModel

# For direct replacement in imports:
# from faster_whisper import WhisperModel
# becomes:
# from app.core.whisper_cpp_adapter import WhisperModel
