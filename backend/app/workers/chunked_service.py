"""Chunked transcription and summarization service with progress tracking"""

import os
import tempfile
import json
import asyncio
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import logging

from .progress import job_store, Phase
from ..core.prompts import get_chunk_prompt, get_merge_prompt
from ..core.audio_utils import get_audio_duration, split_audio_into_chunks, cleanup_chunk_files
from ..core.config import settings
from ..clients.ollama_client import OllamaClient
from ..core.config import settings

logger = logging.getLogger(__name__)


class ChunkedTranscriptionService:
    """Service for chunked transcription and summarization"""
    
    def __init__(self):
        self.ollama_client = OllamaClient(
            base_url=settings.ollama_base_url,
            default_model=settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
        )
        # Global speaker tracking across chunks
        self._global_speaker_map = {}  # Maps local chunk speakers to global speakers
        self._speaker_history = []     # History of speakers for context
        self._last_chunk_end_time = 0.0
        self._last_speaker_id = 0
    
    async def process_audio_file(
        self,
        job_id: str,
        file_path: str,
        language: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process audio file with chunked transcription and enhanced speaker persistence
        """
        try:
            # Reset speaker tracking for new file
            self._global_speaker_map = {}
            self._speaker_history = []
            self._last_chunk_end_time = 0.0
            self._last_speaker_id = 0
            
            # Get audio duration and info
            total_duration = get_audio_duration(file_path)
            logger.info(f"Processing audio file with enhanced speaker tracking: {file_path}, duration: {total_duration:.2f}s")
            
            # Update job with audio info
            job_store.update(
                job_id,
                phase=Phase.TRANSCRIBING,
                progress=5.0,
                message=f"Audio file loaded: {total_duration:.1f}s duration",
                current=0,
                total=int(total_duration)
            )
            
            # Check for cancellation
            if self._is_cancelled(job_id):
                return {"error": "Job cancelled"}
            
            # Split audio into larger chunks with more overlap for better speaker tracking
            chunks = split_audio_into_chunks(
                file_path,
                chunk_duration=settings.chunk_duration_seconds,  # Now 45 seconds
                overlap=settings.chunk_overlap_seconds           # Now 8 seconds
            )
            logger.info(f"Split audio into {len(chunks)} chunks ({settings.chunk_duration_seconds}s each with {settings.chunk_overlap_seconds}s overlap)")
            
            # Update progress
            job_store.update(
                job_id,
                progress=10.0,
                message=f"Processing {len(chunks)} audio chunks with enhanced speaker tracking"
            )
            
            # Process each chunk
            all_segments = []
            all_text_parts = []
            processed_seconds = 0
            
            for chunk_idx, (chunk_path, start_time, end_time) in enumerate(chunks):
                # Check for cancellation
                if self._is_cancelled(job_id):
                    cleanup_chunk_files([chunk_path for _, chunk_path, _ in chunks])
                    return {"error": "Job cancelled"}
                
                # Process chunk with enhanced speaker tracking
                chunk_result = await self._process_chunk_with_speaker_persistence(
                    job_id, chunk_path, start_time, end_time, 
                    chunk_idx, len(chunks), processed_seconds, total_duration, language
                )
                
                if chunk_result.get("error"):
                    logger.error(f"Chunk {chunk_idx} failed: {chunk_result['error']}")
                    continue
                
                # Accumulate results
                all_segments.extend(chunk_result.get("segments", []))
                all_text_parts.extend(chunk_result.get("text_parts", []))
                processed_seconds += (end_time - start_time)
                
                # Update progress (0-30% for transcription)
                progress = min(30, 10 + (processed_seconds / max(total_duration, 1)) * 20)
                speakers_found = len(self._speaker_history)
                job_store.update(
                    job_id,
                    progress=progress,
                    current=int(processed_seconds),
                    total=int(total_duration),
                    message=f"Transcribed chunk {chunk_idx + 1}/{len(chunks)} - {speakers_found} speakers identified"
                )
            
            # Cleanup chunk files
            cleanup_chunk_files([chunk_path for _, chunk_path, _ in chunks])
            
            # Check for cancellation
            if self._is_cancelled(job_id):
                return {"error": "Job cancelled"}
            
            # Transcription complete
            transcript_text = "\n".join(all_text_parts).strip()
            logger.info(f"Transcription completed: {len(all_segments)} segments, {len(transcript_text)} characters")
            
            # Update to summarization phase
            job_store.update(
                job_id,
                phase=Phase.SUMMARIZING,
                progress=30.0,
                message="Transcription completed, starting summarization"
            )
            
            # Generate summary
            summary = await self._generate_chunked_summary(
                job_id, transcript_text, language
            )
            
            if self._is_cancelled(job_id):
                return {"error": "Job cancelled"}
            
            # Finalize
            job_store.update(
                job_id,
                phase=Phase.FINALIZING,
                progress=95.0,
                message="Finalizing results"
            )
            
            # Save to database if needed
            try:
                from ..database import get_db, get_or_create_user, Meeting, Transcription, Summary
                db = next(get_db())
                user = get_or_create_user(db)
                
                # Create meeting record
                meeting_id = job_id
                meeting = Meeting(
                    id=meeting_id,
                    user_id=user.id,
                    title=f"Meeting {meeting_id[:8]}",
                    language=language,
                    duration=total_duration
                )
                db.add(meeting)
                
                # Save transcription
                transcription = Transcription(
                    meeting_id=meeting_id,
                    text=transcript_text,
                    language=language if language != "auto" else "unknown",
                )
                db.add(transcription)
                
                # Save summary
                summary_obj = Summary(
                    meeting_id=meeting_id,
                    summary_text=summary,
                    model_used=settings.ollama_model,
                )
                db.add(summary_obj)
                
                db.commit()
                logger.info(f"Saved meeting {meeting_id} to database")
                
            except Exception as db_error:
                logger.error(f"Database save failed for job {job_id}: {db_error}")
            
            # Job completed successfully
            job_store.update(
                job_id,
                phase=Phase.DONE,
                progress=100.0,
                message="Transcription and summarization completed successfully",
                current=int(total_duration),
                total=int(total_duration)
            )
            
            return {
                "transcript": transcript_text,
                "segments": all_segments,
                "summary": summary,
                "language": language,
                "duration": total_duration
            }
            
        except Exception as e:
            error_message = f"Job failed: {str(e)}"
            logger.error(f"Job {job_id} failed: {e}")
            
            job_store.update(
                job_id,
                phase=Phase.ERROR,
                message=error_message
            )
            
            return {"error": error_message}
    
    async def _process_chunk_with_speaker_persistence(
        self,
        job_id: str,
        chunk_path: str,
        start_time: float,
        end_time: float,
        chunk_idx: int,
        total_chunks: int,
        processed_seconds: float,
        total_duration: float,
        language: str
    ) -> Dict[str, Any]:
        """Process a single audio chunk with enhanced speaker persistence across chunks"""
        try:
            # Import here to avoid circular imports
            from ..core.utils import get_whisper_model
            
            # Get Whisper model
            model = get_whisper_model()
            
            # Build context-aware prompt for speaker consistency
            initial_prompt = self._build_speaker_context_prompt(chunk_idx)
            
            # Transcribe chunk with enhanced quality settings
            segments, info = model.transcribe(
                chunk_path,
                language=language if language != "auto" else None,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=settings.whisper_vad_min_silence_ms,
                    speech_pad_ms=settings.whisper_vad_speech_pad_ms
                ),
                beam_size=settings.whisper_beam_size,
                best_of=settings.whisper_best_of,
                temperature=settings.whisper_temperature,
                condition_on_previous_text=True,  # Always true for consistency
                word_timestamps=True,  # Always enable for better boundaries
                initial_prompt=initial_prompt,
                compression_ratio_threshold=settings.whisper_compression_ratio_threshold,
                log_prob_threshold=settings.whisper_log_prob_threshold
            )
            
            # Enhanced speaker identification with global tracking
            segments_out = []
            text_parts = []
            speaker_changes = []
            
            for s in segments:
                text_cleaned = s.text.strip()
                if text_cleaned:
                    # Adjust timestamps to global time
                    global_start = start_time + float(s.start)
                    global_end = start_time + float(s.end)
                    
                    # Enhanced speaker detection with cross-chunk persistence
                    speaker_id = self._detect_speaker_with_persistence(
                        global_start, global_end, text_cleaned, chunk_idx
                    )
                    
                    segments_out.append({
                        "start": global_start,
                        "end": global_end,
                        "text": text_cleaned,
                        "speaker": f"Speaker {speaker_id + 1}",
                        "speaker_id": speaker_id
                    })
                    text_parts.append(f"Speaker {speaker_id + 1}: {text_cleaned}")
            
            # Update global speaker tracking
            if segments_out:
                self._last_chunk_end_time = segments_out[-1]["end"]
                self._last_speaker_id = segments_out[-1]["speaker_id"]
                
                # Update speaker history
                chunk_speakers = set(seg["speaker_id"] for seg in segments_out)
                for speaker_id in chunk_speakers:
                    if speaker_id not in self._speaker_history:
                        self._speaker_history.append(speaker_id)
            
            return {
                "segments": segments_out,
                "text_parts": text_parts,
                "language": info.language if hasattr(info, "language") else None,
                "speaker_changes": speaker_changes,
                "total_speakers": len(self._speaker_history)
            }
            
        except Exception as e:
            logger.error(f"Error processing chunk {chunk_idx}: {e}")
            return {"error": str(e)}
    
    def _build_speaker_context_prompt(self, chunk_idx: int) -> str:
        """Build context-aware prompt for better speaker consistency"""
        base_prompt = settings.whisper_initial_prompt or "This is a professional meeting with multiple speakers."
        
        if chunk_idx == 0:
            return base_prompt + " Please transcribe accurately with natural speaker changes."
        
        # For subsequent chunks, provide speaker context
        speaker_count = len(self._speaker_history)
        if speaker_count > 1:
            prompt = base_prompt + f" This is a continuation of a meeting. "
            prompt += f"There are {speaker_count} speakers identified so far: "
            # Fix nested f-string syntax issue
            speaker_names = ', '.join([f'Speaker {sid + 1}' for sid in self._speaker_history[:3]])
            prompt += f"{speaker_names}. "
            prompt += f"The last speaker was Speaker {self._last_speaker_id + 1}. "
            prompt += "Please maintain speaker consistency."
            return prompt
        
        return base_prompt
    
    def _detect_speaker_with_persistence(
        self, 
        global_start: float, 
        global_end: float, 
        text: str, 
        chunk_idx: int
    ) -> int:
        """Enhanced speaker detection with cross-chunk persistence"""
        
        # Calculate gap from last segment
        gap = global_start - self._last_chunk_end_time
        
        # For first chunk or first segment, start with speaker 0
        if chunk_idx == 0 and not self._speaker_history:
            self._speaker_history = [0]
            return 0
        
        # Speaker change detection logic
        should_change_speaker = False
        
        # 1. Long silence gap (configurable threshold)
        threshold_ms = settings.speaker_change_threshold_ms / 1000.0  # Convert to seconds
        if gap > threshold_ms:
            should_change_speaker = True
        
        # 2. Early in new chunk with reasonable gap (likely speaker continuation from overlap)
        chunk_relative_start = global_start % settings.chunk_duration_seconds
        if chunk_idx > 0 and chunk_relative_start < 5.0 and gap < 2.0:
            # Likely continuation, keep last speaker
            return self._last_speaker_id
        
        # 3. Question/answer pattern detection
        if (text.strip().endswith('?') or 
            text.lower().startswith(('yes', 'no', 'well', 'so', 'okay', 'right', 'i think', 'actually'))):
            if gap > 0.3:  # Even short gaps for Q&A
                should_change_speaker = True
        
        # 4. Short utterances often indicate speaker changes
        if len(text.split()) <= 3 and gap > 0.5:
            should_change_speaker = True
        
        if should_change_speaker:
            # Assign next speaker (cycling through max speakers)
            next_speaker = (self._last_speaker_id + 1) % settings.max_speakers
            
            # Add to history if new
            if next_speaker not in self._speaker_history:
                self._speaker_history.append(next_speaker)
            
            return next_speaker
        
        # No change, continue with last speaker
        return self._last_speaker_id
    
    async def _process_chunk(
        self,
        job_id: str,
        chunk_path: str,
        start_time: float,
        end_time: float,
        chunk_idx: int,
        total_chunks: int,
        processed_seconds: float,
        total_duration: float,
        language: str
    ) -> Dict[str, Any]:
        """Process a single audio chunk"""
        try:
            # Import here to avoid circular imports
            from ..core.utils import get_whisper_model
            
            # Get Whisper model
            model = get_whisper_model()
            
            # Transcribe chunk with configured quality settings
            segments, info = model.transcribe(
                chunk_path,
                language=language if language != "auto" else None,  # Use specified language or auto-detect
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=settings.whisper_vad_min_silence_ms,
                    speech_pad_ms=settings.whisper_vad_speech_pad_ms
                ),
                beam_size=settings.whisper_beam_size,
                best_of=settings.whisper_best_of,
                temperature=settings.whisper_temperature,
                condition_on_previous_text=settings.whisper_condition_on_previous_text,
                word_timestamps=True if settings.whisper_word_timestamps else False,
                initial_prompt=settings.whisper_initial_prompt,
                compression_ratio_threshold=settings.whisper_compression_ratio_threshold,
                log_prob_threshold=settings.whisper_log_prob_threshold
            )
            
            # Process segments with speaker identification
            segments_out = []
            text_parts = []
            current_speaker = 0
            speaker_changes = []
            
            for s in segments:
                text_cleaned = s.text.strip()
                if text_cleaned:
                    # Adjust timestamps to global time
                    global_start = start_time + float(s.start)
                    global_end = start_time + float(s.end)
                    
                    # Simple speaker change detection based on silence gaps
                    if segments_out and (global_start - segments_out[-1]["end"]) > 1.0:  # 1 second gap
                        current_speaker = (current_speaker + 1) % 3  # Assume max 3 speakers
                        speaker_changes.append({
                            "time": global_start,
                            "speaker": f"Speaker {current_speaker}"
                        })
                    
                    segments_out.append({
                        "start": global_start,
                        "end": global_end,
                        "text": text_cleaned,
                        "speaker": f"Speaker {current_speaker}"
                    })
                    text_parts.append(f"Speaker {current_speaker}: {text_cleaned}")
            
            return {
                "segments": segments_out,
                "text_parts": text_parts,
                "language": info.language if hasattr(info, "language") else None,
                "speaker_changes": speaker_changes,
                "total_speakers": current_speaker + 1
            }
            
        except Exception as e:
            logger.error(f"Error processing chunk {chunk_idx}: {e}")
            return {"error": str(e)}
    
    async def _generate_chunked_summary(
        self,
        job_id: str,
        transcript_text: str,
        language: str
    ) -> str:
        """Generate summary using chunked approach"""
        try:
            # Split transcript into chunks (~3-5k tokens each)
            # Rough estimation: 1 token ≈ 4 characters
            chunk_size = 4000  # characters per chunk
            chunks = self._split_text_into_chunks(transcript_text, chunk_size)
            
            logger.info(f"Split transcript into {len(chunks)} chunks for summarization")
            
            # Process each chunk
            chunk_summaries = []
            for i, chunk in enumerate(chunks):
                # Check for cancellation
                if self._is_cancelled(job_id):
                    return "Summary generation cancelled"
                
                # Update progress (30-95% for summarization)
                progress = 30 + (i / max(len(chunks), 1)) * 65
                job_store.update(
                    job_id,
                    phase=Phase.SUMMARIZING,
                    progress=progress,
                    current=i + 1,
                    total=len(chunks),
                    message=f"Summarizing chunk {i + 1}/{len(chunks)}"
                )
                
                # Generate chunk summary using language-specific prompt
                chunk_prompt = get_chunk_prompt(language).format(chunk=chunk)
                chunk_summary = self.ollama_client.generate(
                    chunk_prompt,
                    options={
                        "temperature": 0.2,
                        "top_p": 0.8,
                        "top_k": 10,
                        "num_predict": 300,
                    },
                )
                chunk_summaries.append(chunk_summary)
                
                # Small delay to prevent overwhelming the model
                await asyncio.sleep(0.1)
            
            # Merge summaries
            job_store.update(
                job_id,
                phase=Phase.FINALIZING,
                progress=95.0,
                message="Merging chunk summaries"
            )
            
            # Concatenate summaries
            combined_summaries = "\n\n".join(chunk_summaries)
            
            # Generate final merged summary
            merge_prompt = get_merge_prompt(language).format(
                summaries=combined_summaries,
                lang=language
            )
            
            final_summary = self.ollama_client.generate(
                merge_prompt,
                options={
                    "temperature": 0.2,
                    "top_p": 0.8,
                    "top_k": 10,
                    "num_predict": 400,
                },
            )
            
            return final_summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return f"Summary generation failed: {str(e)}"
    
    def _split_text_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks of approximately chunk_size characters"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # Try to find a good break point (sentence end, newline, or space)
            if end < len(text):
                # Look for sentence endings
                for i in range(end, max(start + chunk_size // 2, start), -1):
                    if text[i] in '.!?\n':
                        end = i + 1
                        break
                
                # If no good break point, look for spaces
                if end == start + chunk_size:
                    for i in range(end, max(start + chunk_size // 2, start), -1):
                        if text[i] == ' ':
                            end = i + 1
                            break
            
            chunks.append(text[start:end].strip())
            start = end
        
        return chunks
    
    def _is_cancelled(self, job_id: str) -> bool:
        """Check if job has been cancelled"""
        job = job_store.get(job_id)
        return job and job.phase == Phase.CANCELED


# Global service instance
chunked_service = ChunkedTranscriptionService()
