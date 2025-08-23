"""Database models and setup for On-Prem AI Note Taker"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Integer, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from typing import Optional
import platform

Base = declarative_base()

# Get the user's home directory for database storage
def get_db_path():
    """Get the path for the SQLite database file"""
    home = os.path.expanduser("~")
    db_dir = os.path.join(home, ".on-prem-ai-notes")
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "notes.db")

# Database URL
DATABASE_URL = f"sqlite:///{get_db_path()}"

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class User(Base):
    """User model - automatically created based on system username"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    meetings = relationship("Meeting", back_populates="user")


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
    
    # Tags support (JSON stored as string)
    tags = Column(Text, nullable=True)  # JSON array of strings
    
    # Relationships
    user = relationship("User", back_populates="meetings")
    transcriptions = relationship("Transcription", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="meeting", cascade="all, delete-orphan")


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


class Summary(Base):
    """AI-generated summary model"""
    __tablename__ = "summaries"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    summary_text = Column(Text, nullable=False)
    model_used = Column(String, nullable=True)  # Which AI model was used
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="summaries")


# Database initialization
def init_db():
    """Initialize the database tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


# Initialize database on import
init_db()
