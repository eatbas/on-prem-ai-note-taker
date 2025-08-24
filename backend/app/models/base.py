"""Database base configuration"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

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


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize the database tables"""
    Base.metadata.create_all(bind=engine)
