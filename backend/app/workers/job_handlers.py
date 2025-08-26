"""Job handler functions extracted from main.py"""

import json
import tempfile
import os
import logging
from typing import Any, Dict

from ..database import Job
from .job_manager import JobProgressTracker, JobPhase
from ..core.config import settings
from ..clients.ollama_client import OllamaClient
from ..core.prompts import get_single_summary_prompt
from ..core.utils import get_whisper_model, validate_language

logger = logging.getLogger(__name__)

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)


# Task handlers for the queue system
async def handle_transcription_task(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle transcription task from queue"""
    # This is a simplified version - in a real implementation, you'd need to
    # handle file storage and retrieval from the queue data
    # For now, we'll just return a placeholder
    return {"status": "transcription_completed", "text": "Queued transcription result"}


async def handle_summarization_task(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle summarization task from queue"""
    text = data.get("text", "")
    model = data.get("model")
    
    # Optional language inside data
    language = data.get("language") if isinstance(data, dict) else None
    try:
        from ..core.utils import validate_language as _validate_language
        validated_language = _validate_language(language)
    except Exception:
        validated_language = "auto"
    
    # Improved language selection: prioritize Turkish for better local support
    if validated_language in ("tr", "en"):
        lang_code = validated_language
    else:
        # Default to Turkish for auto/unknown languages
        lang_code = "tr"
    prompt = get_single_summary_prompt(lang_code).format(transcript=text)
    summary = _ollama_client.generate(
        prompt,
        model=model,
        options={
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 10,
            "num_predict": 300,
        },
    )
    return {"summary": summary}


async def handle_transcribe_and_summarize_task(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle combined transcription and summarization task from queue"""
    # This would need to be implemented with proper file handling
    return {"status": "transcribe_and_summarize_completed"}


# Job Handler Functions for Job Manager
async def handle_transcription_job(job: Job, progress_tracker: JobProgressTracker) -> Dict[str, Any]:
    """Handle transcription job with progress tracking"""
    input_data = json.loads(job.input_data)
    file_content = bytes.fromhex(input_data["file_content"])
    file_name = input_data["file_name"]
    language = input_data.get("language")
    vad_filter = input_data.get("vad_filter", True)
    
    # Validate language
    validated_language = validate_language(language)
    
    # Update progress
    progress_tracker.update_progress(10, JobPhase.INITIALIZING, 100, "Processing audio file")
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name
    
    try:
        # Get model
        model = get_whisper_model()
        progress_tracker.update_progress(20, JobPhase.TRANSCRIBING, 0, "Starting transcription")
        
        # Transcribe with configured quality settings
        segments, info = model.transcribe(
            tmp_path,
            language=validated_language if validated_language != "auto" else None,
            vad_filter=vad_filter,
            vad_parameters=dict(
                min_silence_duration_ms=settings.whisper_vad_min_silence_ms,
                speech_pad_ms=settings.whisper_vad_speech_pad_ms
            ),
            beam_size=settings.whisper_beam_size,
            best_of=settings.whisper_best_of,
            temperature=settings.whisper_temperature,
            condition_on_previous_text=settings.whisper_condition_on_previous_text,
            word_timestamps=settings.whisper_word_timestamps,
            initial_prompt=settings.whisper_initial_prompt,
            compression_ratio_threshold=settings.whisper_compression_ratio_threshold,
            log_prob_threshold=settings.whisper_log_prob_threshold
        )
        
        # Process segments with progress updates
        segments_out = []
        text_parts = []
        segment_count = 0
        
        for s in segments:
            text_cleaned = s.text.strip()
            if text_cleaned:
                segments_out.append({
                    "start": float(s.start),
                    "end": float(s.end),
                    "text": text_cleaned
                })
                text_parts.append(text_cleaned)
            
            segment_count += 1
            # Update progress every 10 segments
            if segment_count % 10 == 0:
                phase_progress = min(90, 20 + (segment_count * 70 / max(1, len(segments))))
                progress_tracker.update_progress(
                    phase_progress, 
                    JobPhase.TRANSCRIBING, 
                    segment_count / max(1, len(segments)) * 100,
                    f"Transcribed {segment_count} segments"
                )
        
        progress_tracker.update_progress(100, JobPhase.FINALIZING, 100, "Transcription completed")
        
        return {
            "language": info.language if hasattr(info, "language") else None,
            "duration": info.duration if hasattr(info, "duration") else None,
            "text": "\n".join(text_parts).strip(),
            "segments": segments_out
        }
        
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


async def handle_summarization_job(job: Job, progress_tracker: JobProgressTracker) -> Dict[str, Any]:
    """Handle summarization job with progress tracking"""
    input_data = json.loads(job.input_data)
    text = input_data["text"]
    model = input_data.get("model")
    
    progress_tracker.update_progress(10, JobPhase.INITIALIZING, 100, "Preparing summarization")
    
    progress_tracker.update_progress(50, JobPhase.SUMMARIZING, 0, "Generating summary")
    
    # Use English by default here (no language provided in job schema)
    prompt = get_single_summary_prompt("en").format(transcript=text)
    summary = _ollama_client.generate(
        prompt,
        model=model,
        options={
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 10,
            "num_predict": 300,
        },
    )
    
    progress_tracker.update_progress(100, JobPhase.FINALIZING, 100, "Summary completed")
    
    return {"summary": summary}


async def handle_transcribe_and_summarize_job(job: Job, progress_tracker: JobProgressTracker) -> Dict[str, Any]:
    """Handle combined transcription and summarization job"""
    # First transcribe
    transcription_result = await handle_transcription_job(job, progress_tracker)
    
    # Then summarize
    progress_tracker.update_progress(80, JobPhase.SUMMARIZING, 0, "Generating summary from transcript")
    
    summary_result = await handle_summarization_job(job, progress_tracker)
    
    progress_tracker.update_progress(100, JobPhase.FINALIZING, 100, "Transcription and summarization completed")
    
    return {
        "transcript": transcription_result,
        "summary": summary_result["summary"]
    }
