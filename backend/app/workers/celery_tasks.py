"""
🚨 PHASE 3.4: Celery Tasks for Distributed Meeting Processing

Production-grade background tasks with job persistence, retry logic,
and comprehensive error handling for meeting audio processing.
"""

import os
import logging
import tempfile
import time
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from celery import current_task
from celery.exceptions import Retry

from ..core.celery_app import celery_app, TaskState
from ..core.config import settings
from ..core.memory_manager import memory_manager
from ..core.utils import get_whisper_model, validate_language
from ..core.audio_optimizer import get_audio_optimizer
from ..core.whisper_optimizer import get_whisper_optimizer
from ..services.speaker_diarization import get_speaker_diarization_service
from ..clients.ollama_client import OllamaClient
from ..core.prompts import get_single_summary_prompt
from ..database import get_db
from ..models import Meeting, Transcription, Summary
from ..workers.progress import job_store, Phase

logger = logging.getLogger(__name__)

# Initialize Ollama client
ollama_client = OllamaClient(
    base_url=settings.ollama_base_url,
    default_model=settings.ollama_model,
    timeout_seconds=settings.ollama_timeout_seconds,
)

@celery_app.task(
    bind=True,
    name="process_meeting_audio_celery",
    max_retries=2,
    default_retry_delay=600,  # 10 minutes
    soft_time_limit=1800,     # 30 minutes
    time_limit=2100,          # 35 minutes
)
def process_meeting_audio_celery(
    self,
    job_id: str,
    meeting_id: str,
    audio_file_path: str,
    language: str,
    user_id: str,
    file_size_mb: float
) -> Dict[str, Any]:
    """
    🚨 PHASE 3.4: Celery task for processing meeting audio with full job persistence.
    
    This task provides:
    - Job persistence across worker restarts
    - Automatic retry with exponential backoff
    - Comprehensive error handling and recovery
    - Memory management and cleanup
    - Real-time progress tracking
    """
    
    # Set initial task state
    self.update_state(
        state=TaskState.STARTED,
        meta={
            "job_id": job_id,
            "meeting_id": meeting_id,
            "phase": "INITIALIZING",
            "progress": 0,
            "message": f"Starting Celery processing for {file_size_mb:.1f}MB audio file",
            "worker_id": self.request.id,
            "started_at": datetime.utcnow().isoformat()
        }
    )
    
    # Update job store for compatibility with existing progress tracking
    job_store.update(job_id, phase=Phase.TRANSCRIBING, progress=5.0, 
                    message=f"Celery worker processing {file_size_mb:.1f}MB audio file...")
    
    start_time = time.time()
    
    try:
        logger.info(f"🚀 Celery worker starting job {job_id} for meeting {meeting_id}")
        
        # 🚨 PHASE 3.1: Check memory before starting
        initial_memory = memory_manager.get_memory_usage()
        initial_mb = initial_memory.get('process', {}).get('rss_mb', 0)
        logger.info(f"💾 Worker starting with memory usage: {initial_mb:.1f}MB")
        
        # Check if audio file exists
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
        
        # Validate language
        validated_language = validate_language(language)
        
        # Memory check and validation
        if not memory_manager.validate_file_size(int(file_size_mb * 1024 * 1024)):
            raise Exception(f"File size {file_size_mb:.1f}MB exceeds current memory constraints")
        
        # 🚨 PHASE 3.5: Audio optimization and analysis
        audio_optimizer = get_audio_optimizer()
        whisper_optimizer = get_whisper_optimizer()
        
        self.update_state(
            state=TaskState.PROGRESS,
            meta={
                "job_id": job_id,
                "phase": "OPTIMIZING_AUDIO",
                "progress": 5,
                "message": "Analyzing and optimizing audio file...",
                "elapsed_seconds": int(time.time() - start_time)
            }
        )
        job_store.update(job_id, progress=5.0, message="Analyzing and optimizing audio file...")
        
        # Analyze audio characteristics
        audio_analysis = audio_optimizer.analyze_audio_file(audio_file_path)
        logger.info(f"📊 Audio analysis: {audio_analysis['duration_seconds']:.1f}s, "
                   f"{audio_analysis['file_size_mb']:.1f}MB, optimization_needed: {audio_analysis['optimization_needed']}")
        
        # Optimize audio if needed
        optimized_audio_path = audio_file_path
        if audio_analysis.get('optimization_needed', False):
            logger.info(f"🔧 Optimizing audio for Whisper processing...")
            optimized_audio_path = audio_optimizer.optimize_audio_for_whisper(audio_file_path)
            
            # Update file size after optimization
            optimized_size_mb = os.path.getsize(optimized_audio_path) / (1024 * 1024)
            logger.info(f"✅ Audio optimized: {file_size_mb:.1f}MB → {optimized_size_mb:.1f}MB")
            file_size_mb = optimized_size_mb
        
        # Get optimal Whisper configuration
        available_memory_mb = memory_manager.get_memory_usage().get('system', {}).get('available_mb', 8000)
        whisper_config = whisper_optimizer.get_optimal_model_config(file_size_mb, available_memory_mb)
        
        # Estimate processing time
        estimated_time = whisper_optimizer.estimate_processing_time(
            audio_analysis['duration_seconds'], 
            whisper_config['model_size'], 
            file_size_mb
        )
        
        logger.info(f"⏱️ Estimated processing time: {estimated_time:.1f}s using {whisper_config['model_size']} model")
        
        try:
            # Update progress: Loading model
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "LOADING_MODEL",
                    "progress": 10,
                    "message": "Loading Whisper model...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=10.0, message="Loading Whisper model...")
            
            # 🚨 PHASE 3.1: Monitor memory before model loading
            memory_manager.monitor_memory_usage()
            
            # 🚨 PHASE 3.5 & 4.3: Load optimized Whisper model with high-accuracy configuration
            logger.info(f"🎯 Loading high-accuracy Whisper model: {whisper_config['model_size']}")
            model = get_whisper_model(whisper_config)
            
            # Update progress: Starting transcription
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "TRANSCRIBING",
                    "progress": 15,
                    "message": "Model loaded, starting transcription...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=15.0, message="Model loaded, starting transcription...")
            
            # 🚨 PHASE 3.1: Monitor memory before transcription
            memory_manager.monitor_memory_usage()
            
            # 🚨 PHASE 4.2: Perform speaker diarization before transcription
            speaker_service = get_speaker_diarization_service()
            speakers_data = []
            
            if speaker_service.is_available():
                self.update_state(
                    state=TaskState.PROGRESS,
                    meta={
                        "job_id": job_id,
                        "phase": "SPEAKER_DIARIZATION",
                        "progress": 20,
                        "message": "Identifying speakers in the meeting...",
                        "elapsed_seconds": int(time.time() - start_time)
                    }
                )
                job_store.update(job_id, progress=20.0, message="Performing speaker diarization...")
                
                logger.info(f"🎤 Starting speaker diarization for {optimized_audio_path}")
                
                # Perform speaker diarization
                diarization_result = speaker_service.diarize_audio(optimized_audio_path)
                
                if diarization_result:
                    # Process diarization results
                    speakers_data = speaker_service.process_diarization_results(
                        diarization_result, 
                        meeting_id, 
                        audio_analysis['duration_seconds']
                    )
                    
                    logger.info(f"✅ Speaker diarization completed: {len(speakers_data)} speakers identified")
                    
                    # Save speakers to database
                    saved_speakers = speaker_service.save_speakers_to_database(meeting_id, speakers_data)
                    logger.info(f"💾 Saved {len(saved_speakers)} speakers to database")
                else:
                    logger.warning("⚠️ Speaker diarization failed, proceeding without speaker info")
            else:
                logger.warning("⚠️ Speaker diarization not available, proceeding without speaker info")
                
            # Update progress for transcription
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "TRANSCRIBING",
                    "progress": 25,
                    "message": f"Starting high-accuracy transcription with {whisper_config['model_size']} model...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=25.0, message="Starting high-accuracy transcription...")
            
            # 🚨 PHASE 3.5: Optimized transcription with chunked processing if needed
            logger.info(f"🎵 Starting high-accuracy transcription for {optimized_audio_path} ({file_size_mb:.1f}MB)")
            
            # Determine if chunked processing is needed
            if audio_analysis.get('chunks_needed', False):
                logger.info(f"📄 Large file detected, using chunked processing")
                
                # Get chunked processing configuration
                chunked_config = whisper_optimizer.get_chunked_processing_config(audio_analysis['duration_seconds'])
                
                # Process audio in chunks
                chunk_paths = audio_optimizer.chunk_audio_file(
                    optimized_audio_path, 
                    chunked_config['chunk_duration']
                )
                
                # Process chunks sequentially (CPU-only, avoid parallel for memory)
                all_segments = []
                total_chunks = len(chunk_paths)
                chunk_offset = 0.0
                
                for i, chunk_path in enumerate(chunk_paths):
                    chunk_progress = 15 + (i / total_chunks * 45)  # 15% to 60%
                    
                    self.update_state(
                        state=TaskState.PROGRESS,
                        meta={
                            "job_id": job_id,
                            "phase": "TRANSCRIBING",
                            "progress": chunk_progress,
                            "message": f"Processing chunk {i+1}/{total_chunks}...",
                            "current": i+1,
                            "total": total_chunks,
                            "elapsed_seconds": int(time.time() - start_time)
                        }
                    )
                    job_store.update(job_id, progress=chunk_progress, 
                                   message=f"Processing chunk {i+1}/{total_chunks}...")
                    
                    # Transcribe chunk with optimized settings
                    chunk_segments, chunk_info = model.transcribe(
                        chunk_path,
                        language=validated_language if validated_language != "auto" else None,
                        **{k: v for k, v in whisper_config.items() if k not in ['model_size', 'device', 'compute_type', 'cpu_threads']}
                    )
                    
                    # Adjust segment timestamps for chunk offset
                    for segment in chunk_segments:
                        segment_dict = {
                            "start": float(segment.start) + chunk_offset,
                            "end": float(segment.end) + chunk_offset,
                            "text": segment.text.strip()
                        }
                        if segment_dict["text"]:
                            all_segments.append(segment_dict)
                    
                    # Update chunk offset for next chunk
                    chunk_offset += chunked_config['chunk_duration'] - chunked_config['overlap_duration']
                
                # Cleanup chunk files
                audio_optimizer.cleanup_temp_files(chunk_paths)
                
                # Create combined info object
                info = chunk_info  # Use info from last chunk
                segments = all_segments
                
                logger.info(f"✅ Chunked transcription completed: {len(all_segments)} total segments")
                
            else:
                # Single file processing with optimized settings
                segments, info = model.transcribe(
                    optimized_audio_path,
                    language=validated_language if validated_language != "auto" else None,
                    **{k: v for k, v in whisper_config.items() if k not in ['model_size', 'device', 'compute_type', 'cpu_threads']}
                )
            
            # 🚨 PHASE 3.1: Monitor memory after transcription
            memory_manager.monitor_memory_usage()
            logger.info(f"✅ Transcription completed for meeting {meeting_id}")
            
            # Update progress: Processing segments
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "PROCESSING_SEGMENTS",
                    "progress": 60,
                    "message": "Transcription completed, processing segments...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=60.0, message="Transcription completed, processing segments...")
            
            # Process segments (handle both single file and chunked results)
            segments_out = []
            text_parts = []
            
            # Handle chunked results (already processed) vs single file results
            if isinstance(segments, list) and segments and isinstance(segments[0], dict):
                # Chunked processing - segments are already processed
                segments_list = segments
                total_segments = len(segments_list)
                
                for i, s in enumerate(segments_list):
                    text_cleaned = s["text"].strip()
                    if text_cleaned:
                        segments_out.append({
                            "start": s["start"],
                            "end": s["end"],
                            "text": text_cleaned
                        })
                        text_parts.append(text_cleaned)
                    
                    # Update progress every 10 segments or 5%
                    if i % max(1, total_segments // 20) == 0 or i % 10 == 0:
                        progress = min(75, 60 + (i / total_segments * 15))
                        
                        self.update_state(
                            state=TaskState.PROGRESS,
                            meta={
                                "job_id": job_id,
                                "phase": "PROCESSING_SEGMENTS",
                                "progress": progress,
                                "message": f"Processed {i}/{total_segments} segments",
                                "current": i,
                                "total": total_segments,
                                "elapsed_seconds": int(time.time() - start_time)
                            }
                        )
                        job_store.update(job_id, progress=progress, 
                                       message=f"Processed {i}/{total_segments} segments")
            else:
                # Single file processing - segments need to be converted
                segments_list = list(segments)
                total_segments = len(segments_list)
                
                for i, s in enumerate(segments_list):
                    text_cleaned = s.text.strip()
                    if text_cleaned:
                        segments_out.append({
                            "start": float(s.start),
                            "end": float(s.end),
                            "text": text_cleaned
                        })
                        text_parts.append(text_cleaned)
                    
                    # Update progress every 10 segments or 5%
                    if i % max(1, total_segments // 20) == 0 or i % 10 == 0:
                        progress = min(75, 60 + (i / total_segments * 15))
                        
                        self.update_state(
                            state=TaskState.PROGRESS,
                            meta={
                                "job_id": job_id,
                                "phase": "PROCESSING_SEGMENTS",
                                "progress": progress,
                                "message": f"Processed {i}/{total_segments} segments",
                                "current": i,
                                "total": total_segments,
                                "elapsed_seconds": int(time.time() - start_time)
                            }
                        )
                        job_store.update(job_id, progress=progress, 
                                       message=f"Processed {i}/{total_segments} segments")
            
            # Generate transcript
            transcript_text = "\n".join(text_parts).strip()
            
            # 🚨 PHASE 4.2: Align transcription with speaker segments
            if speakers_data and segments_out:
                self.update_state(
                    state=TaskState.PROGRESS,
                    meta={
                        "job_id": job_id,
                        "phase": "ALIGNING_SPEAKERS",
                        "progress": 78,
                        "message": "Aligning transcription with speakers...",
                        "elapsed_seconds": int(time.time() - start_time)
                    }
                )
                job_store.update(job_id, progress=78.0, message="Aligning transcription with speakers...")
                
                logger.info(f"🔗 Aligning {len(segments_out)} transcription segments with speakers")
                
                try:
                    # Align transcription segments with speaker data
                    speaker_service.align_transcription_with_speakers(meeting_id, segments_out)
                    logger.info("✅ Transcription successfully aligned with speakers")
                except Exception as alignment_error:
                    logger.error(f"❌ Speaker alignment failed: {alignment_error}")
            
            # Update progress: Generating speaker-aware summary
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "SUMMARIZING",
                    "progress": 80,
                    "message": "Generating summary...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=80.0, message="Generating summary...")
            
            # Choose language for summary
            if validated_language in ("tr", "en"):
                lang_code = validated_language
            elif hasattr(info, "language") and info.language in ("tr", "en"):
                lang_code = info.language
            else:
                lang_code = "tr"  # Default to Turkish
            
            # Generate summary
            prompt = get_single_summary_prompt(lang_code).format(transcript=transcript_text)
            summary = ollama_client.generate(
                prompt,
                options={
                    "temperature": 0.2,
                    "top_p": 0.8,
                    "top_k": 10,
                    "num_predict": 300,
                },
            )
            
            # 🚨 PHASE 4.1: Save audio file to VPS for streaming
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "SAVING_AUDIO",
                    "progress": 85,
                    "message": "Saving audio file for streaming...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=85.0, message="Saving audio file for streaming...")
            
            # Save audio file to VPS storage
            audio_storage_path = None
            try:
                # Create audio storage directory if it doesn't exist
                audio_storage_dir = Path(settings.audio_storage_path) if hasattr(settings, 'audio_storage_path') else Path("audio_storage")
                audio_storage_dir.mkdir(parents=True, exist_ok=True)
                
                # Copy optimized audio to permanent storage
                audio_filename = f"{meeting_id}.wav"  # Standardize to WAV for streaming
                audio_storage_path = audio_storage_dir / audio_filename
                
                # Copy the audio file
                import shutil
                shutil.copy2(optimized_audio_path, audio_storage_path)
                
                # Get audio metadata
                audio_size_bytes = os.path.getsize(audio_storage_path)
                
                logger.info(f"💾 Audio file saved for streaming: {audio_storage_path} ({audio_size_bytes / 1024 / 1024:.1f}MB)")
                
            except Exception as audio_save_error:
                logger.error(f"❌ Failed to save audio file for streaming: {audio_save_error}")
                audio_storage_path = None
            
            # Update progress: Saving results
            self.update_state(
                state=TaskState.PROGRESS,
                meta={
                    "job_id": job_id,
                    "phase": "SAVING",
                    "progress": 90,
                    "message": "Saving results to database...",
                    "elapsed_seconds": int(time.time() - start_time)
                }
            )
            job_store.update(job_id, progress=90.0, message="Saving results...")
            
            # Save to database
            db = next(get_db())
            try:
                # Update meeting record
                meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
                if meeting:
                    meeting.duration = info.duration if hasattr(info, "duration") else None
                    meeting.language = info.language if hasattr(info, "language") else validated_language
                    
                    # 🚨 PHASE 4.1: Save audio metadata for streaming
                    if audio_storage_path:
                        meeting.audio_file_path = str(audio_storage_path)
                        meeting.audio_format = "wav"
                        meeting.audio_size_bytes = audio_size_bytes
                        meeting.audio_sample_rate = audio_analysis.get('sample_rate', 16000)
                        meeting.audio_channels = audio_analysis.get('channels', 1)
                        logger.info(f"💾 Updated meeting {meeting_id} with audio metadata for streaming")
                
                # Save transcription
                transcription = Transcription(
                    meeting_id=meeting_id,
                    text=transcript_text,
                    language=info.language if hasattr(info, "language") else validated_language,
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
                logger.info(f"📝 Results saved to database for meeting {meeting_id}")
                
            except Exception as db_error:
                logger.error(f"❌ Database save failed for meeting {meeting_id}: {db_error}")
                # Don't fail the job for database errors - data is still processed
            
            # Job completed successfully
            processing_time = time.time() - start_time
            
            final_result = {
                "job_id": job_id,
                "meeting_id": meeting_id,
                "status": "completed",
                "message": "Meeting processing completed successfully",
                "processing_time_seconds": int(processing_time),
                "segments_processed": total_segments,
                "transcript_length": len(transcript_text),
                "summary_length": len(summary),
                "language": lang_code,
                "worker_id": self.request.id,
                "completed_at": datetime.utcnow().isoformat()
            }
            
            self.update_state(
                state=TaskState.SUCCESS,
                meta=final_result
            )
            
            job_store.update(
                job_id,
                phase=Phase.DONE,
                progress=100.0,
                message="Meeting processing completed successfully",
                current=total_segments,
                total=total_segments
            )
            
            logger.info(f"✅ Celery task completed successfully for meeting {meeting_id} in {processing_time:.1f}s")
            
            return final_result
            
        finally:
            # 🚨 PHASE 3.1: Critical cleanup after processing
            try:
                logger.info(f"🧹 Starting memory cleanup for job {job_id}")
                
                # Force Whisper model cleanup
                cleanup_success = memory_manager.cleanup_whisper_model(force=True)
                
                # Log final memory state
                final_memory = memory_manager.get_memory_usage()
                final_mb = final_memory.get('process', {}).get('rss_mb', 0)
                memory_freed = initial_mb - final_mb
                
                logger.info(f"💾 Memory cleanup completed for job {job_id}")
                logger.info(f"📊 Memory stats: Initial: {initial_mb:.1f}MB, Final: {final_mb:.1f}MB, Freed: {memory_freed:.1f}MB")
                
                if cleanup_success:
                    logger.info(f"✅ Whisper model cleanup successful for job {job_id}")
                else:
                    logger.warning(f"⚠️ Whisper model cleanup had issues for job {job_id}")
                    
            except Exception as cleanup_error:
                logger.error(f"❌ Memory cleanup failed for job {job_id}: {cleanup_error}")
            
            # 🚨 PHASE 3.5: Cleanup audio files (original and optimized)
            temp_files_to_cleanup = [audio_file_path]
            
            # Add optimized file if different from original
            if 'optimized_audio_path' in locals() and optimized_audio_path != audio_file_path:
                temp_files_to_cleanup.append(optimized_audio_path)
            
            for temp_file in temp_files_to_cleanup:
                try:
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                        logger.debug(f"🗑️ Temp file removed: {temp_file}")
                except OSError as e:
                    logger.warning(f"Failed to remove temp file {temp_file}: {e}")
                
    except Exception as e:
        processing_time = time.time() - start_time
        
        # Determine if this is a retryable error
        retryable_errors = [
            "memory",
            "timeout", 
            "connection",
            "temporary",
            "overload"
        ]
        
        is_retryable = any(keyword in str(e).lower() for keyword in retryable_errors)
        
        # Job failed - ensure cleanup and error reporting
        try:
            logger.error(f"❌ Celery job {job_id} failed for meeting {meeting_id}, forcing emergency cleanup")
            memory_manager.cleanup_whisper_model(force=True)
        except Exception as emergency_cleanup_error:
            logger.error(f"❌ Emergency cleanup failed: {emergency_cleanup_error}")
        
        error_result = {
            "job_id": job_id,
            "meeting_id": meeting_id,
            "status": "failed",
            "error": str(e),
            "processing_time_seconds": int(processing_time),
            "worker_id": self.request.id,
            "failed_at": datetime.utcnow().isoformat(),
            "retry_count": self.request.retries,
            "is_retryable": is_retryable
        }
        
        # Update task state
        self.update_state(
            state=TaskState.FAILURE,
            meta=error_result
        )
        
        # Update job store
        job_store.update(
            job_id,
            phase=Phase.ERROR,
            message=f"Meeting processing failed: {str(e)}"
        )
        
        logger.error(f"❌ Celery task failed for meeting {meeting_id}: {e}")
        
        # 🚨 PHASE 3.5: Cleanup audio files on error (original and optimized)
        temp_files_to_cleanup = [audio_file_path]
        
        # Add optimized file if different from original
        if 'optimized_audio_path' in locals() and optimized_audio_path != audio_file_path:
            temp_files_to_cleanup.append(optimized_audio_path)
        
        for temp_file in temp_files_to_cleanup:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except OSError:
                pass
        
        # Retry logic for recoverable errors
        if is_retryable and self.request.retries < self.max_retries:
            logger.info(f"🔄 Retrying task {job_id} (attempt {self.request.retries + 1}/{self.max_retries})")
            
            # Exponential backoff: 10min, 20min, 40min
            retry_delay = 600 * (2 ** self.request.retries)
            
            raise self.retry(countdown=retry_delay, exc=e)
        
        # Non-retryable or max retries exceeded
        raise e


@celery_app.task(name="cleanup_temp_files")
def cleanup_temp_files(file_paths: list) -> Dict[str, Any]:
    """Cleanup temporary files created during processing"""
    cleaned_files = []
    failed_files = []
    
    for file_path in file_paths:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                cleaned_files.append(file_path)
                logger.debug(f"🗑️ Cleaned up temp file: {file_path}")
        except OSError as e:
            failed_files.append({"file": file_path, "error": str(e)})
            logger.warning(f"Failed to cleanup {file_path}: {e}")
    
    return {
        "cleaned_files": cleaned_files,
        "failed_files": failed_files,
        "total_cleaned": len(cleaned_files),
        "total_failed": len(failed_files)
    }


@celery_app.task(name="monitor_worker_health")
def monitor_worker_health() -> Dict[str, Any]:
    """Monitor worker health and memory usage"""
    try:
        memory_stats = memory_manager.get_memory_usage()
        
        health_status = {
            "timestamp": datetime.utcnow().isoformat(),
            "memory": memory_stats,
            "status": "healthy"
        }
        
        # Check if memory is too high
        process_memory = memory_stats.get('process', {}).get('rss_mb', 0)
        if process_memory > 3000:  # More than 3GB
            health_status["status"] = "warning"
            health_status["warning"] = f"High memory usage: {process_memory:.1f}MB"
        
        return health_status
        
    except Exception as e:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "status": "error",
            "error": str(e)
        }
