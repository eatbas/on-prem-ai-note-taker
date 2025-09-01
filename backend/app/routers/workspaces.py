"""Workspace management API endpoints"""

import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..schemas.workspace import (
    WorkspaceCreate, 
    WorkspaceUpdate, 
    WorkspaceOut, 
    WorkspaceListItem,
    UserWorkspaceAssignment,
    UserWorkspaceInfo,
    MeetingWorkspaceAssignment,
    MeetingWorkspaceInfo,
    MultiWorkspaceAssignment,
    UserWorkspaceSummary,
    WorkspaceStats,
    WorkspaceWithStats
)
from ..database import get_db
from ..models import Workspace, User, Meeting, UserWorkspace, MeetingWorkspace
from ..core.utils import require_basic_auth
from ..services.workspace_service import WorkspaceService

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


# ===== Multi-Workspace Management Endpoints =====

@router.post("/users/{user_id}/workspaces")
async def assign_user_to_workspace(
    user_id: str,
    assignment: UserWorkspaceAssignment,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Assign user to a workspace"""
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == assignment.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace_service = WorkspaceService(db)
    workspace_service.assign_user_to_workspace(
        user_id=user_id,
        workspace_id=assignment.workspace_id,
        role=assignment.role,
        is_responsible=assignment.is_responsible
    )
    
    logger.info(f"Assigned user {user_id} to workspace {assignment.workspace_id} with role {assignment.role}")
    return {"message": "User assigned to workspace successfully"}


@router.delete("/users/{user_id}/workspaces/{workspace_id}")
async def remove_user_from_workspace(
    user_id: str,
    workspace_id: int,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Remove user from workspace"""
    
    workspace_service = WorkspaceService(db)
    success = workspace_service.remove_user_from_workspace(user_id, workspace_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="User-workspace assignment not found")
    
    logger.info(f"Removed user {user_id} from workspace {workspace_id}")
    return {"message": "User removed from workspace successfully"}


@router.get("/users/{user_id}/workspaces", response_model=List[UserWorkspaceInfo])
async def get_user_workspaces(
    user_id: str,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> List[UserWorkspaceInfo]:
    """Admin: Get all workspaces for a user"""
    
    workspace_service = WorkspaceService(db)
    workspaces = workspace_service.get_user_workspaces(user_id)
    
    return [UserWorkspaceInfo(**workspace) for workspace in workspaces]


@router.get("/users/{user_id}/summary", response_model=UserWorkspaceSummary)
async def get_user_workspace_summary(
    user_id: str,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> UserWorkspaceSummary:
    """Admin: Get summary of user's workspace involvement"""
    
    workspace_service = WorkspaceService(db)
    summary = workspace_service.get_user_workspace_summary(user_id)
    
    return UserWorkspaceSummary(**summary)


@router.post("/meetings/{meeting_id}/workspaces")
async def assign_meeting_to_workspace(
    meeting_id: str,
    assignment: MeetingWorkspaceAssignment,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Assign meeting to a workspace"""
    
    # Verify meeting exists
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == assignment.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace_service = WorkspaceService(db)
    workspace_service.assign_meeting_to_workspace(
        meeting_id=meeting_id,
        workspace_id=assignment.workspace_id,
        is_primary=assignment.is_primary,
        relevance_score=assignment.relevance_score
    )
    
    logger.info(f"Assigned meeting {meeting_id} to workspace {assignment.workspace_id}")
    return {"message": "Meeting assigned to workspace successfully"}


@router.post("/meetings/{meeting_id}/workspaces/bulk")
async def assign_meeting_to_multiple_workspaces(
    meeting_id: str,
    assignment: MultiWorkspaceAssignment,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Assign meeting to multiple workspaces"""
    
    # Verify meeting exists
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Verify all workspaces exist
    for workspace_id in assignment.workspace_ids:
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            raise HTTPException(status_code=404, detail=f"Workspace {workspace_id} not found")
    
    workspace_service = WorkspaceService(db)
    workspace_service.assign_meeting_to_multiple_workspaces(
        meeting_id=meeting_id,
        workspace_ids=assignment.workspace_ids,
        primary_workspace_id=assignment.primary_workspace_id
    )
    
    logger.info(f"Assigned meeting {meeting_id} to {len(assignment.workspace_ids)} workspaces")
    return {"message": f"Meeting assigned to {len(assignment.workspace_ids)} workspaces successfully"}


@router.delete("/meetings/{meeting_id}/workspaces/{workspace_id}")
async def remove_meeting_from_workspace(
    meeting_id: str,
    workspace_id: int,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Admin: Remove meeting from workspace"""
    
    workspace_service = WorkspaceService(db)
    success = workspace_service.remove_meeting_from_workspace(meeting_id, workspace_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Meeting-workspace assignment not found")
    
    logger.info(f"Removed meeting {meeting_id} from workspace {workspace_id}")
    return {"message": "Meeting removed from workspace successfully"}


@router.get("/meetings/{meeting_id}/workspaces", response_model=List[MeetingWorkspaceInfo])
async def get_meeting_workspaces(
    meeting_id: str,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> List[MeetingWorkspaceInfo]:
    """Admin: Get all workspaces for a meeting"""
    
    workspace_service = WorkspaceService(db)
    workspaces = workspace_service.get_meeting_workspaces(meeting_id)
    
    return [MeetingWorkspaceInfo(**workspace) for workspace in workspaces]


@router.get("/{workspace_id}/stats", response_model=WorkspaceStats)
async def get_workspace_stats(
    workspace_id: int,
    _auth: None = Depends(require_admin_auth),
    db: Session = Depends(get_db),
) -> WorkspaceStats:
    """Admin: Get workspace statistics"""
    
    workspace_service = WorkspaceService(db)
    stats = workspace_service.get_workspace_stats(workspace_id)
    
    return WorkspaceStats(**stats)


# ===== User Endpoints (for authenticated users) =====

@router.get("/my", response_model=List[UserWorkspaceInfo])
async def get_my_workspaces(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> List[UserWorkspaceInfo]:
    """Get current user's workspaces"""
    
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header is required")
    
    workspace_service = WorkspaceService(db)
    workspaces = workspace_service.get_user_workspaces(x_user_id)
    
    return [UserWorkspaceInfo(**workspace) for workspace in workspaces]


@router.get("/my/responsible", response_model=List[UserWorkspaceInfo])
async def get_my_responsible_workspaces(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    _auth: None = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> List[UserWorkspaceInfo]:
    """Get workspaces where current user is responsible"""
    
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header is required")
    
    workspace_service = WorkspaceService(db)
    workspaces = workspace_service.get_responsible_workspaces(x_user_id)
    
    return [UserWorkspaceInfo(**workspace) for workspace in workspaces]
