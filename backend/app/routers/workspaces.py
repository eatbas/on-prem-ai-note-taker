"""Workspace management API endpoints"""

import logging
from typing import List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..schemas.workspace import (
    WorkspaceCreate, 
    WorkspaceUpdate, 
    WorkspaceOut, 
    WorkspaceListItem
)
from ..database import get_db
from ..models import Workspace, User, Meeting
from ..core.utils import require_basic_auth

router = APIRouter(prefix="/api/admin/workspaces", tags=["workspaces"])
logger = logging.getLogger(__name__)


def require_admin_auth(credentials=Depends(require_basic_auth)) -> None:
    """Enforce admin authentication - uses same basic auth but could be extended"""
    # This function now just calls require_basic_auth from utils
    # The actual auth logic is handled there
    pass


@router.post("", response_model=WorkspaceOut)
async def create_workspace(
    workspace: WorkspaceCreate,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> WorkspaceOut:
    """Admin: Create a new workspace"""
    # Check if workspace name already exists
    existing = db.query(Workspace).filter(Workspace.name == workspace.name).first()
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Workspace with name '{workspace.name}' already exists"
        )
    
    # Create new workspace
    db_workspace = Workspace(
        name=workspace.name,
        description=workspace.description,
        is_active=True
    )
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    
    logger.info(f"Created workspace: {workspace.name} (ID: {db_workspace.id})")
    return WorkspaceOut.from_orm(db_workspace)


@router.get("", response_model=List[WorkspaceOut])
async def list_workspaces(
    include_inactive: bool = False,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> List[WorkspaceOut]:
    """Admin: List all workspaces"""
    query = db.query(Workspace)
    
    if not include_inactive:
        query = query.filter(Workspace.is_active == True)
    
    workspaces = query.order_by(desc(Workspace.created_at)).all()
    return [WorkspaceOut.from_orm(w) for w in workspaces]


@router.get("/dropdown", response_model=List[WorkspaceListItem])
async def list_workspaces_dropdown(
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> List[WorkspaceListItem]:
    """Admin: Get simplified workspace list for dropdowns"""
    workspaces = db.query(Workspace).filter(
        Workspace.is_active == True
    ).order_by(Workspace.name).all()
    
    return [WorkspaceListItem.from_orm(w) for w in workspaces]


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: int,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> WorkspaceOut:
    """Admin: Get workspace by ID"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return WorkspaceOut.from_orm(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(
    workspace_id: int,
    workspace_update: WorkspaceUpdate,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> WorkspaceOut:
    """Admin: Update workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check for name conflicts if name is being updated
    if workspace_update.name and workspace_update.name != workspace.name:
        existing = db.query(Workspace).filter(
            Workspace.name == workspace_update.name,
            Workspace.id != workspace_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Workspace with name '{workspace_update.name}' already exists"
            )
    
    # Update fields
    update_data = workspace_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workspace, field, value)
    
    db.commit()
    db.refresh(workspace)
    
    logger.info(f"Updated workspace: {workspace.name} (ID: {workspace.id})")
    return WorkspaceOut.from_orm(workspace)


@router.delete("/{workspace_id}")
async def deactivate_workspace(
    workspace_id: int,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Deactivate workspace (soft delete)"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check if workspace has users assigned
    user_count = db.query(User).filter(User.workspace_id == workspace_id).count()
    meeting_count = db.query(Meeting).filter(Meeting.workspace_id == workspace_id).count()
    
    # Deactivate workspace (soft delete)
    workspace.is_active = False
    
    # Optionally remove users from workspace (or leave them for historical purposes)
    # For now, we'll leave users assigned but workspace is inactive
    
    db.commit()
    
    logger.info(
        f"Deactivated workspace: {workspace.name} (ID: {workspace.id}) "
        f"- had {user_count} users and {meeting_count} meetings"
    )
    
    return {
        "message": f"Workspace '{workspace.name}' deactivated successfully",
        "affected_users": user_count,
        "affected_meetings": meeting_count
    }


@router.get("/{workspace_id}/stats")
async def get_workspace_stats(
    workspace_id: int,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Admin: Get workspace statistics"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    user_count = db.query(User).filter(User.workspace_id == workspace_id).count()
    meeting_count = db.query(Meeting).filter(Meeting.workspace_id == workspace_id).count()
    personal_meeting_count = db.query(Meeting).join(User).filter(
        User.workspace_id == workspace_id,
        Meeting.is_personal == True
    ).count()
    
    return {
        "workspace": WorkspaceOut.from_orm(workspace),
        "user_count": user_count,
        "workspace_meeting_count": meeting_count,
        "personal_meeting_count": personal_meeting_count,
        "total_meetings": meeting_count + personal_meeting_count
    }
