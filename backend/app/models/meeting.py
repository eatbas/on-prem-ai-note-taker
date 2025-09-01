"""Meeting database model"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey, Boolean, Integer
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
    file_path = Column(String, nullable=True)  # Path to audio file (legacy)
    
    # 🚨 PHASE 4.1: Enhanced audio storage for streaming
    audio_file_path = Column(String, nullable=True)  # VPS stored audio file path
    audio_format = Column(String, nullable=True)     # Audio format (wav, mp3, etc.)
    audio_size_bytes = Column(Integer, nullable=True)  # File size for streaming
    audio_sample_rate = Column(Integer, nullable=True)  # Sample rate (e.g., 16000)
    audio_channels = Column(Integer, nullable=True, default=1)  # Mono/stereo
    
    language = Column(String, nullable=True, default="auto")  # Meeting language (tr, en, auto)
    
    # Tags support (JSON stored as string)
    tags = Column(Text, nullable=True)  # JSON array of strings
    
    # Workspace relationship
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    is_personal = Column(Boolean, nullable=False, default=True)
    
    # Relationships - using string references to avoid circular imports
    user = relationship("User", back_populates="meetings")
    workspace = relationship("Workspace", back_populates="meetings")
    transcriptions = relationship("Transcription", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="meeting", cascade="all, delete-orphan")
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")
