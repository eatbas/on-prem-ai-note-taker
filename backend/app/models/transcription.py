"""Transcription database model"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Transcription(Base):
    """Transcription model for meeting recordings"""
    __tablename__ = "transcriptions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    text = Column(Text, nullable=False)
    language = Column(String, nullable=True)
    
    # Timing information
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="transcriptions")
