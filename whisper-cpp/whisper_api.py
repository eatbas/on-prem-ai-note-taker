#!/usr/bin/env python3
"""
HTTP API wrapper for whisper.cpp
Provides REST API compatible with the existing Python backend
"""

import asyncio
import json
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="whisper.cpp API", version="1.0.0")

# Configuration
WHISPER_CPP_PATH = "/app/whisper.cpp"
MODELS_DIR = "/app/models"
TEMP_DIR = "/tmp/whisper_api"

# Ensure temp directory exists
os.makedirs(TEMP_DIR, exist_ok=True)

# Available models mapping
AVAILABLE_MODELS = {
    "tiny": "ggml-tiny.bin",
    "tiny.en": "ggml-tiny.en.bin", 
    "base": "ggml-base.bin",
    "base.en": "ggml-base.en.bin",
    "small": "ggml-small.bin",
    "small.en": "ggml-small.en.bin",
    "medium": "ggml-medium.bin",
    "medium.en": "ggml-medium.en.bin",
    "large": "ggml-large-v1.bin",
    "large-v2": "ggml-large-v2.bin",
    "large-v3": "ggml-large-v3.bin"
}

class WhisperCppAPI:
    """HTTP API wrapper for whisper.cpp binary"""
    
    def __init__(self):
        self.whisper_binary = f"{WHISPER_CPP_PATH}/main"
        self._validate_setup()
    
    def _validate_setup(self):
        """Validate whisper.cpp setup"""
        if not os.path.exists(self.whisper_binary):
            raise RuntimeError(f"whisper.cpp binary not found at {self.whisper_binary}")
        
        # Check for available models
        available_models = []
        for model_name, model_file in AVAILABLE_MODELS.items():
            model_path = f"{MODELS_DIR}/{model_file}"
            if os.path.exists(model_path):
                available_models.append(model_name)
        
        if not available_models:
            raise RuntimeError("No whisper models found")
        
        logger.info(f"✅ whisper.cpp setup validated. Available models: {available_models}")
    
    async def transcribe(
        self,
        audio_file: UploadFile,
        model: str = "base.en",
        language: Optional[str] = None,
        beam_size: int = 5,
        word_timestamps: bool = True,
        temperature: float = 0.0,
        best_of: int = 5,
        condition_on_previous_text: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Transcribe audio using whisper.cpp
        Compatible with faster-whisper API format
        """
        
        start_time = time.time()
        
        # Validate model
        if model not in AVAILABLE_MODELS:
            raise HTTPException(
                status_code=400, 
                detail=f"Model '{model}' not available. Available: {list(AVAILABLE_MODELS.keys())}"
            )
        
        model_path = f"{MODELS_DIR}/{AVAILABLE_MODELS[model]}"
        if not os.path.exists(model_path):
            raise HTTPException(
                status_code=404,
                detail=f"Model file not found: {model_path}"
            )
        
        # Save uploaded file
        temp_audio_path = None
        temp_output_path = None
        
        try:
            # Create temporary files
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav", dir=TEMP_DIR) as temp_audio:
                temp_audio_path = temp_audio.name
                content = await audio_file.read()
                temp_audio.write(content)
            
            # Create temporary output file
            temp_output_path = f"{temp_audio_path}.txt"
            
            # Build whisper.cpp command
            cmd = [
                self.whisper_binary,
                "-m", model_path,
                "-f", temp_audio_path,
                "--output-txt",
                "--output-file", temp_output_path,
                "--threads", str(min(6, os.cpu_count() or 4)),
            ]
            
            # Add optional parameters
            if language:
                cmd.extend(["-l", language])
            
            if word_timestamps:
                cmd.append("--print-realtime")
                cmd.append("--word-timestamps")
            
            if beam_size > 1:
                cmd.extend(["--beam-size", str(beam_size)])
            
            if temperature > 0:
                cmd.extend(["--temperature", str(temperature)])
            
            # Run whisper.cpp
            logger.info(f"🎙️ Starting transcription with model: {model}")
            logger.debug(f"Command: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(f"whisper.cpp failed: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Transcription failed: {error_msg}")
            
            # Read output
            output_file = f"{temp_output_path}.txt"
            if not os.path.exists(output_file):
                raise HTTPException(status_code=500, detail="Output file not generated")
            
            with open(output_file, 'r', encoding='utf-8') as f:
                transcript_text = f.read().strip()
            
            # Parse stdout for additional info (if available)
            stdout_text = stdout.decode() if stdout else ""
            
            processing_time = time.time() - start_time
            
            # Format response compatible with faster-whisper
            response = {
                "text": transcript_text,
                "segments": self._parse_segments(stdout_text),
                "language": language or "auto-detected",
                "duration": self._estimate_duration(audio_file),
                "processing_time": processing_time,
                "model": model,
                "word_timestamps": word_timestamps
            }
            
            logger.info(f"✅ Transcription completed in {processing_time:.2f}s")
            return response
            
        finally:
            # Cleanup temporary files
            for temp_file in [temp_audio_path, temp_output_path, f"{temp_output_path}.txt"]:
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.unlink(temp_file)
                    except Exception as e:
                        logger.warning(f"Failed to cleanup {temp_file}: {e}")
    
    def _parse_segments(self, stdout: str) -> List[Dict[str, Any]]:
        """Parse segments from whisper.cpp output"""
        segments = []
        
        # Simple segment parsing - whisper.cpp outputs timestamps in stdout
        # This is a basic implementation - enhance based on actual output format
        lines = stdout.split('\n')
        for line in lines:
            if '[' in line and ']' in line and '-->' in line:
                # Parse timestamp format: [00:00:00.000 --> 00:00:05.000] text
                try:
                    parts = line.split(']')
                    if len(parts) >= 2:
                        timestamp_part = parts[0].strip('[')
                        text_part = parts[1].strip()
                        
                        if '-->' in timestamp_part:
                            start_str, end_str = timestamp_part.split('-->')
                            start_time = self._parse_timestamp(start_str.strip())
                            end_time = self._parse_timestamp(end_str.strip())
                            
                            segments.append({
                                "start": start_time,
                                "end": end_time,
                                "text": text_part,
                                "words": []  # whisper.cpp word-level timestamps would need separate parsing
                            })
                except Exception as e:
                    logger.debug(f"Failed to parse segment: {line}, error: {e}")
                    continue
        
        return segments
    
    def _parse_timestamp(self, timestamp_str: str) -> float:
        """Convert timestamp string to seconds"""
        try:
            # Format: 00:00:05.000
            parts = timestamp_str.split(':')
            if len(parts) == 3:
                hours = float(parts[0])
                minutes = float(parts[1])
                seconds = float(parts[2])
                return hours * 3600 + minutes * 60 + seconds
        except:
            pass
        return 0.0
    
    def _estimate_duration(self, audio_file: UploadFile) -> float:
        """Estimate audio duration (simple implementation)"""
        # This is a placeholder - ideally use ffprobe or similar
        return 0.0

# Initialize API
whisper_api = WhisperCppAPI()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "whisper.cpp API", "version": "1.0.0"}

@app.get("/models")
async def list_models():
    """List available models"""
    available = []
    for model_name, model_file in AVAILABLE_MODELS.items():
        model_path = f"{MODELS_DIR}/{model_file}"
        if os.path.exists(model_path):
            available.append({
                "name": model_name,
                "file": model_file,
                "path": model_path,
                "size_mb": round(os.path.getsize(model_path) / 1024 / 1024, 1)
            })
    
    return {"models": available}

@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    model: str = Form("base.en"),
    language: Optional[str] = Form(None),
    beam_size: int = Form(5),
    word_timestamps: bool = Form(True),
    temperature: float = Form(0.0),
    best_of: int = Form(5),
    condition_on_previous_text: bool = Form(True)
):
    """
    Transcribe audio file
    Compatible with faster-whisper API
    """
    try:
        result = await whisper_api.transcribe(
            audio_file=audio,
            model=model,
            language=language,
            beam_size=beam_size,
            word_timestamps=word_timestamps,
            temperature=temperature,
            best_of=best_of,
            condition_on_previous_text=condition_on_previous_text
        )
        return JSONResponse(content=result)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Start the server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )
