"""Chunked transcription and summarization service with progress tracking"""

import os
import tempfile
import json
import asyncio
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import logging

from .progress import job_store, Phase
from .prompts import get_chunk_prompt, get_merge_prompt
from .audio_utils import get_audio_duration, split_audio_into_chunks, cleanup_chunk_files
from .ollama_client import OllamaClient
from .config import settings

logger = logging.getLogger(__name__)


class ChunkedTranscriptionService:
    """Service for chunked transcription and summarization"""
    
    def __init__(self):
        self.ollama_client = OllamaClient(
            base_url=settings.ollama_base_url,
            default_model=settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
        )
    
    async def process_audio_file(
        self,
        job_id: str,
        file_path: str,
        language: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process audio file with chunked transcription and summarization
        """
        try:
            # Get audio duration and info
            total_duration = get_audio_duration(file_path)
            logger.info(f"Processing audio file: {file_path}, duration: {total_duration:.2f}s")
            
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
            
            # Split audio into chunks
            chunks = split_audio_into_chunks(file_path, chunk_duration=45, overlap=5)
            logger.info(f"Split audio into {len(chunks)} chunks")
            
            # Update progress
            job_store.update(
                job_id,
                progress=10.0,
                message=f"Processing {len(chunks)} audio chunks"
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
                
                # Process chunk
                chunk_result = await self._process_chunk(
                    job_id, chunk_path, start_time, end_time, 
                    chunk_idx, len(chunks), processed_seconds, total_duration
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
                job_store.update(
                    job_id,
                    progress=progress,
                    current=int(processed_seconds),
                    total=int(total_duration),
                    message=f"Transcribed chunk {chunk_idx + 1}/{len(chunks)}"
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
                from .database import get_db, get_or_create_user, Meeting, Transcription, Summary
                db = next(get_db())
                user = get_or_create_user(db)
                
                # Create meeting record
                meeting_id = job_id
                meeting = Meeting(
                    id=meeting_id,
                    user_id=user.id,
                    title=f"Meeting {meeting_id[:8]}",
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
    
    async def _process_chunk(
        self,
        job_id: str,
        chunk_path: str,
        start_time: float,
        end_time: float,
        chunk_idx: int,
        total_chunks: int,
        processed_seconds: float,
        total_duration: float
    ) -> Dict[str, Any]:
        """Process a single audio chunk"""
        try:
            # Import here to avoid circular imports
            from .main import get_whisper_model
            
            # Get Whisper model
            model = get_whisper_model()
            
            # Transcribe chunk
            segments, info = model.transcribe(
                chunk_path,
                language=None,  # Let Whisper auto-detect for chunks
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=100
                ),
                beam_size=settings.whisper_beam_size,
                best_of=1,
                temperature=0.0,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0
            )
            
            # Process segments
            segments_out = []
            text_parts = []
            
            for s in segments:
                text_cleaned = s.text.strip()
                if text_cleaned:
                    # Adjust timestamps to global time
                    global_start = start_time + float(s.start)
                    global_end = start_time + float(s.end)
                    
                    segments_out.append({
                        "start": global_start,
                        "end": global_end,
                        "text": text_cleaned
                    })
                    text_parts.append(text_cleaned)
            
            return {
                "segments": segments_out,
                "text_parts": text_parts,
                "language": info.language if hasattr(info, "language") else None
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
                
                # Generate chunk summary
                chunk_prompt = get_chunk_prompt(language).format(chunk=chunk)
                chunk_summary = self.ollama_client.summarize(chunk_prompt)
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
            
            final_summary = self.ollama_client.summarize(merge_prompt)
            
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
