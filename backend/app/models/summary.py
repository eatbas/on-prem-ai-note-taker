"""Summary database model"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


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
