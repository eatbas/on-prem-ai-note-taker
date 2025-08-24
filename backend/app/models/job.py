"""Job database model and enums"""

import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Enum, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class JobStatus(enum.Enum):
    """Job status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(enum.Enum):
    """Job type enumeration"""
    TRANSCRIPTION = "transcription"
    SUMMARIZATION = "summarization"
    TRANSCRIBE_AND_SUMMARIZE = "transcribe_and_summarize"


class Job(Base):
    """Job tracking model for async processing"""
    __tablename__ = "jobs"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    job_type = Column(Enum(JobType), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    
    # Input data (JSON stored as string)
    input_data = Column(Text, nullable=True)
    
    # Progress tracking
    progress_percent = Column(Float, default=0.0)
    current_phase = Column(String, nullable=True)  # e.g., "transcribing", "summarizing"
    phase_progress = Column(Float, default=0.0)  # Progress within current phase
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Results (JSON stored as string)
    result_data = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # ETA calculation
    estimated_remaining_seconds = Column(Float, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="jobs")
