"""Workspace database model"""

from datetime import datetime
from typing import List
from sqlalchemy import Column, String, Integer, Boolean, DateTime, func
from sqlalchemy.orm import relationship

from .base import Base


class Workspace(Base):
    """Workspace model for organizing users and meetings"""
    __tablename__ = "workspaces"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    description = Column(String(512), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 🚨 MULTI-WORKSPACE: Many-to-many relationships
    user_workspaces = relationship("UserWorkspace", back_populates="workspace", cascade="all, delete-orphan")
    users = relationship("User", secondary="user_workspaces", back_populates="workspaces", viewonly=True,
                        primaryjoin="Workspace.id == UserWorkspace.workspace_id",
                        secondaryjoin="User.id == UserWorkspace.user_id")
    
    meeting_workspaces = relationship("MeetingWorkspace", back_populates="workspace", cascade="all, delete-orphan")
    meetings = relationship("Meeting", secondary="meeting_workspaces", back_populates="workspaces", viewonly=True)
    
    # Helper methods
    def get_users(self) -> List["User"]:
        """Get all users in this workspace"""
        return [uw.user for uw in self.user_workspaces]
    
    def get_responsible_users(self) -> List["User"]:
        """Get users who are responsible for this workspace"""
        return [uw.user for uw in self.user_workspaces if uw.is_responsible]
    
    def get_meetings(self) -> List["Meeting"]:
        """Get all meetings in this workspace"""
        return [mw.meeting for mw in self.meeting_workspaces]
    
    def get_primary_meetings(self) -> List["Meeting"]:
        """Get meetings where this is the primary workspace"""
        return [mw.meeting for mw in self.meeting_workspaces if mw.is_primary]
    
    def user_count(self) -> int:
        """Get count of users in this workspace"""
        return len(self.user_workspaces)
    
    def meeting_count(self) -> int:
        """Get count of meetings in this workspace"""
        return len(self.meeting_workspaces)
