"""User database model"""

import os
import platform
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship, Session

from .base import Base


class User(Base):
    """User model - automatically created based on system username"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 🚨 MULTI-WORKSPACE: Removed direct workspace_id, now using many-to-many
    # workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)  # DEPRECATED
    
    # Relationships
    # 🚨 MULTI-WORKSPACE: Many-to-many relationship with workspaces
    user_workspaces = relationship("UserWorkspace", back_populates="user", cascade="all, delete-orphan")
    workspaces = relationship("Workspace", secondary="user_workspaces", back_populates="users", viewonly=True)
    
    meetings = relationship("Meeting", back_populates="user")
    jobs = relationship("Job", back_populates="user")
    
    # Helper methods for workspace management
    def get_workspaces(self) -> List["Workspace"]:
        """Get all workspaces this user belongs to"""
        return [uw.workspace for uw in self.user_workspaces]
    
    def get_responsible_workspaces(self) -> List["Workspace"]:
        """Get workspaces this user is responsible for"""
        return [uw.workspace for uw in self.user_workspaces if uw.is_responsible]
    
    def is_in_workspace(self, workspace_id: int) -> bool:
        """Check if user belongs to a specific workspace"""
        return any(uw.workspace_id == workspace_id for uw in self.user_workspaces)
    
    def get_role_in_workspace(self, workspace_id: int) -> Optional[str]:
        """Get user's role in a specific workspace"""
        for uw in self.user_workspaces:
            if uw.workspace_id == workspace_id:
                return uw.role
        return None


def get_or_create_user_by_username(db: Session, username: str) -> User:
    """
    Centralized function to get or create user by username.
    This ensures consistent user creation across the application.
    
    Args:
        db: Database session
        username: The username to find or create user for
        
    Returns:
        User: The existing or newly created user
    """
    # First, try to find user by username
    user = db.query(User).filter(User.username == username).first()
    
    if user:
        return user
    
    # If not found by username, try to find by user_id format
    user_id = f"user_{username}"
    user = db.query(User).filter(User.id == user_id).first()
    
    if user:
        return user
    
    # Create new user if not found
    user = User(
        id=user_id,
        username=username
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    print(f"✅ Created new user '{username}'")
    
    return user


def get_or_create_user_from_header(db: Session, x_user_id: Optional[str] = None) -> User:
    """
    Get or create user based on X-User-Id header or system detection.
    This is the main function that should be used across all routers.
    
    Args:
        db: Database session
        x_user_id: Optional X-User-Id header value from frontend
        
    Returns:
        User: The existing or newly created user
    """
    if x_user_id:
        # Extract username from user ID format: user_{username}
        if x_user_id.startswith('user_'):
            username = x_user_id[5:]  # Remove 'user_' prefix
        else:
            username = x_user_id
        
        return get_or_create_user_by_username(db, username)
    
    # Fallback to system username detection if no header provided
    return get_or_create_user_by_system_detection(db)


def get_or_create_user_by_system_detection(db: Session) -> User:
    """
    Get or create user based on system username detection.
    This is used as a fallback when no X-User-Id header is provided.
    """
    username = None
    try:
        if hasattr(os, 'getlogin'):
            username = os.getlogin()
    except Exception:
        username = None
    if not username:
        username = os.environ.get('USER') or os.environ.get('USERNAME') or platform.node() or 'default'
    
    return get_or_create_user_by_username(db, username)


# Keep the old function for backward compatibility
def get_or_create_user(db: Session) -> User:
    """
    DEPRECATED: Use get_or_create_user_by_system_detection() instead.
    Get or create user based on system username.
    Be resilient in environments where os.getlogin() is unavailable (e.g., daemons/containers).
    """
    return get_or_create_user_by_system_detection(db)
