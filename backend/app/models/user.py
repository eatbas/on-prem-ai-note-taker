"""User database model"""

import os
import platform
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship, Session

from .base import Base


class User(Base):
    """User model - automatically created based on system username"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    meetings = relationship("Meeting", back_populates="user")
    jobs = relationship("Job", back_populates="user")


def get_or_create_user(db: Session) -> User:
    """Get or create user based on system username.
    Be resilient in environments where os.getlogin() is unavailable (e.g., daemons/containers)."""
    username = None
    try:
        if hasattr(os, 'getlogin'):
            username = os.getlogin()
    except Exception:
        username = None
    if not username:
        username = os.environ.get('USER') or os.environ.get('USERNAME') or platform.node() or 'default'
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            id=f"user_{username}",
            username=username
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user
