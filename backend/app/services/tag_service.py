"""Tag management service for meetings"""

import json
import logging
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Meeting
from ..models.user import get_or_create_user

logger = logging.getLogger(__name__)


class TagService:
    """Service for tag-related business logic"""
    
    @staticmethod
    def get_all_tags_with_counts(db: Session) -> Dict[str, int]:
        """Get all available tags with their usage counts"""
        user = get_or_create_user(db)
        
        meetings = db.query(Meeting).filter(
            Meeting.user_id == user.id,
            Meeting.tags.isnot(None)
        ).all()
        
        tag_counts = {}
        for meeting in meetings:
            try:
                tags = json.loads(meeting.tags) if meeting.tags else []
                for tag in tags:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
            except (json.JSONDecodeError, TypeError):
                continue
        
        return tag_counts
