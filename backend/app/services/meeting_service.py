"""Meeting business logic service"""

import json
import tempfile
import os
import uuid
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import HTTPException, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.user import get_or_create_user
from ..models import Meeting, Transcription, Summary, Speaker, SpeakerSegment
from ..core.utils import get_whisper_model, validate_language
from ..clients.ollama_client import OllamaClient
from ..core.prompts import get_single_summary_prompt
from ..workers.chunked_service import chunked_service
from ..workers.progress import job_store, Phase

logger = logging.getLogger(__name__)


class MeetingService:
    """Service for meeting-related business logic"""
    
    def __init__(self):
        self.ollama_client = OllamaClient(
            base_url=settings.ollama_base_url,
            default_model=settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
        )
    
    async def auto_process_meeting(
        self,
        file: UploadFile,
        language: str,
        title: str,
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """Automatically process a meeting recording with transcription and summarization"""
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="File must have a filename")
        
        # Read and validate file size
        content = await file.read()
        size_mb = len(content) / (1024 * 1024)
        if size_mb > settings.max_upload_mb:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB"
            )
        
        # Validate language
        try:
            validated_language = validate_language(language)
        except HTTPException as e:
            raise HTTPException(status_code=400, detail=str(e.detail))
        
        # Get or create user
        user = get_or_create_user(db)
        
        # Create meeting record
        meeting_id = str(uuid.uuid4())
        meeting = Meeting(
            id=meeting_id,
            user_id=user.id,
            title=title,
            language=validated_language,
            tags=json.dumps(["auto-processed"])
        )
        db.add(meeting)
        
        try:
            # Process the audio file directly
            model = get_whisper_model()
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=os.path.splitext(file.filename or "audio")[1]
            ) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            try:
                # Transcribe with configured quality settings
                segments, info = model.transcribe(
                    tmp_path,
                    language=validated_language if validated_language != "auto" else None,
                    vad_filter=True,
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
                
                # Process segments
                segments_out = []
                text_parts = []
                for s in segments:
                    text_cleaned = s.text.strip()
                    if text_cleaned:
                        segments_out.append({
                            "start": float(s.start),
                            "end": float(s.end),
                            "text": text_cleaned
                        })
                        text_parts.append(text_cleaned)
                
                transcript_text = "\n".join(text_parts).strip()
                
                # Save transcription
                transcription = Transcription(
                    meeting_id=meeting_id,
                    text=transcript_text,
                    language=info.language if hasattr(info, "language") else validated_language,
                )
                db.add(transcription)
                
                # Update meeting duration if available
                if hasattr(info, "duration") and info.duration:
                    meeting.duration = info.duration
                
                # Determine language to use for prompt
                # Priority: 1) User specified language, 2) Whisper detected language, 3) Default to Turkish
                if validated_language in ("tr", "en"):
                    lang_code = validated_language
                elif hasattr(info, "language") and info.language in ("tr", "en"):
                    lang_code = info.language
                elif validated_language == "auto":
                    # For auto mode, default to Turkish since it's the primary use case
                    lang_code = "tr"
                else:
                    # Fallback to Turkish for better local support
                    lang_code = "tr"

                # Generate summary using language-specific prompt
                prompt = get_single_summary_prompt(lang_code).format(transcript=transcript_text)
                summary = self.ollama_client.generate(
                    prompt,
                    options={
                        "temperature": 0.2,
                        "top_p": 0.8,
                        "top_k": 10,
                        "num_predict": 300,
                    },
                )
                
                # Save summary
                summary_obj = Summary(
                    meeting_id=meeting_id,
                    summary_text=summary,
                    model_used=settings.ollama_model,
                )
                db.add(summary_obj)
                
                # Commit all changes
                db.commit()
                
                logger.info(
                    f"Auto-processed meeting {meeting_id}: {len(segments_out)} segments, "
                    f"language: {validated_language}"
                )
                
                return {
                    "meeting_id": meeting_id,
                    "status": "completed",
                    "transcript": transcript_text,
                    "summary": summary,
                    "language": validated_language,
                    "duration": getattr(info, "duration", None),
                    "segments": segments_out,
                    "message": f"Meeting '{title}' processed successfully with {len(segments_out)} segments"
                }
                
            finally:
                # Cleanup temp file
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
                    
        except Exception as e:
            # Rollback on error
            db.rollback()
            logger.error(f"Failed to auto-process meeting: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process meeting: {str(e)}")
    
    # Removed auto_process_dual_meeting method - now using single-stream audio approach
    
    # Removed _combine_dual_transcripts and _generate_dual_audio_summary methods - now using single-stream audio approach
    
    # Removed speaker diarization methods (_perform_speaker_diarization, _simple_speaker_detection, 
    # _combine_multi_speaker_transcripts, _generate_multi_speaker_summary, _save_speaker_data) 
    # - now using single-stream audio approach with simpler processing
    
    def upload_audio_for_meeting(
        self,
        meeting_id: str,
        file: UploadFile,
        language: str,
        user_id: str,
        background_tasks: BackgroundTasks,
        db: Session
    ) -> Dict[str, Any]:
        """Upload audio for an existing meeting and start processing"""
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="File must have a filename")
        
        # Validate language
        try:
            validated_language = validate_language(language)
        except HTTPException as e:
            raise HTTPException(status_code=400, detail=str(e.detail))
        
        # Verify meeting exists and belongs to user
        user = get_or_create_user(db)
        meeting = db.query(Meeting).filter(
            Meeting.id == meeting_id,
            Meeting.user_id == user.id
        ).first()
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        # Generate job ID
        job_id = f"audio_{meeting_id[:8]}_{datetime.utcnow().strftime('%H%M%S')}"
        
        # Create job in store
        job_store.create(job_id, Phase.QUEUED)
        
        # Update meeting with job reference
        existing_tags = json.loads(meeting.tags or "[]")
        meeting.tags = json.dumps([*existing_tags, f"job:{job_id}"])
        db.commit()
        
        return {
            "meeting_id": meeting_id,
            "job_id": job_id,
            "status": "processing",
            "message": f"Audio uploaded and processing started for meeting '{meeting.title}'",
            "language": validated_language
        }
