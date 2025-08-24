"""Job management system for handling async AI processing with progress tracking"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Callable, List
from dataclasses import dataclass
from enum import Enum

from ..database import Job, JobStatus, JobType, get_db
from ..core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class JobProgress:
    """Job progress information"""
    job_id: str
    status: JobStatus
    progress_percent: float
    current_phase: str
    phase_progress: float
    estimated_remaining_seconds: Optional[float]
    message: str


class JobPhase(Enum):
    """Job processing phases"""
    INITIALIZING = "initializing"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    FINALIZING = "finalizing"


class JobManager:
    """Manages job processing with progress tracking and ETA calculation"""
    
    def __init__(self):
        self.active_jobs: Dict[str, asyncio.Task] = {}
        self.progress_callbacks: Dict[str, List[Callable[[JobProgress], None]]] = {}
        self.job_handlers: Dict[JobType, Callable] = {}
        
    async def submit_job(
        self, 
        user_id: str, 
        job_type: JobType, 
        input_data: Dict[str, Any]
    ) -> str:
        """Submit a new job for processing"""
        job_id = str(uuid.uuid4())
        
        # Create job record
        db = next(get_db())
        try:
            job = Job(
                id=job_id,
                user_id=user_id,
                job_type=job_type,
                status=JobStatus.PENDING,
                input_data=json.dumps(input_data),
                current_phase=JobPhase.INITIALIZING.value,
                progress_percent=0.0,
                phase_progress=0.0
            )
            db.add(job)
            db.commit()
            
            # Start processing
            task = asyncio.create_task(self._process_job(job_id))
            self.active_jobs[job_id] = task
            
            logger.info(f"Job {job_id} submitted for {job_type.value}")
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to submit job {job_id}: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    async def get_job_status(self, job_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a job"""
        db = next(get_db())
        try:
            job = db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()
            if not job:
                return None
                
            return {
                "id": job.id,
                "type": job.job_type.value,
                "status": job.status.value,
                "progress_percent": job.progress_percent,
                "current_phase": job.current_phase,
                "phase_progress": job.phase_progress,
                "estimated_remaining_seconds": job.estimated_remaining_seconds,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "result_data": json.loads(job.result_data) if job.result_data else None,
                "error_message": job.error_message
            }
        finally:
            db.close()
    
    async def cancel_job(self, job_id: str, user_id: str) -> bool:
        """Cancel a running job"""
        if job_id in self.active_jobs:
            # Cancel the task
            task = self.active_jobs[job_id]
            task.cancel()
            del self.active_jobs[job_id]
            
            # Update database
            db = next(get_db())
            try:
                job = db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()
                if job:
                    job.status = JobStatus.CANCELLED
                    job.completed_at = datetime.utcnow()
                    db.commit()
                    logger.info(f"Job {job_id} cancelled")
                    return True
            except Exception as e:
                logger.error(f"Failed to cancel job {job_id}: {e}")
                db.rollback()
            finally:
                db.close()
        
        return False
    
    def register_handler(self, job_type: JobType, handler: Callable):
        """Register a handler function for a specific job type"""
        self.job_handlers[job_type] = handler
        logger.info(f"Registered handler for job type: {job_type.value}")
    
    def subscribe_to_progress(self, job_id: str, callback: Callable[[JobProgress], None]):
        """Subscribe to progress updates for a specific job"""
        if job_id not in self.progress_callbacks:
            self.progress_callbacks[job_id] = []
        self.progress_callbacks[job_id].append(callback)
    
    def unsubscribe_from_progress(self, job_id: str, callback: Callable[[JobProgress], None]):
        """Unsubscribe from progress updates for a specific job"""
        if job_id in self.progress_callbacks:
            try:
                self.progress_callbacks[job_id].remove(callback)
            except ValueError:
                pass
    
    async def _process_job(self, job_id: str):
        """Process a job with progress tracking"""
        db = next(get_db())
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                logger.error(f"Job {job_id} not found")
                return
            
            # Update status to processing
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            db.commit()
            
            # Get handler for this job type
            handler = self.job_handlers.get(job.job_type)
            if not handler:
                raise ValueError(f"No handler registered for job type: {job.job_type}")
            
            # Process with progress tracking
            result = await self._execute_with_progress(job_id, handler, job)
            
            # Update job with result
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.progress_percent = 100.0
            job.phase_progress = 100.0
            job.result_data = json.dumps(result)
            db.commit()
            
            logger.info(f"Job {job_id} completed successfully")
            
        except asyncio.CancelledError:
            # Job was cancelled
            logger.info(f"Job {job_id} was cancelled")
            if job:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            # Job failed
            logger.error(f"Job {job_id} failed: {e}")
            if job:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.utcnow()
                job.error_message = str(e)
                db.commit()
        finally:
            # Cleanup
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            db.close()
    
    async def _execute_with_progress(
        self, 
        job_id: str, 
        handler: Callable, 
        job: Job
    ) -> Dict[str, Any]:
        """Execute job handler with progress tracking"""
        start_time = time.time()
        
        # Create progress tracker
        progress_tracker = JobProgressTracker(job_id, job, self._notify_progress)
        
        # Execute handler with progress tracking
        if asyncio.iscoroutinefunction(handler):
            result = await handler(job, progress_tracker)
        else:
            result = handler(job, progress_tracker)
        
        return result
    
    def _notify_progress(self, job_id: str, progress: JobProgress):
        """Notify all subscribers of progress updates"""
        if job_id in self.progress_callbacks:
            for callback in self.progress_callbacks[job_id]:
                try:
                    callback(progress)
                except Exception as e:
                    logger.error(f"Progress callback failed: {e}")
    
    async def cleanup_completed_jobs(self, max_age_hours: int = 24):
        """Clean up old completed jobs"""
        db = next(get_db())
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
            
            # Delete old completed/failed/cancelled jobs
            old_jobs = db.query(Job).filter(
                Job.status.in_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]),
                Job.completed_at < cutoff_time
            ).all()
            
            for job in old_jobs:
                db.delete(job)
            
            db.commit()
            logger.info(f"Cleaned up {len(old_jobs)} old jobs")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old jobs: {e}")
            db.rollback()
        finally:
            db.close()


