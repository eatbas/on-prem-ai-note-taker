"""
whisper.cpp HTTP client for the Python backend
Replaces faster-whisper with HTTP calls to whisper.cpp service
"""

import asyncio
import httpx
import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, AsyncGenerator, Tuple
import tempfile
import time

from ..core.config import settings

logger = logging.getLogger(__name__)

class WhisperCppClient:
    """
    HTTP client for whisper.cpp service
    Provides compatibility with faster-whisper API
    """
    
    def __init__(self, base_url: Optional[str] = None):
        """Initialize whisper.cpp client"""
        self.base_url = base_url or os.getenv("WHISPER_CPP_URL", "http://whisper-cpp:8001")
        self.timeout = httpx.Timeout(300.0)  # 5 minutes timeout for transcription
        
        # Model mapping from faster-whisper to whisper.cpp
        self.model_mapping = {
            "tiny": "tiny.en",
            "base": "base.en", 
            "small": "small.en",
            "medium": "medium.en",
            "large-v2": "large-v2",
            "large-v3": "large-v3"
        }
        
        logger.info(f"🎙️ Initialized whisper.cpp client: {self.base_url}")
    
    async def health_check(self) -> bool:
        """Check if whisper.cpp service is healthy"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception as e:
            logger.error(f"whisper.cpp health check failed: {e}")
            return False
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List available models from whisper.cpp service"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/models")
                response.raise_for_status()
                return response.json()["models"]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
    
    async def transcribe(
        self, 
        audio_path: Union[str, Path],
        model_name: str = "base.en",
        language: Optional[str] = None,
        beam_size: int = 5,
        word_timestamps: bool = True,
        temperature: float = 0.0,
        best_of: int = 5,
        condition_on_previous_text: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Transcribe audio file using whisper.cpp service
        
        Compatible with faster-whisper transcribe() method
        """
        
        start_time = time.time()
        
        # Map model name to whisper.cpp format
        mapped_model = self.model_mapping.get(model_name, model_name)
        
        logger.info(f"🎙️ Starting transcription: {audio_path} with model {mapped_model}")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Prepare form data
                with open(audio_path, 'rb') as audio_file:
                    files = {'audio': ('audio.wav', audio_file, 'audio/wav')}
                    data = {
                        'model': mapped_model,
                        'language': language or '',
                        'beam_size': str(beam_size),
                        'word_timestamps': str(word_timestamps).lower(),
                        'temperature': str(temperature),
                        'best_of': str(best_of),
                        'condition_on_previous_text': str(condition_on_previous_text).lower()
                    }
                    
                    # Make transcription request
                    response = await client.post(
                        f"{self.base_url}/transcribe",
                        files=files,
                        data=data
                    )
                    response.raise_for_status()
                    
                    result = response.json()
                    
                    processing_time = time.time() - start_time
                    logger.info(f"✅ Transcription completed in {processing_time:.2f}s")
                    
                    # Add processing time to result
                    result['processing_time'] = processing_time
                    
                    return result
                    
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during transcription: {e}")
            raise Exception(f"whisper.cpp transcription failed: {e}")
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            raise Exception(f"Transcription failed: {e}")
    
    def transcribe_generator(
        self,
        audio_path: Union[str, Path], 
        model_name: str = "base.en",
        **kwargs
    ) -> AsyncGenerator[Tuple[Dict[str, Any], Dict[str, Any]], None]:
        """
        Generator version for compatibility with faster-whisper
        Since whisper.cpp doesn't stream, we return the full result once
        """
        async def _generator():
            result = await self.transcribe(audio_path, model_name, **kwargs)
            
            # Convert to generator format expected by existing code
            segments = result.get('segments', [])
            info = {
                'language': result.get('language', 'en'),
                'duration': result.get('duration', 0.0),
                'processing_time': result.get('processing_time', 0.0)
            }
            
            # Yield each segment
            for segment in segments:
                yield segment, info
        
        return _generator()

class WhisperCppModel:
    """
    Model wrapper for compatibility with faster-whisper API
    This allows existing code to work with minimal changes
    """
    
    def __init__(
        self,
        model_size_or_path: str,
        device: str = "cpu",
        device_index: int = 0,
        compute_type: str = "int8",
        cpu_threads: int = 4,
        **kwargs
    ):
        """Initialize model wrapper"""
        self.model_name = model_size_or_path
        self.device = device
        self.compute_type = compute_type
        self.cpu_threads = cpu_threads
        
        # Initialize the HTTP client
        self.client = WhisperCppClient()
        
        logger.info(f"🎙️ Initialized whisper.cpp model wrapper: {model_size_or_path}")
    
    async def transcribe(
        self,
        audio: Union[str, Path],
        beam_size: int = 5,
        best_of: int = 5,
        patience: float = 1.0,
        length_penalty: float = 1.0,
        repetition_penalty: float = 1.0,
        no_repeat_ngram_size: int = 0,
        temperature: Union[float, List[float]] = 0.0,
        compression_ratio_threshold: float = 2.4,
        log_prob_threshold: float = -1.0,
        no_speech_threshold: float = 0.6,
        condition_on_previous_text: bool = True,
        prompt_reset_on_temperature: float = 0.5,
        initial_prompt: Optional[str] = None,
        prefix: Optional[str] = None,
        suppress_blank: bool = True,
        suppress_tokens: Optional[List[int]] = None,
        without_timestamps: bool = False,
        max_initial_timestamp: float = 1.0,
        word_timestamps: bool = False,
        prepend_punctuations: str = "\"'"¿([{-",
        append_punctuations: str = "\"'.。,，!！?？:：")]}、",
        vad_filter: bool = False,
        vad_parameters: Optional[Dict[str, Any]] = None,
        language: Optional[str] = None,
        **kwargs
    ):
        """
        Transcribe audio - compatible with faster-whisper API
        """
        
        # Handle temperature parameter (can be float or list)
        if isinstance(temperature, list):
            temperature = temperature[0] if temperature else 0.0
        
        # Call the HTTP client
        result = await self.client.transcribe(
            audio_path=audio,
            model_name=self.model_name,
            language=language,
            beam_size=beam_size,
            word_timestamps=word_timestamps or not without_timestamps,
            temperature=temperature,
            best_of=best_of,
            condition_on_previous_text=condition_on_previous_text
        )
        
        # Convert to expected format
        segments = result.get('segments', [])
        info = {
            'language': result.get('language', 'en'),
            'language_probability': 1.0,
            'duration': result.get('duration', 0.0),
            'all_language_probs': None
        }
        
        # Create generator-like response
        return segments, info

# Global client instance
_whisper_cpp_client = None

def get_whisper_cpp_client() -> WhisperCppClient:
    """Get global whisper.cpp client instance"""
    global _whisper_cpp_client
    if _whisper_cpp_client is None:
        _whisper_cpp_client = WhisperCppClient()
    return _whisper_cpp_client

def load_model(
    model_size_or_path: str,
    device: str = "cpu", 
    device_index: int = 0,
    compute_type: str = "int8",
    cpu_threads: int = 4,
    **kwargs
) -> WhisperCppModel:
    """
    Load model - compatible with faster-whisper API
    Returns a model wrapper that uses whisper.cpp HTTP service
    """
    return WhisperCppModel(
        model_size_or_path=model_size_or_path,
        device=device,
        device_index=device_index, 
        compute_type=compute_type,
        cpu_threads=cpu_threads,
        **kwargs
    )
