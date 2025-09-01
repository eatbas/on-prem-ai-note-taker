"""Workspace schemas for API requests/responses"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class WorkspaceBase(BaseModel):
    """Base workspace schema"""
    name: str = Field(..., min_length=1, max_length=128, description="Workspace name")
    description: Optional[str] = Field(None, max_length=512, description="Workspace description")


class WorkspaceCreate(WorkspaceBase):
    """Schema for creating a workspace"""
    pass


class WorkspaceUpdate(BaseModel):
    """Schema for updating a workspace"""
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    description: Optional[str] = Field(None, max_length=512)
    is_active: Optional[bool] = None


class WorkspaceOut(WorkspaceBase):
    """Schema for workspace responses"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkspaceListItem(BaseModel):
    """Simplified workspace info for dropdowns/lists"""
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True


# ===== Multi-Workspace Schemas =====

class UserWorkspaceAssignment(BaseModel):
    """Schema for assigning user to workspace"""
    workspace_id: int
    role: str = Field(default="member", description="User role in workspace")
    is_responsible: bool = Field(default=False, description="Is user responsible for this workspace")

class UserWorkspaceInfo(BaseModel):
    """Schema for user-workspace relationship info"""
    id: int
    name: str
    description: Optional[str]
    role: str
    is_responsible: bool
    assigned_at: Optional[str]

class MeetingWorkspaceAssignment(BaseModel):
    """Schema for assigning meeting to workspace"""
    workspace_id: int
    is_primary: bool = Field(default=False, description="Is this the primary workspace for the meeting")
    relevance_score: int = Field(default=100, ge=0, le=100, description="Relevance score (0-100)")

class MeetingWorkspaceInfo(BaseModel):
    """Schema for meeting-workspace relationship info"""
    id: int
    name: str
    description: Optional[str]
    is_primary: bool
    relevance_score: int
    associated_at: Optional[str]

class MultiWorkspaceAssignment(BaseModel):
    """Schema for assigning to multiple workspaces"""
    workspace_ids: List[int]
    primary_workspace_id: Optional[int] = None

class UserWorkspaceSummary(BaseModel):
    """Summary of user's workspace involvement"""
    user_id: str
    total_workspaces: int
    responsible_workspaces_count: int
    workspaces: List[UserWorkspaceInfo]
    responsible_workspaces: List[UserWorkspaceInfo]

class WorkspaceStats(BaseModel):
    """Workspace statistics"""
    workspace_id: int
    user_count: int
    meeting_count: int
    responsible_user_count: int
    primary_meeting_count: int

class WorkspaceWithStats(WorkspaceOut):
    """Workspace with statistical information"""
    user_count: int = 0
    meeting_count: int = 0
    responsible_user_count: int = 0
