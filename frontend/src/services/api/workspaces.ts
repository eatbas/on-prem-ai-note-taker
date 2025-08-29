/**
 * Workspace API Service
 * Handles all workspace-related API operations
 */

import { apiRequest } from './core'
import type {
  Workspace,
  WorkspaceCreate,
  WorkspaceUpdate,
  WorkspaceListItem,
  WorkspaceStats,
  UserWorkspaceAssignment,
  WorkspaceAssignmentResponse
} from '../../types/workspace'

// Workspace CRUD Operations
export async function createWorkspace(workspace: WorkspaceCreate): Promise<Workspace> {
  return apiRequest<Workspace>('/admin/workspaces', {
    method: 'POST',
    body: JSON.stringify(workspace)
  })
}

export async function getWorkspaces(includeInactive = false): Promise<Workspace[]> {
  const params = includeInactive ? '?include_inactive=true' : ''
  return apiRequest<Workspace[]>(`/admin/workspaces${params}`)
}

export async function getWorkspacesDropdown(): Promise<WorkspaceListItem[]> {
  return apiRequest<WorkspaceListItem[]>('/admin/workspaces/dropdown')
}

export async function getWorkspace(workspaceId: number): Promise<Workspace> {
  return apiRequest<Workspace>(`/admin/workspaces/${workspaceId}`)
}

export async function updateWorkspace(
  workspaceId: number, 
  update: WorkspaceUpdate
): Promise<Workspace> {
  return apiRequest<Workspace>(`/admin/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(update)
  })
}

export async function deactivateWorkspace(workspaceId: number): Promise<{
  message: string
  affected_users: number
  affected_meetings: number
}> {
  return apiRequest(`/admin/workspaces/${workspaceId}`, {
    method: 'DELETE'
  })
}

export async function getWorkspaceStats(workspaceId: number): Promise<WorkspaceStats> {
  return apiRequest<WorkspaceStats>(`/admin/workspaces/${workspaceId}/stats`)
}

// User Workspace Assignment
export async function assignUserToWorkspace(
  userId: string, 
  assignment: UserWorkspaceAssignment
): Promise<WorkspaceAssignmentResponse> {
  return apiRequest<WorkspaceAssignmentResponse>(`/admin/users/${userId}/workspace`, {
    method: 'PATCH',
    body: JSON.stringify(assignment)
  })
}

export async function removeUserFromWorkspace(userId: string): Promise<WorkspaceAssignmentResponse> {
  return assignUserToWorkspace(userId, { workspace_id: null })
}

// Utility functions
export function isWorkspaceActive(workspace: Workspace): boolean {
  return workspace.is_active
}

export function getWorkspaceDisplayName(workspace: Workspace | WorkspaceListItem): string {
  return workspace.name
}

export function formatWorkspaceForDropdown(workspace: Workspace): WorkspaceListItem {
  return {
    id: workspace.id,
    name: workspace.name,
    is_active: workspace.is_active
  }
}
