"""Workspace schemas for API requests/responses"""

from typing import Optional
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
