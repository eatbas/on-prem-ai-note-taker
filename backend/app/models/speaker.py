"""Speaker database model for speaker diarization and custom naming"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Speaker(Base):
    """Speaker model for individual speakers in meetings"""
    __tablename__ = "speakers"
    
    id = Column(String, primary_key=True)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    
    # Speaker identification from diarization
    original_speaker_id = Column(String, nullable=False)  # e.g., "SPEAKER_1", "SPEAKER_2"
    
    # 🚨 PHASE 4.2: Enhanced speaker identification
    display_name = Column(String, nullable=False)  # "Speaker 1", "Speaker 2", etc.
    speaker_color = Column(String, nullable=True)  # Hex color for UI (#FF5733)
    
    # User-customizable speaker information
    custom_name = Column(String, nullable=True)  # User can rename speakers
    speaker_type = Column(String, nullable=False, default="SYSTEM")  # "USER" or "SYSTEM"
    
    # Speaker statistics
    total_segments = Column(Integer, default=0)
    total_duration = Column(Float, default=0.0)  # Total speaking time in seconds
    
    # 🚨 PHASE 4.2: Speaker insights
    talking_time_percentage = Column(Float, nullable=True)  # % of total meeting time
    average_segment_duration = Column(Float, nullable=True)  # Average speaking duration
    words_per_minute = Column(Float, nullable=True)  # Speaking pace
    sentiment_score = Column(Float, nullable=True)  # Overall sentiment (-1 to 1)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="speakers")
    segments = relationship("SpeakerSegment", back_populates="speaker", cascade="all, delete-orphan")


class SpeakerSegment(Base):
    """Individual speech segments with speaker attribution"""
    __tablename__ = "speaker_segments"
    
    id = Column(String, primary_key=True)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    speaker_id = Column(String, ForeignKey("speakers.id"), nullable=False)
    
    # Segment timing and content
    start_time = Column(Float, nullable=False)  # Start time in seconds
    end_time = Column(Float, nullable=False)    # End time in seconds
    text = Column(Text, nullable=False)         # Transcribed text
    
    # 🚨 PHASE 4.2: Enhanced segment metadata
    confidence = Column(Float, nullable=True)         # Transcription confidence score
    speaker_confidence = Column(Float, nullable=True) # Speaker diarization confidence
    word_count = Column(Integer, nullable=True)       # Number of words in segment
    language = Column(String, nullable=True)          # Detected language for segment
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    meeting = relationship("Meeting")
    speaker = relationship("Speaker", back_populates="segments")
