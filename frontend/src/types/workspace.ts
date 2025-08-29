/**
 * Workspace-related TypeScript interfaces
 * Matches backend Pydantic schemas for type safety
 */

export interface Workspace {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface WorkspaceCreate {
  name: string
  description?: string
}

export interface WorkspaceUpdate {
  name?: string
  description?: string
  is_active?: boolean
}

export interface WorkspaceListItem {
  id: number
  name: string
  is_active: boolean
}

export interface WorkspaceStats {
  workspace: Workspace
  user_count: number
  workspace_meeting_count: number
  personal_meeting_count: number
  total_meetings: number
}

export interface UserWorkspaceAssignment {
  workspace_id?: number | null  // null to remove workspace assignment
}

export interface UserWorkspaceInfo {
  id: string
  username: string
  workspace_id?: number
  workspace_name?: string
  meeting_count: number
  created_at: string
}

// Meeting scope types
export type MeetingScope = 'personal' | 'workspace'

export interface MeetingScopeOption {
  value: MeetingScope
  label: string
  description: string
  disabled?: boolean
}

// API Response types
export interface WorkspaceAssignmentResponse {
  message: string
  user_id: string
  workspace_id?: number
  workspace_name?: string
  previous_workspace?: string
}
