"""User-Workspace junction table for many-to-many relationships"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import relationship

from .base import Base


class UserWorkspace(Base):
    """Junction table for User-Workspace many-to-many relationship"""
    __tablename__ = "user_workspaces"
    
    # Composite primary key
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True)
    
    # Role/permissions within the workspace
    role = Column(String(50), nullable=False, default="member")  # member, admin, director
    is_responsible = Column(Boolean, nullable=False, default=False)  # True if responsible for this workspace
    
    # Timestamps
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_by = Column(String, ForeignKey("users.id"), nullable=True)  # Who assigned this user
    
    # Relationships
    user = relationship("User", back_populates="user_workspaces", foreign_keys=[user_id])
    workspace = relationship("Workspace", back_populates="user_workspaces")
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])


class MeetingWorkspace(Base):
    """Junction table for Meeting-Workspace many-to-many relationship"""
    __tablename__ = "meeting_workspaces"
    
    # Composite primary key
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True)
    
    # Meeting context within workspace
    is_primary = Column(Boolean, nullable=False, default=False)  # Primary workspace for this meeting
    relevance_score = Column(Integer, nullable=True, default=100)  # How relevant (0-100)
    
    # Timestamps
    associated_at = Column(DateTime(timezone=True), server_default=func.now())
    associated_by = Column(String, ForeignKey("users.id"), nullable=True)  # Who associated this meeting
    
    # Relationships
    meeting = relationship("Meeting", back_populates="meeting_workspaces")
    workspace = relationship("Workspace", back_populates="meeting_workspaces")
    associated_by_user = relationship("User", foreign_keys=[associated_by])
