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
from ..database import get_db, Meeting, Transcription, Summary
from ..models import User
from ..models.user import get_or_create_user, get_or_create_user_from_header
from ..core.utils import require_basic_auth, get_whisper_model, validate_language
from ..core.prompts import get_single_summary_prompt
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


def get_user_from_header(x_user_id: Optional[str], db: Session) -> str:
    """Get or create user based on X-User-Id header using centralized user creation"""
    user = get_or_create_user_from_header(db, x_user_id)
    return user.id


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
        
        # 🚀 STAGE 1 OPTIMIZATION: Apply audio preprocessing for better accuracy
        original_tmp_path = tmp_path
        if settings.enable_audio_normalization:
            from ..core.audio_utils import preprocess_audio_for_transcription
            tmp_path = preprocess_audio_for_transcription(tmp_path, True)
            logger.info(f"Audio preprocessing applied for transcription: {file.filename}")
        else:
            logger.debug("Audio normalization disabled for transcription")

        segments_out: List[TranscriptionSegment] = []
        text_parts: List[str] = []
        language_out: Optional[str] = None
        duration_out: Optional[float] = None

        try:
            # For very short files (< 10 seconds), disable VAD to prevent over-filtering
            # Get audio duration using ffprobe (more reliable for webm files)
            import subprocess
            try:
                # Use ffprobe to get duration (works better with webm files)
                result = subprocess.run([
                    'ffprobe', '-v', 'quiet', '-show_entries', 
                    'format=duration', '-of', 'csv=p=0', str(tmp_path)
                ], capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0 and result.stdout.strip():
                    audio_duration = float(result.stdout.strip())
                    use_vad = vad_filter and audio_duration >= 10.0  # Only use VAD for 10+ second files
                    logger.info(f"Audio duration: {audio_duration:.2f}s, VAD enabled: {use_vad}")
                else:
                    logger.warning(f"ffprobe failed, disabling VAD for safety")
                    use_vad = False  # Disable VAD if we can't determine duration
            except Exception as e:
                logger.warning(f"Could not determine audio duration: {e}, disabling VAD for safety")
                use_vad = False  # Disable VAD if we can't determine duration
            
            # Transcription with configurable quality settings
            try:
                segments, info = model.transcribe(
                    tmp_path,
                    language=validated_language if validated_language != "auto" else None,
                    vad_filter=use_vad,
                    vad_parameters=dict(
                        min_silence_duration_ms=settings.whisper_vad_min_silence_ms,
                        speech_pad_ms=settings.whisper_vad_speech_pad_ms
                    ) if use_vad else None,
                    beam_size=settings.whisper_beam_size,
                    best_of=settings.whisper_best_of,
                    temperature=settings.whisper_temperature,
                    condition_on_previous_text=settings.whisper_condition_on_previous_text,
                    word_timestamps=settings.whisper_word_timestamps,
                    initial_prompt=settings.whisper_initial_prompt,
                    compression_ratio_threshold=settings.whisper_compression_ratio_threshold,
                    log_prob_threshold=settings.whisper_log_prob_threshold
                )
            except ValueError as e:
                if "empty sequence" in str(e):
                    logger.warning(f"VAD filtered out all audio content, retrying without VAD")
                    # Retry without VAD filter
                    segments, info = model.transcribe(
                        tmp_path,
                        language=validated_language if validated_language != "auto" else None,
                        vad_filter=False,  # Disable VAD completely
                        beam_size=settings.whisper_beam_size,
                        best_of=settings.whisper_best_of,
                        temperature=settings.whisper_temperature,
                        condition_on_previous_text=settings.whisper_condition_on_previous_text,
                        word_timestamps=settings.whisper_word_timestamps,
                        initial_prompt=settings.whisper_initial_prompt,
                        compression_ratio_threshold=settings.whisper_compression_ratio_threshold,
                        log_prob_threshold=settings.whisper_log_prob_threshold
                    )
                else:
                    raise  # Re-raise if it's a different ValueError
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
            # Cleanup preprocessed audio if different from original
            if tmp_path != original_tmp_path:
                from ..core.audio_utils import cleanup_preprocessed_audio
                cleanup_preprocessed_audio(tmp_path, original_tmp_path)
            
            # Cleanup original temp file
            try:
                os.remove(original_tmp_path)
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
    """Generate summary from text with language-aware prompt"""
    # Determine language code
    try:
        validated_language = validate_language(req.language)
    except Exception:
        validated_language = "auto"
    
    # Improved language selection: prioritize Turkish for better local support
    if validated_language in ("tr", "en"):
        lang_code = validated_language
    else:
        # Default to Turkish for auto/unknown languages
        lang_code = "tr"

    prompt = get_single_summary_prompt(lang_code).format(transcript=req.text)
    summary_text = _ollama_client.generate(
        prompt,
        model=req.model,
        options={
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 10,
            "num_predict": 300,
        },
    )
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
        # Validate language parameter
        try:
            validated_language = validate_language(language)
        except Exception:
            validated_language = "auto"
        
        # Get or create user
        user_id = get_user_from_header(x_user_id, db)
        
        # Create meeting record
        meeting_id = str(uuid.uuid4())
        meeting = Meeting(
            id=meeting_id,
            user_id=user_id,
            title=f"Meeting {meeting_id[:8]}",  # Default title
            language=validated_language,
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
        
        # Choose language for summary prompt
        try:
            validated_language = validate_language(language)
        except HTTPException:
            validated_language = "auto"
        
        # Improved language selection: prioritize user choice, then detected, then Turkish default
        if validated_language in ("tr", "en"):
            lang_code = validated_language
        elif transcript.language in ("tr", "en"):
            lang_code = transcript.language
        else:
            # Default to Turkish for auto/unknown languages
            lang_code = "tr"

        # 🚀 STAGE 2-3 OPTIMIZATION: Use hierarchical JSON summarization for direct endpoint
        from ..services.hierarchical_summary import HierarchicalSummarizationService
        
        try:
            # Use the revolutionary hierarchical summarization
            hierarchical_service = HierarchicalSummarizationService()
            
            # Create chunk from transcript (single chunk for direct processing)
            chunks = [{
                'text': transcript.text,
                'start_time': 0,
                'end_time': transcript.duration or 0,
                'chunk_index': 0
            }]
            
            # Generate hierarchical summary with JSON schema
            summary_result = hierarchical_service.generate_meeting_summary(
                chunks=chunks,
                meeting_metadata={
                    'meeting_id': meeting_id,
                    'language': lang_code,
                    'duration': transcript.duration or 0
                }
            )
            
            # Extract summary text (backward compatibility)
            if hasattr(summary_result, 'summary') and summary_result.summary:
                summary = summary_result.summary
            elif hasattr(summary_result, 'executive_summary'):
                summary = summary_result.executive_summary
            else:
                summary = str(summary_result)
                
            logger.info(f"✅ Hierarchical JSON summarization completed for direct endpoint: {meeting_id}")
            
        except Exception as e:
            logger.warning(f"⚠️  Hierarchical summarization failed, falling back to legacy: {e}")
            # Fallback to old method if new one fails
            prompt = get_single_summary_prompt(lang_code).format(transcript=transcript.text)
            summary = _ollama_client.generate(
                prompt,
                options={
                    "temperature": 0.2,
                    "top_p": 0.8,
                    "top_k": 10,
                    "num_predict": 300,
                },
            )
        
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