class JobProgressTracker:
    """Tracks progress for a specific job"""
    
    def __init__(self, job_id: str, job: Job, notify_callback: Callable):
        self.job_id = job_id
        self.job = job
        self.notify_callback = notify_callback
        self.start_time = time.time()
        self.phase_start_time = time.time()
        self.current_phase = JobPhase.INITIALIZING
    
    def update_progress(
        self, 
        progress_percent: float, 
        phase: JobPhase, 
        phase_progress: float,
        message: str = ""
    ):
        """Update job progress"""
        # Update phase if changed
        if phase != self.current_phase:
            self.current_phase = phase
            self.phase_start_time = time.time()
        
        # Calculate ETA
        eta_seconds = self._calculate_eta(progress_percent)
        
        # Update database
        db = next(get_db())
        try:
            self.job.progress_percent = progress_percent
            self.job.current_phase = phase.value
            self.job.phase_progress = phase_progress
            self.job.estimated_remaining_seconds = eta_seconds
            db.commit()
            
            # Notify subscribers
            progress = JobProgress(
                job_id=self.job_id,
                status=self.job.status,
                progress_percent=progress_percent,
                current_phase=phase.value,
                phase_progress=phase_progress,
                estimated_remaining_seconds=eta_seconds,
                message=message
            )
            self.notify_callback(self.job_id, progress)
            
        except Exception as e:
            logger.error(f"Failed to update progress for job {self.job_id}: {e}")
            db.rollback()
        finally:
            db.close()
    
    def _calculate_eta(self, progress_percent: float) -> Optional[float]:
        """Calculate estimated time remaining"""
        if progress_percent <= 0:
            return None
        
        elapsed_time = time.time() - self.start_time
        if progress_percent >= 100:
            return 0.0
        
        # Simple linear estimation
        total_estimated_time = elapsed_time / (progress_percent / 100.0)
        remaining_time = total_estimated_time - elapsed_time
        
        return max(0.0, remaining_time)


# Global job manager instance
job_manager = JobManager()
