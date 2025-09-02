"""Tag management API endpoints"""

from typing import Dict, Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..core.utils import require_basic_auth
from ..services.tag_service import TagService

router = APIRouter(prefix="/api", tags=["tags"])


@router.get("/tags")
async def get_all_tags(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> Dict[str, int]:
    """Get all available tags with their usage counts"""
    return TagService.get_all_tags_with_counts(db, x_user_id)
