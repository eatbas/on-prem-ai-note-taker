"""Progress tracking module for job management with thread-safe in-memory storage"""

import time
import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class Phase(Enum):
    """Job processing phases"""
    QUEUED = "queued"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    FINALIZING = "finalizing"
    DONE = "done"
    ERROR = "error"
    CANCELED = "canceled"


@dataclass
class JobStatus:
    """Job status information with progress tracking"""
    id: str
    phase: Phase
    progress: float = 0.0  # 0-100
    message: str = ""
    eta_seconds: Optional[float] = None
    current: int = 0  # Current processed units (seconds, chunks, etc.)
    total: int = 0    # Total units to process
    started_at: Optional[datetime] = None
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # ETA calculation fields
    _processing_speed: float = 0.0  # Units per second (e.g., audio seconds per wall second)
    _last_speed_update: Optional[datetime] = None
    _speed_alpha: float = 0.3  # EWMA smoothing factor
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "phase": self.phase.value,
            "progress": round(self.progress, 2),
            "message": self.message,
            "eta_seconds": self.eta_seconds,
            "current": self.current,
            "total": self.total,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "updated_at": self.updated_at.isoformat(),
            "is_complete": self.phase in [Phase.DONE, Phase.ERROR, Phase.CANCELED],
            "is_running": self.phase in [Phase.TRANSCRIBING, Phase.SUMMARIZING, Phase.FINALIZING]
        }
    
    def update_progress(self, progress: float, message: str = "", current: Optional[int] = None, total: Optional[int] = None):
        """Update progress and recalculate ETA"""
        self.progress = max(0.0, min(100.0, progress))
        self.message = message
        self.updated_at = datetime.utcnow()
        
        if current is not None:
            self.current = current
        if total is not None:
            self.total = total
            
        # Calculate ETA if we have timing information
        self._calculate_eta()
    
    def _calculate_eta(self):
        """Calculate ETA using EWMA of processing speed"""
        if not self.started_at or self.total <= 0 or self.current <= 0:
            self.eta_seconds = None
            return
        
        now = datetime.utcnow()
        elapsed = (now - self.started_at).total_seconds()
        processed = self.current
        
        if elapsed > 0 and processed > 0:
            # Calculate current speed (units per second)
            current_speed = processed / elapsed
            
            # Update EWMA of speed
            if self._last_speed_update:
                time_diff = (now - self._last_speed_update).total_seconds()
                if time_diff > 0:
                    # Apply exponential smoothing
                    self._processing_speed = (
                        self._speed_alpha * current_speed + 
                        (1 - self._speed_alpha) * self._processing_speed
                    )
            else:
                self._processing_speed = current_speed
            
            self._last_speed_update = now
            
            # Calculate ETA
            remaining_units = self.total - self.current
            if self._processing_speed > 1e-6:  # Avoid division by zero
                self.eta_seconds = remaining_units / self._processing_speed
            else:
                self.eta_seconds = None
        else:
            self.eta_seconds = None


class JobStore:
    """Thread-safe in-memory job store with TTL cleanup"""
    
    def __init__(self, ttl_hours: int = 24):
        self._jobs: Dict[str, JobStatus] = {}
        self._lock = threading.RLock()
        self._ttl_hours = ttl_hours
    
    def create(self, job_id: str, phase: Phase = Phase.QUEUED) -> JobStatus:
        """Create a new job"""
        with self._lock:
            job = JobStatus(
                id=job_id,
                phase=phase,
                started_at=datetime.utcnow() if phase != Phase.QUEUED else None
            )
            self._jobs[job_id] = job
            logger.info(f"Created job {job_id} with phase {phase.value}")
            return job
    
    def get(self, job_id: str) -> Optional[JobStatus]:
        """Get job by ID, with TTL cleanup"""
        with self._lock:
            # Cleanup old jobs on access
            self._cleanup_expired_jobs()
            return self._jobs.get(job_id)
    
    def update(self, job_id: str, **kwargs) -> bool:
        """Update job fields"""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            
            # Update fields
            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            
            # Special handling for phase changes
            if 'phase' in kwargs:
                new_phase = kwargs['phase']
                if isinstance(new_phase, Phase):
                    job.phase = new_phase
                    if new_phase == Phase.TRANSCRIBING and not job.started_at:
                        job.started_at = datetime.utcnow()
                    elif new_phase in [Phase.DONE, Phase.ERROR, Phase.CANCELED]:
                        # Job completed, no need to track ETA
                        job.eta_seconds = None
            
            # Update timestamp
            job.updated_at = datetime.utcnow()
            
            # Recalculate ETA if progress-related fields changed
            if any(key in kwargs for key in ['progress', 'current', 'total']):
                job._calculate_eta()
            
            logger.debug(f"Updated job {job_id}: {kwargs}")
            return True
    
    def cancel(self, job_id: str) -> bool:
        """Cancel a job if it's running"""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            
            if job.phase in [Phase.QUEUED, Phase.TRANSCRIBING, Phase.SUMMARIZING, Phase.FINALIZING]:
                job.phase = Phase.CANCELED
                job.updated_at = datetime.utcnow()
                job.eta_seconds = None
                logger.info(f"Cancelled job {job_id}")
                return True
            
            return False
    
    def delete(self, job_id: str) -> bool:
        """Delete a job"""
        with self._lock:
            if job_id in self._jobs:
                del self._jobs[job_id]
                logger.info(f"Deleted job {job_id}")
                return True
            return False
    
    def list_jobs(self, phase: Optional[Phase] = None) -> List[JobStatus]:
        """List all jobs, optionally filtered by phase"""
        with self._lock:
            self._cleanup_expired_jobs()
            if phase:
                return [job for job in self._jobs.values() if job.phase == phase]
            return list(self._jobs.values())
    
    def get_stats(self) -> Dict:
        """Get store statistics"""
        with self._lock:
            self._cleanup_expired_jobs()
            total_jobs = len(self._jobs)
            phase_counts = {}
            for job in self._jobs.values():
                phase = job.phase.value
                phase_counts[phase] = phase_counts.get(phase, 0) + 1
            
            return {
                "total_jobs": total_jobs,
                "phase_counts": phase_counts,
                "ttl_hours": self._ttl_hours
            }
    
    def _cleanup_expired_jobs(self):
        """Remove jobs older than TTL"""
        cutoff_time = datetime.utcnow() - timedelta(hours=self._ttl_hours)
        expired_jobs = []
        
        for job_id, job in self._jobs.items():
            if job.updated_at < cutoff_time:
                expired_jobs.append(job_id)
        
        for job_id in expired_jobs:
            del self._jobs[job_id]
        
        if expired_jobs:
            logger.info(f"Cleaned up {len(expired_jobs)} expired jobs")


# Global singleton instance
job_store = JobStore()
