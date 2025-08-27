"""Meeting database model"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Meeting(Base):
    """Meeting/recording session model"""
    __tablename__ = "meetings"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Audio metadata
    duration = Column(Float, nullable=True)  # Duration in seconds
    file_path = Column(String, nullable=True)  # Path to audio file
    language = Column(String, nullable=True, default="auto")  # Meeting language (tr, en, auto)
    
    # Tags support (JSON stored as string)
    tags = Column(Text, nullable=True)  # JSON array of strings
    
    # Relationships
    user = relationship("User", back_populates="meetings")
    transcriptions = relationship("Transcription", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="meeting", cascade="all, delete-orphan")
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")
