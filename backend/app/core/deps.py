"""Dependency injection module for FastAPI application"""

from typing import Generator
from sqlalchemy.orm import Session

from ..database import get_db
from ..workers.progress import job_store

# Export the singleton job_store for dependency injection
__all__ = ["job_store", "get_db"]


def get_job_store():
    """Get the singleton job store instance"""
    return job_store


# Re-export database dependency for convenience
def get_database() -> Generator[Session, None, None]:
    """Get database session dependency"""
    return get_db()
