import { apiRequest } from './index'

export interface UserWorkspace {
  id: number
  name: string
  description: string
}

export interface UserProfile {
  id: string
  username: string
  workspace: UserWorkspace | null
  has_workspace: boolean
}

export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/meetings/user/profile', {
    method: 'GET'
  })
}
