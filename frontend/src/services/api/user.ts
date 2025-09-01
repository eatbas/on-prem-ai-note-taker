import { apiRequest } from './index'

export interface UserWorkspace {
  id: number
  name: string
  description: string
  role: string
  is_responsible: boolean
  assigned_at: string | null
}

export interface UserProfile {
  id: string
  username: string
  workspace: UserWorkspace | null  // Legacy: primary workspace
  has_workspace: boolean
  // 🚨 MULTI-WORKSPACE: New fields
  workspaces: UserWorkspace[]  // All workspaces user belongs to
  responsible_workspaces: UserWorkspace[]  // Workspaces user is responsible for
  total_workspaces: number
}

export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/meetings/user/profile', {
    method: 'GET'
  })
}

// 🚨 MULTI-WORKSPACE: New API functions
export async function getUserWorkspaces(): Promise<UserWorkspace[]> {
  return apiRequest<UserWorkspace[]>('/admin/workspaces/my', {
    method: 'GET'
  })
}

export async function getResponsibleWorkspaces(): Promise<UserWorkspace[]> {
  return apiRequest<UserWorkspace[]>('/admin/workspaces/my/responsible', {
    method: 'GET'
  })
}
