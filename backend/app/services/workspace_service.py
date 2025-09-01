"""
🏢 Multi-Workspace Management Service

Handles business logic for managing many-to-many relationships
between users, meetings, and workspaces.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models import User, Meeting, Workspace, UserWorkspace, MeetingWorkspace


class WorkspaceService:
    """Service for managing multi-workspace operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ===== User-Workspace Management =====
    
    def assign_user_to_workspace(
        self, 
        user_id: str, 
        workspace_id: int, 
        role: str = "member",
        is_responsible: bool = False,
        assigned_by: Optional[str] = None
    ) -> UserWorkspace:
        """Assign a user to a workspace with specific role"""
        
        # Check if assignment already exists
        existing = self.db.query(UserWorkspace).filter(
            and_(
                UserWorkspace.user_id == user_id,
                UserWorkspace.workspace_id == workspace_id
            )
        ).first()
        
        if existing:
            # Update existing assignment
            existing.role = role
            existing.is_responsible = is_responsible
            existing.assigned_by = assigned_by
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        # Create new assignment
        assignment = UserWorkspace(
            user_id=user_id,
            workspace_id=workspace_id,
            role=role,
            is_responsible=is_responsible,
            assigned_by=assigned_by
        )
        
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment
    
    def remove_user_from_workspace(self, user_id: str, workspace_id: int) -> bool:
        """Remove a user from a workspace"""
        assignment = self.db.query(UserWorkspace).filter(
            and_(
                UserWorkspace.user_id == user_id,
                UserWorkspace.workspace_id == workspace_id
            )
        ).first()
        
        if assignment:
            self.db.delete(assignment)
            self.db.commit()
            return True
        return False
    
    def get_user_workspaces(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all workspaces for a user with role information"""
        assignments = self.db.query(UserWorkspace).filter(
            UserWorkspace.user_id == user_id
        ).all()
        
        result = []
        for assignment in assignments:
            workspace = assignment.workspace
            if workspace and workspace.is_active:
                result.append({
                    "id": workspace.id,
                    "name": workspace.name,
                    "description": workspace.description,
                    "role": assignment.role,
                    "is_responsible": assignment.is_responsible,
                    "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None
                })
        
        return result
    
    def get_responsible_workspaces(self, user_id: str) -> List[Dict[str, Any]]:
        """Get workspaces where user is responsible"""
        assignments = self.db.query(UserWorkspace).filter(
            and_(
                UserWorkspace.user_id == user_id,
                UserWorkspace.is_responsible == True
            )
        ).all()
        
        result = []
        for assignment in assignments:
            workspace = assignment.workspace
            if workspace and workspace.is_active:
                result.append({
                    "id": workspace.id,
                    "name": workspace.name,
                    "description": workspace.description,
                    "role": assignment.role
                })
        
        return result
    
    # ===== Meeting-Workspace Management =====
    
    def assign_meeting_to_workspace(
        self,
        meeting_id: str,
        workspace_id: int,
        is_primary: bool = False,
        relevance_score: int = 100,
        associated_by: Optional[str] = None
    ) -> MeetingWorkspace:
        """Assign a meeting to a workspace"""
        
        # Check if assignment already exists
        existing = self.db.query(MeetingWorkspace).filter(
            and_(
                MeetingWorkspace.meeting_id == meeting_id,
                MeetingWorkspace.workspace_id == workspace_id
            )
        ).first()
        
        if existing:
            # Update existing assignment
            existing.is_primary = is_primary
            existing.relevance_score = relevance_score
            existing.associated_by = associated_by
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        # If setting as primary, remove primary flag from other workspace assignments
        if is_primary:
            self.db.query(MeetingWorkspace).filter(
                and_(
                    MeetingWorkspace.meeting_id == meeting_id,
                    MeetingWorkspace.is_primary == True
                )
            ).update({"is_primary": False})
        
        # Create new assignment
        assignment = MeetingWorkspace(
            meeting_id=meeting_id,
            workspace_id=workspace_id,
            is_primary=is_primary,
            relevance_score=relevance_score,
            associated_by=associated_by
        )
        
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment
    
    def assign_meeting_to_multiple_workspaces(
        self,
        meeting_id: str,
        workspace_ids: List[int],
        primary_workspace_id: Optional[int] = None,
        associated_by: Optional[str] = None
    ) -> List[MeetingWorkspace]:
        """Assign a meeting to multiple workspaces"""
        
        assignments = []
        for workspace_id in workspace_ids:
            is_primary = workspace_id == primary_workspace_id
            assignment = self.assign_meeting_to_workspace(
                meeting_id=meeting_id,
                workspace_id=workspace_id,
                is_primary=is_primary,
                associated_by=associated_by
            )
            assignments.append(assignment)
        
        return assignments
    
    def remove_meeting_from_workspace(self, meeting_id: str, workspace_id: int) -> bool:
        """Remove a meeting from a workspace"""
        assignment = self.db.query(MeetingWorkspace).filter(
            and_(
                MeetingWorkspace.meeting_id == meeting_id,
                MeetingWorkspace.workspace_id == workspace_id
            )
        ).first()
        
        if assignment:
            self.db.delete(assignment)
            self.db.commit()
            return True
        return False
    
    def get_meeting_workspaces(self, meeting_id: str) -> List[Dict[str, Any]]:
        """Get all workspaces for a meeting"""
        assignments = self.db.query(MeetingWorkspace).filter(
            MeetingWorkspace.meeting_id == meeting_id
        ).all()
        
        result = []
        for assignment in assignments:
            workspace = assignment.workspace
            if workspace and workspace.is_active:
                result.append({
                    "id": workspace.id,
                    "name": workspace.name,
                    "description": workspace.description,
                    "is_primary": assignment.is_primary,
                    "relevance_score": assignment.relevance_score,
                    "associated_at": assignment.associated_at.isoformat() if assignment.associated_at else None
                })
        
        return result
    
    # ===== Workspace Queries =====
    
    def get_workspace_meetings(
        self, 
        workspace_id: int,
        user_id: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get meetings for a specific workspace"""
        
        query = self.db.query(Meeting).join(MeetingWorkspace).filter(
            MeetingWorkspace.workspace_id == workspace_id
        )
        
        if user_id:
            query = query.filter(Meeting.user_id == user_id)
        
        query = query.order_by(Meeting.created_at.desc())
        
        if limit:
            query = query.offset(offset).limit(limit)
        
        meetings = query.all()
        
        result = []
        for meeting in meetings:
            # Get workspace assignment details
            assignment = self.db.query(MeetingWorkspace).filter(
                and_(
                    MeetingWorkspace.meeting_id == meeting.id,
                    MeetingWorkspace.workspace_id == workspace_id
                )
            ).first()
            
            meeting_data = {
                "id": meeting.id,
                "title": meeting.title,
                "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
                "duration": meeting.duration,
                "language": meeting.language,
                "is_personal": meeting.is_personal,
                "user_id": meeting.user_id,
                "is_primary": assignment.is_primary if assignment else False,
                "relevance_score": assignment.relevance_score if assignment else 100
            }
            result.append(meeting_data)
        
        return result
    
    def get_workspace_users(self, workspace_id: int) -> List[Dict[str, Any]]:
        """Get users for a specific workspace"""
        assignments = self.db.query(UserWorkspace).filter(
            UserWorkspace.workspace_id == workspace_id
        ).all()
        
        result = []
        for assignment in assignments:
            user = assignment.user
            if user:
                result.append({
                    "id": user.id,
                    "username": user.username,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "role": assignment.role,
                    "is_responsible": assignment.is_responsible,
                    "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None
                })
        
        return result
    
    # ===== Analytics and Statistics =====
    
    def get_workspace_stats(self, workspace_id: int) -> Dict[str, Any]:
        """Get statistics for a workspace"""
        
        user_count = self.db.query(UserWorkspace).filter(
            UserWorkspace.workspace_id == workspace_id
        ).count()
        
        meeting_count = self.db.query(MeetingWorkspace).filter(
            MeetingWorkspace.workspace_id == workspace_id
        ).count()
        
        responsible_count = self.db.query(UserWorkspace).filter(
            and_(
                UserWorkspace.workspace_id == workspace_id,
                UserWorkspace.is_responsible == True
            )
        ).count()
        
        primary_meeting_count = self.db.query(MeetingWorkspace).filter(
            and_(
                MeetingWorkspace.workspace_id == workspace_id,
                MeetingWorkspace.is_primary == True
            )
        ).count()
        
        return {
            "workspace_id": workspace_id,
            "user_count": user_count,
            "meeting_count": meeting_count,
            "responsible_user_count": responsible_count,
            "primary_meeting_count": primary_meeting_count
        }
    
    def get_user_workspace_summary(self, user_id: str) -> Dict[str, Any]:
        """Get summary of user's workspace involvement"""
        
        assignments = self.db.query(UserWorkspace).filter(
            UserWorkspace.user_id == user_id
        ).all()
        
        workspaces = []
        responsible_workspaces = []
        
        for assignment in assignments:
            workspace = assignment.workspace
            if workspace and workspace.is_active:
                workspace_info = {
                    "id": workspace.id,
                    "name": workspace.name,
                    "role": assignment.role,
                    "is_responsible": assignment.is_responsible
                }
                workspaces.append(workspace_info)
                
                if assignment.is_responsible:
                    responsible_workspaces.append(workspace_info)
        
        return {
            "user_id": user_id,
            "total_workspaces": len(workspaces),
            "responsible_workspaces_count": len(responsible_workspaces),
            "workspaces": workspaces,
            "responsible_workspaces": responsible_workspaces
        }
