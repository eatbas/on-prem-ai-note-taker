"""Meeting database model"""

from datetime import datetime
from typing import List, Optional
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
    
    # 🚨 MULTI-WORKSPACE: Updated workspace relationships
    # workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)  # DEPRECATED
    is_personal = Column(Boolean, nullable=False, default=True)
    
    # Relationships - using string references to avoid circular imports
    user = relationship("User", back_populates="meetings")
    
    # 🚨 MULTI-WORKSPACE: Many-to-many relationship with workspaces
    meeting_workspaces = relationship("MeetingWorkspace", back_populates="meeting", cascade="all, delete-orphan")
    workspaces = relationship("Workspace", secondary="meeting_workspaces", back_populates="meetings", viewonly=True)
    
    transcriptions = relationship("Transcription", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="meeting", cascade="all, delete-orphan")
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")
    
    # Helper methods for workspace management
    def get_workspaces(self) -> List["Workspace"]:
        """Get all workspaces this meeting belongs to"""
        return [mw.workspace for mw in self.meeting_workspaces]
    
    def get_primary_workspace(self) -> Optional["Workspace"]:
        """Get the primary workspace for this meeting"""
        for mw in self.meeting_workspaces:
            if mw.is_primary:
                return mw.workspace
        return None
    
    def is_in_workspace(self, workspace_id: int) -> bool:
        """Check if meeting belongs to a specific workspace"""
        return any(mw.workspace_id == workspace_id for mw in self.meeting_workspaces)
    
    def add_to_workspace(self, workspace_id: int, is_primary: bool = False, relevance_score: int = 100):
        """Add meeting to a workspace (to be used with appropriate service)"""
        # This would be implemented in a service layer, not directly in model
        pass
