"""Admin API endpoints for VPS management"""

import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..schemas.meetings import AdminUserResponse, AdminMeetingResponse
from ..database import get_db, User, Meeting, Transcription, Summary
from ..core.utils import require_basic_auth

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)


def require_admin_auth(credentials = Depends(require_basic_auth)) -> None:
    """Enforce admin authentication - uses same basic auth but could be extended"""
    # This function now just calls require_basic_auth from utils
    # The actual auth logic is handled there
    pass


@router.get("/users", response_model=List[AdminUserResponse])
async def admin_list_users(
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> List[AdminUserResponse]:
    """Admin: List all users with meeting counts"""
    users = db.query(User).all()
    
    response = []
    for user in users:
        meeting_count = db.query(Meeting).filter(Meeting.user_id == user.id).count()
        response.append(AdminUserResponse(
            id=user.id,
            username=user.username,
            created_at=user.created_at.isoformat(),
            meeting_count=meeting_count,
        ))
    
    return response


@router.get("/meetings")
async def admin_list_meetings(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    search: Optional[str] = Query(None, description="Search in title, summary, transcript"),
    limit: int = Query(50, description="Maximum number of meetings to return"),
    offset: int = Query(0, description="Number of meetings to skip"),
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Admin: List all meetings across all users"""
    query = db.query(Meeting)
    
    # Apply user filter
    if user_id:
        query = query.filter(Meeting.user_id == user_id)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        meeting_filter = Meeting.title.like(search_term)
        
        transcription_subquery = db.query(Transcription.meeting_id).filter(
            Transcription.text.like(search_term)
        ).subquery()
        
        summary_subquery = db.query(Summary.meeting_id).filter(
            Summary.summary_text.like(search_term)
        ).subquery()
        
        query = query.filter(or_(
            meeting_filter,
            Meeting.id.in_(transcription_subquery),
            Meeting.id.in_(summary_subquery)
        ))
    
    # Get total count for pagination
    total_count = query.count()
    
    # Apply pagination
    meetings = query.order_by(Meeting.created_at.desc()).offset(offset).limit(limit).all()
    
    response_meetings = []
    for meeting in meetings:
        # Get user info
        user = db.query(User).filter(User.id == meeting.user_id).first()
        
        # Check if transcription and summary exist
        has_transcription = db.query(Transcription).filter(
            Transcription.meeting_id == meeting.id
        ).first() is not None
        has_summary = db.query(Summary).filter(
            Summary.meeting_id == meeting.id
        ).first() is not None
        
        # Parse tags
        tags = []
        if meeting.tags:
            try:
                tags = json.loads(meeting.tags)
            except (json.JSONDecodeError, TypeError):
                tags = []
        
        response_meetings.append(AdminMeetingResponse(
            id=meeting.id,
            user_id=meeting.user_id,
            username=user.username if user else "Unknown",
            title=meeting.title,
            created_at=meeting.created_at.isoformat(),
            updated_at=meeting.updated_at.isoformat(),
            duration=meeting.duration,
            has_transcription=has_transcription,
            has_summary=has_summary,
            tags=tags,
        ))
    
    return {
        "meetings": response_meetings,
        "total_count": total_count,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(response_meetings) < total_count
    }


@router.delete("/meetings/{meeting_id}")
async def admin_delete_meeting(
    meeting_id: str,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Delete any meeting"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    db.delete(meeting)
    db.commit()
    
    return {"message": "Meeting deleted successfully"}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Delete user and all their meetings"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete all meetings for this user (cascading will handle related data)
    meetings = db.query(Meeting).filter(Meeting.user_id == user_id).all()
    for meeting in meetings:
        db.delete(meeting)
    
    # Delete the user
    db.delete(user)
    db.commit()
    
    return {"message": f"User {user.username} and all their data deleted successfully"}


@router.get("/stats")
async def admin_get_stats(
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Admin: Get system statistics"""
    from ..core.config import settings
    
    total_users = db.query(User).count()
    total_meetings = db.query(Meeting).count()
    total_transcriptions = db.query(Transcription).count()
    total_summaries = db.query(Summary).count()
    
    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_meetings = db.query(Meeting).filter(Meeting.created_at >= week_ago).count()
    
    # Average meeting duration
    avg_duration = db.query(func.avg(Meeting.duration)).filter(
        Meeting.duration.isnot(None)
    ).scalar() or 0
    
    # Top tags
    meetings_with_tags = db.query(Meeting).filter(Meeting.tags.isnot(None)).all()
    tag_counts = {}
    for meeting in meetings_with_tags:
        try:
            tags = json.loads(meeting.tags) if meeting.tags else []
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        except (json.JSONDecodeError, TypeError):
            continue
    
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "total_users": total_users,
        "total_meetings": total_meetings,
        "total_transcriptions": total_transcriptions,
        "total_summaries": total_summaries,
        "recent_meetings_7d": recent_meetings,
        "average_meeting_duration_minutes": round(avg_duration / 60, 2) if avg_duration else 0,
        "top_tags": top_tags,
        "system_info": {
            "whisper_model": settings.whisper_model_name,
            "ollama_model": settings.ollama_model,
            "ollama_base_url": settings.ollama_base_url,
        }
    }
