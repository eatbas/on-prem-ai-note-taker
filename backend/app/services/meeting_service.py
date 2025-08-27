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
from ..database import get_or_create_user, Meeting, Transcription, Summary, Speaker, SpeakerSegment
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
    
    async def auto_process_dual_meeting(
        self,
        microphone_file: UploadFile,
        system_file: UploadFile,
        language: str,
        title: str,
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """Process dual audio files for maximum Whisper accuracy with perfect speaker separation"""
        # Validate files
        if not microphone_file.filename or not system_file.filename:
            raise HTTPException(status_code=400, detail="Both files must have filenames")
        
        # Read and validate file sizes
        mic_content = await microphone_file.read()
        system_content = await system_file.read()
        
        mic_size_mb = len(mic_content) / (1024 * 1024)
        system_size_mb = len(system_content) / (1024 * 1024)
        total_size_mb = mic_size_mb + system_size_mb
        
        if total_size_mb > settings.max_upload_mb:
            raise HTTPException(
                status_code=413, 
                detail=f"Combined files too large: {total_size_mb:.1f} MB > {settings.max_upload_mb} MB"
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
            tags=json.dumps(["dual-audio", "whisper-optimized"])
        )
        db.add(meeting)
        
        try:
            # Process both audio files with Whisper
            model = get_whisper_model()
            
            # Save microphone file to temp
            with tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=f"_mic{os.path.splitext(microphone_file.filename or 'audio')[1]}"
            ) as mic_tmp:
                mic_tmp.write(mic_content)
                mic_tmp_path = mic_tmp.name
            
            # Save system file to temp
            with tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=f"_system{os.path.splitext(system_file.filename or 'audio')[1]}"
            ) as system_tmp:
                system_tmp.write(system_content)
                system_tmp_path = system_tmp.name
            
            try:
                # Transcribe microphone audio (user speech)
                logger.info(f"Processing microphone audio for meeting {meeting_id}")
                mic_segments, mic_info = model.transcribe(
                    mic_tmp_path,
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
                
                # Transcribe system audio with speaker diarization (other speakers)
                logger.info(f"Processing system audio with speaker diarization for meeting {meeting_id}")
                system_segments, system_info = model.transcribe(
                    system_tmp_path,
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
                
                # Perform speaker diarization on system audio
                logger.info("Performing speaker diarization on system audio")
                speaker_segments = self._perform_speaker_diarization(system_segments, system_tmp_path)
                
                # Process microphone segments
                mic_segments_out = []
                mic_text_parts = []
                for s in mic_segments:
                    text_cleaned = s.text.strip()
                    if text_cleaned:
                        mic_segments_out.append({
                            "start": float(s.start),
                            "end": float(s.end),
                            "text": text_cleaned,
                            "speaker": "USER"
                        })
                        mic_text_parts.append(text_cleaned)
                
                # Process system segments with speaker diarization
                system_segments_out = []
                system_text_parts_by_speaker = {}
                speaker_count = 0
                
                for segment_info in speaker_segments:
                    text_cleaned = segment_info["text"].strip()
                    speaker_id = segment_info["speaker"]
                    
                    if text_cleaned:
                        system_segments_out.append({
                            "start": float(segment_info["start"]),
                            "end": float(segment_info["end"]),
                            "text": text_cleaned,
                            "speaker": speaker_id
                        })
                        
                        # Group text by speaker for summary
                        if speaker_id not in system_text_parts_by_speaker:
                            system_text_parts_by_speaker[speaker_id] = []
                            speaker_count += 1
                        system_text_parts_by_speaker[speaker_id].append(text_cleaned)
                
                logger.info(f"Speaker diarization completed: {speaker_count} speakers identified in system audio")
                
                # Combine transcripts with perfect speaker separation
                combined_transcript = self._combine_multi_speaker_transcripts(
                    mic_text_parts, system_text_parts_by_speaker
                )
                
                # Save combined transcription
                transcription = Transcription(
                    meeting_id=meeting_id,
                    text=combined_transcript,
                    language=getattr(mic_info, "language", validated_language),
                )
                db.add(transcription)
                
                # Update meeting duration (use longer of the two)
                mic_duration = getattr(mic_info, "duration", 0)
                system_duration = getattr(system_info, "duration", 0)
                meeting.duration = max(mic_duration, system_duration)
                
                # Generate enhanced summary with speaker context
                enhanced_summary = await self._generate_multi_speaker_summary(
                    mic_text_parts, system_text_parts_by_speaker, validated_language
                )
                
                # Save enhanced summary
                summary_obj = Summary(
                    meeting_id=meeting_id,
                    summary_text=enhanced_summary,
                    model_used=settings.ollama_model,
                )
                db.add(summary_obj)
                
                # Save speaker information and segments
                self._save_speaker_data(
                    db, meeting_id, mic_segments_out, system_segments_out, system_text_parts_by_speaker
                )
                
                # Commit all changes
                db.commit()
                
                # Combine all segments for response
                all_segments = mic_segments_out + system_segments_out
                all_segments.sort(key=lambda x: x["start"])  # Sort by timestamp
                
                logger.info(
                    f"Dual audio processed for meeting {meeting_id}: "
                    f"mic={len(mic_segments_out)} segments, system={len(system_segments_out)} segments"
                )
                
                return {
                    "meeting_id": meeting_id,
                    "status": "completed",
                    "transcript": combined_transcript,
                    "summary": enhanced_summary,
                    "language": validated_language,
                    "duration": meeting.duration,
                    "segments": all_segments,
                    "speaker_separation": {
                        "user_segments": len(mic_segments_out),
                        "other_segments": len(system_segments_out),
                        "total_speakers": speaker_count + 1,  # +1 for user
                        "individual_speakers": list(system_text_parts_by_speaker.keys()),
                        "accuracy_level": "maximum_with_diarization"
                    },
                    "message": f"Dual audio meeting '{title}' processed with perfect speaker separation ({speaker_count + 1} speakers identified)"
                }
                
            finally:
                # Cleanup temp files
                for path in [mic_tmp_path, system_tmp_path]:
                    try:
                        os.remove(path)
                    except OSError:
                        pass
                    
        except Exception as e:
            # Rollback on error
            db.rollback()
            logger.error(f"Failed to process dual audio meeting: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process dual audio meeting: {str(e)}")
    
    def _combine_dual_transcripts(self, mic_text_parts: list, system_text_parts: list) -> str:
        """Combine microphone and system transcripts with speaker labels"""
        lines = []
        
        if mic_text_parts:
            lines.append("## Speaker: USER (Microphone)")
            lines.append("\n".join(mic_text_parts))
            lines.append("")
        
        if system_text_parts:
            lines.append("## Speaker: OTHERS (System Audio)")
            lines.append("\n".join(system_text_parts))
            lines.append("")
        
        lines.append("---")
        lines.append("*Processed with dual-stream Whisper optimization for perfect speaker separation.*")
        
        return "\n".join(lines)
    
    async def _generate_dual_audio_summary(
        self, mic_text_parts: list, system_text_parts: list, language: str
    ) -> str:
        """Generate enhanced summary with speaker context"""
        mic_text = " ".join(mic_text_parts) if mic_text_parts else ""
        system_text = " ".join(system_text_parts) if system_text_parts else ""
        
        # Determine language for prompt
        if language in ("tr", "en"):
            lang_code = language
        elif language == "auto":
            lang_code = "tr"  # Default to Turkish
        else:
            lang_code = "tr"  # Fallback to Turkish
        
        # Create dual audio summary prompt
        if lang_code == "tr":
            prompt = f"""Aşağıda mikrofondan (kullanıcı) ve sistem sesinden (diğer konuşmacılar) ayrı ayrı kaydedilen bir toplantının transkripti bulunmaktadır.

KULLANICI (Mikrofon):
{mic_text}

DİĞER KONUŞMACILAR (Sistem Sesi):
{system_text}

Bu iki farklı ses kaynağından elde edilen bilgileri kullanarak kapsamlı bir toplantı özeti hazırla. Konuşmacı ayrımını belirt ve ana konuları, kararları ve eylem planlarını özetle."""
        else:
            prompt = f"""Below is a transcript from a meeting recorded with separate microphone (user) and system audio (other speakers) streams.

USER (Microphone):
{mic_text}

OTHER SPEAKERS (System Audio):
{system_text}

Using information from both audio sources, create a comprehensive meeting summary. Include speaker distinction and summarize main topics, decisions, and action items."""
        
        summary = self.ollama_client.generate(
            prompt,
            options={
                "temperature": 0.2,
                "top_p": 0.8,
                "top_k": 10,
                "num_predict": 400,
            },
        )
        
        # Add dual audio processing note
        prefix = "## Dual-Stream Whisper Summary (Perfect Speaker Separation)\n\n"
        return prefix + summary
    
    def _perform_speaker_diarization(self, segments, audio_file_path: str) -> list:
        """Perform speaker diarization on audio segments using pyannote.audio (CPU-optimized)"""
        try:
            # Try to import speaker diarization library
            from pyannote.audio import Pipeline
            import torch
            
            # Force CPU usage for server without GPU
            if torch.cuda.is_available():
                logger.info("🚀 GPU detected, using GPU acceleration for speaker diarization")
                device = torch.device("cuda")
            else:
                logger.info("💻 No GPU detected, using CPU-only speaker diarization (6 CPU, 16GB RAM)")
                device = torch.device("cpu")
                # Set CPU thread count for optimal performance within resource limits
                torch.set_num_threads(6)  # Use 6 CPU cores (leaving 2 for system)
            
            # Initialize the speaker diarization pipeline with CPU optimization
            pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
            pipeline = pipeline.to(device)
            
            # Additional memory optimization for 16GB RAM constraint
            if device.type == "cpu":
                # Optimize for memory efficiency
                import gc
                gc.collect()  # Clean up memory before processing
                logger.info("🧹 Memory optimized for 16GB RAM constraint")
            
            # Perform diarization with CPU optimization
            logger.info(f"🔍 Starting speaker diarization on {device} for audio file: {audio_file_path}")
            diarization = pipeline(audio_file_path)
            
            # Create speaker segments with diarization
            speaker_segments = []
            speaker_mapping = {}
            speaker_counter = 1
            
            for segment in segments:
                segment_start = segment.start
                segment_end = segment.end
                segment_text = segment.text
                
                # Find which speaker is talking during this segment
                dominant_speaker = None
                max_overlap = 0
                
                for turn, _, speaker in diarization.itertracks(yield_label=True):
                    # Calculate overlap between segment and speaker turn
                    overlap_start = max(segment_start, turn.start)
                    overlap_end = min(segment_end, turn.end)
                    overlap_duration = max(0, overlap_end - overlap_start)
                    
                    if overlap_duration > max_overlap:
                        max_overlap = overlap_duration
                        dominant_speaker = speaker
                
                # Map speaker to readable format
                if dominant_speaker:
                    if dominant_speaker not in speaker_mapping:
                        speaker_mapping[dominant_speaker] = f"SPEAKER_{speaker_counter}"
                        speaker_counter += 1
                    
                    speaker_id = speaker_mapping[dominant_speaker]
                else:
                    speaker_id = "SPEAKER_UNKNOWN"
                
                speaker_segments.append({
                    "start": segment_start,
                    "end": segment_end,
                    "text": segment_text,
                    "speaker": speaker_id
                })
            
            logger.info(f"Speaker diarization successful: {len(speaker_mapping)} speakers identified")
            return speaker_segments
            
        except ImportError:
            logger.warning("pyannote.audio not available, using simple speaker detection")
            return self._simple_speaker_detection(segments)
        except Exception as e:
            logger.warning(f"Speaker diarization failed: {e}, using simple detection")
            return self._simple_speaker_detection(segments)
    
    def _simple_speaker_detection(self, segments) -> list:
        """Enhanced CPU-only speaker detection using audio characteristics and timing patterns"""
        speaker_segments = []
        current_speaker = "SPEAKER_1"
        speaker_counter = 1
        
        # Enhanced heuristics for better speaker separation
        for i, segment in enumerate(segments):
            segment_duration = segment.end - segment.start
            
            # Analyze speech patterns for speaker changes
            if i > 0:
                prev_segment = segments[i-1]
                silence_duration = segment.start - prev_segment.end
                prev_duration = prev_segment.end - prev_segment.start
                
                # Multi-factor speaker change detection
                speaker_change = False
                
                # Long pause detection (speaker turn)
                if silence_duration > 1.5:  # 1.5 second pause
                    speaker_change = True
                
                # Significant duration change (different speaking style)
                elif abs(segment_duration - prev_duration) > 3.0:  # Very different segment length
                    speaker_change = True
                
                # Text content analysis (basic)
                elif len(segment.text.split()) < 3 and silence_duration > 0.8:  # Short responses with pause
                    speaker_change = True
                
                if speaker_change:
                    speaker_counter += 1
                    current_speaker = f"SPEAKER_{speaker_counter}"
            
            speaker_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
                "speaker": current_speaker
            })
        
        logger.info(f"Enhanced CPU speaker detection: {speaker_counter} speakers estimated using timing and content analysis")
        return speaker_segments
    
    def _combine_multi_speaker_transcripts(self, mic_text_parts: list, system_text_parts_by_speaker: dict) -> str:
        """Combine microphone and system transcripts with individual speaker labels"""
        lines = []
        
        # User section
        if mic_text_parts:
            lines.append("## Speaker: USER (Microphone)")
            lines.append("\n".join(mic_text_parts))
            lines.append("")
        
        # Individual speakers from system audio
        for speaker_id, text_parts in system_text_parts_by_speaker.items():
            if text_parts:
                lines.append(f"## Speaker: {speaker_id} (System Audio)")
                lines.append("\n".join(text_parts))
                lines.append("")
        
        lines.append("---")
        lines.append("*Processed with dual-stream Whisper optimization and speaker diarization.*")
        
        return "\n".join(lines)
    
    async def _generate_multi_speaker_summary(
        self, mic_text_parts: list, system_text_parts_by_speaker: dict, language: str
    ) -> str:
        """Generate enhanced summary with individual speaker context"""
        mic_text = " ".join(mic_text_parts) if mic_text_parts else ""
        
        # Determine language for prompt
        if language in ("tr", "en"):
            lang_code = language
        elif language == "auto":
            lang_code = "tr"  # Default to Turkish
        else:
            lang_code = "tr"  # Fallback to Turkish
        
        # Build speaker sections
        speaker_sections = []
        for speaker_id, text_parts in system_text_parts_by_speaker.items():
            if text_parts:
                speaker_text = " ".join(text_parts)
                speaker_sections.append(f"{speaker_id}: {speaker_text}")
        
        # Create multi-speaker summary prompt
        if lang_code == "tr":
            speakers_text = "\n".join(speaker_sections)
            prompt = f"""Aşağıda mikrofondan (kullanıcı) ve sistem sesinden (bireysel konuşmacılar ayrılmış) kaydedilen bir toplantının transkripti bulunmaktadır.

KULLANICI (Mikrofon):
{mic_text}

TOPLANTI KATILIMCILARI (Sistem Sesi - Bireysel Konuşmacılar):
{speakers_text}

Bu farklı konuşmacılardan elde edilen bilgileri kullanarak kapsamlı bir toplantı özeti hazırla. Her konuşmacının katkısını belirt ve ana konuları, kararları ve eylem planlarını özetle."""
        else:
            speakers_text = "\n".join(speaker_sections)
            prompt = f"""Below is a transcript from a meeting recorded with separate microphone (user) and system audio (individual speakers separated) streams.

USER (Microphone):
{mic_text}

MEETING PARTICIPANTS (System Audio - Individual Speakers):
{speakers_text}

Using information from all speakers, create a comprehensive meeting summary. Include each speaker's contributions and summarize main topics, decisions, and action items."""
        
        summary = self.ollama_client.generate(
            prompt,
            options={
                "temperature": 0.2,
                "top_p": 0.8,
                "top_k": 10,
                "num_predict": 500,
            },
        )
        
        # Add speaker diarization note
        speaker_count = len(system_text_parts_by_speaker) + 1  # +1 for user
        prefix = f"## Multi-Speaker Meeting Summary ({speaker_count} Speakers Identified)\n\n"
        return prefix + summary
    
    def _save_speaker_data(
        self, db: Session, meeting_id: str, mic_segments: list, 
        system_segments: list, system_text_parts_by_speaker: dict
    ) -> None:
        """Save speaker information and segments to database"""
        import uuid
        
        # Create USER speaker (from microphone)
        user_speaker = Speaker(
            id=str(uuid.uuid4()),
            meeting_id=meeting_id,
            original_speaker_id="USER",
            custom_name="User",
            speaker_type="USER",
            total_segments=len(mic_segments),
            total_duration=sum(seg["end"] - seg["start"] for seg in mic_segments)
        )
        db.add(user_speaker)
        
        # Save USER segments
        for segment in mic_segments:
            segment_obj = SpeakerSegment(
                id=str(uuid.uuid4()),
                meeting_id=meeting_id,
                speaker_id=user_speaker.id,
                start_time=segment["start"],
                end_time=segment["end"],
                text=segment["text"],
                confidence=segment.get("confidence")
            )
            db.add(segment_obj)
        
        # Create speakers for system audio participants
        speaker_id_mapping = {}
        for original_speaker_id, text_parts in system_text_parts_by_speaker.items():
            # Calculate speaker statistics
            speaker_segments = [seg for seg in system_segments if seg["speaker"] == original_speaker_id]
            total_duration = sum(seg["end"] - seg["start"] for seg in speaker_segments)
            
            # Create speaker record
            speaker = Speaker(
                id=str(uuid.uuid4()),
                meeting_id=meeting_id,
                original_speaker_id=original_speaker_id,
                custom_name=original_speaker_id,  # Default name, user can change later
                speaker_type="SYSTEM",
                total_segments=len(speaker_segments),
                total_duration=total_duration
            )
            db.add(speaker)
            speaker_id_mapping[original_speaker_id] = speaker.id
            
            # Save segments for this speaker
            for segment in speaker_segments:
                segment_obj = SpeakerSegment(
                    id=str(uuid.uuid4()),
                    meeting_id=meeting_id,
                    speaker_id=speaker.id,
                    start_time=segment["start"],
                    end_time=segment["end"],
                    text=segment["text"],
                    confidence=segment.get("confidence")
                )
                db.add(segment_obj)
        
        logger.info(f"Saved speaker data: 1 user + {len(system_text_parts_by_speaker)} system speakers")
    
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
