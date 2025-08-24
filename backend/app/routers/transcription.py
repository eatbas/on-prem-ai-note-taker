"""Transcription API endpoints"""

import os
import tempfile
import asyncio
import logging
from typing import Optional, List

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Header, Depends
from sqlalchemy.orm import Session

from ..schemas.transcription import TranscriptionResponse, TranscriptionSegment, TranscribeAndSummarizeResponse
from ..schemas.summarization import SummarizeRequest, SummarizeResponse
from ..core.config import settings
from ..database import get_db, get_or_create_user, Meeting, Transcription, Summary
from ..core.utils import require_basic_auth, get_whisper_model, validate_language
from ..clients.ollama_client import OllamaClient

router = APIRouter(prefix="/api", tags=["transcription"])
logger = logging.getLogger(__name__)

# Initialize Ollama client
_ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)

# Semaphore for controlling concurrent transcriptions
_transcribe_semaphore: Optional[asyncio.Semaphore] = None


def get_transcribe_semaphore() -> asyncio.Semaphore:
    """Get or create transcription semaphore for concurrency control"""
    global _transcribe_semaphore
    if _transcribe_semaphore is None:
        _concurrency = max(1, settings.max_concurrency)
        _transcribe_semaphore = asyncio.Semaphore(_concurrency)
    return _transcribe_semaphore


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
    vad_filter: bool = Form(default=True),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
) -> TranscriptionResponse:
    """Transcribe audio file to text"""
    sem = get_transcribe_semaphore()
    model = get_whisper_model()

    async with sem:
        # Read and validate size
        content = await file.read()
        size_mb = len(content) / (1024 * 1024)
        if size_mb > settings.max_upload_mb:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB"
            )
        
        # Validate language
        validated_language = validate_language(language)
        logger.info(
            "Transcribe request: filename=%s size_mb=%.2f lang=%s validated_lang=%s user=%s", 
            file.filename, size_mb, language, validated_language, x_user_id
        )

        # Save to a temp file for faster-whisper consumption
        with tempfile.NamedTemporaryFile(
            delete=False, 
            suffix=os.path.splitext(file.filename or "audio")[1]
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        segments_out: List[TranscriptionSegment] = []
        text_parts: List[str] = []
        language_out: Optional[str] = None
        duration_out: Optional[float] = None

        try:
            # VPS-optimized transcription with better VAD settings
            segments, info = model.transcribe(
                tmp_path,
                language=validated_language if validated_language != "auto" else None,
                vad_filter=vad_filter,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=100
                ),
                beam_size=1,  # Faster decoding for VPS
                best_of=1,   # Single pass for speed
                temperature=0.0,  # Deterministic output
                compression_ratio_threshold=2.4,  # VPS optimization
                log_prob_threshold=-1.0  # VPS optimization
            )
            language_out = info.language if hasattr(info, "language") else None
            duration_out = info.duration if hasattr(info, "duration") else None
            
            # Process segments efficiently
            for s in segments:
                text_cleaned = s.text.strip()
                if text_cleaned:  # Skip empty segments
                    segments_out.append(
                        TranscriptionSegment(
                            start=float(s.start), 
                            end=float(s.end), 
                            text=text_cleaned
                        )
                    )
                    text_parts.append(text_cleaned)
            
            logger.info(
                f"Transcription completed: {len(segments_out)} segments, "
                f"language: {language_out}, duration: {duration_out:.2f}s"
            )
            
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

        return TranscriptionResponse(
            language=language_out,
            duration=duration_out,
            text="\n".join(text_parts).strip(),
            segments=segments_out,
        )


@router.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest) -> SummarizeResponse:
    """Generate summary from text"""
    summary_text = _ollama_client.summarize(req.text, model=req.model)
    return SummarizeResponse(summary=summary_text)


@router.post("/transcribe-and-summarize", response_model=TranscribeAndSummarizeResponse)
async def transcribe_and_summarize(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
    vad_filter: bool = Form(default=True),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> TranscribeAndSummarizeResponse:
    """Transcribe audio file and generate summary in one go"""
    import uuid
    
    sem = get_transcribe_semaphore()
    async with sem:
        # Get or create user
        user = get_or_create_user(db)
        
        # Create meeting record
        meeting_id = str(uuid.uuid4())
        meeting = Meeting(
            id=meeting_id,
            user_id=user.id,
            title=f"Meeting {meeting_id[:8]}",  # Default title
        )
        db.add(meeting)
        
        # Transcribe
        transcript = await transcribe(
            file=file, 
            language=language, 
            vad_filter=vad_filter, 
            x_user_id=x_user_id
        )
        
        # Save transcription to database
        transcription = Transcription(
            meeting_id=meeting_id,
            text=transcript.text,
            language=transcript.language,
        )
        db.add(transcription)
        
        # Update meeting duration if available
        if transcript.duration:
            meeting.duration = transcript.duration
        
        # Summarize
        summary = _ollama_client.summarize(transcript.text)
        
        # Save summary to database
        summary_obj = Summary(
            meeting_id=meeting_id,
            summary_text=summary,
            model_used=settings.ollama_model,
        )
        db.add(summary_obj)
        
        # Commit all changes
        db.commit()
        
        return TranscribeAndSummarizeResponse(transcript=transcript, summary=summary)
