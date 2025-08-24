"""Core utilities and configuration"""

from .config import settings
from .utils import get_whisper_model, validate_language, require_basic_auth
from .audio_utils import get_audio_duration, split_audio_into_chunks, cleanup_chunk_files
from .prompts import get_chunk_prompt, get_merge_prompt
from .deps import *

__all__ = [
    "settings",
    "get_whisper_model",
    "validate_language", 
    "require_basic_auth",
    "get_audio_duration",
    "split_audio_into_chunks",
    "cleanup_chunk_files",
    "get_chunk_prompt",
    "get_merge_prompt",
]
