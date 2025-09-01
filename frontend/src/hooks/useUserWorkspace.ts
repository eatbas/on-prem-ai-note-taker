import React, { useState, useEffect } from 'react'
import { getUserProfile, getUserWorkspaces, getResponsibleWorkspaces, type UserWorkspace } from '../services/api/user'
import { getUserId } from '../services/api/core'

export interface UseUserWorkspaceResult {
  workspace: UserWorkspace | null  // Legacy: primary workspace
  hasWorkspace: boolean
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  // 🚨 MULTI-WORKSPACE: New fields
  workspaces: UserWorkspace[]  // All workspaces
  responsibleWorkspaces: UserWorkspace[]  // Workspaces user is responsible for
  totalWorkspaces: number
  hasMultipleWorkspaces: boolean
  isResponsibleFor: (workspaceId: number) => boolean
  getWorkspaceRole: (workspaceId: number) => string | null
}

export function useUserWorkspace(): UseUserWorkspaceResult {
  const [workspace, setWorkspace] = useState<UserWorkspace | null>(null)
  const [workspaces, setWorkspaces] = useState<UserWorkspace[]>([])
  const [responsibleWorkspaces, setResponsibleWorkspaces] = useState<UserWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserWorkspace = async () => {
    try {
      setError(null)
      const userId = getUserId()
      if (!userId) {
        setLoading(false)
        return
      }

      // Fetch user profile (includes legacy workspace and new workspace arrays)
      const userProfile = await getUserProfile()
      setWorkspace(userProfile.workspace)  // Legacy primary workspace
      setWorkspaces(userProfile.workspaces || [])
      setResponsibleWorkspaces(userProfile.responsible_workspaces || [])

      // If the profile doesn't include the new multi-workspace data, fetch separately
      if (!userProfile.workspaces) {
        try {
          const allWorkspaces = await getUserWorkspaces()
          const responsible = await getResponsibleWorkspaces()
          setWorkspaces(allWorkspaces)
          setResponsibleWorkspaces(responsible)
        } catch (multiErr) {
          console.warn('Could not fetch multi-workspace data:', multiErr)
          // Continue with legacy data only
        }
      }
    } catch (err) {
      console.error('Failed to fetch user workspace:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch workspace information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserWorkspace()
  }, [])

  // Helper functions
  const isResponsibleFor = (workspaceId: number): boolean => {
    return responsibleWorkspaces.some(w => w.id === workspaceId)
  }

  const getWorkspaceRole = (workspaceId: number): string | null => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    return workspace?.role || null
  }

  return {
    workspace,
    hasWorkspace: workspace !== null || workspaces.length > 0,
    loading,
    error,
    refetch: fetchUserWorkspace,
    // 🚨 MULTI-WORKSPACE: New fields
    workspaces,
    responsibleWorkspaces,
    totalWorkspaces: workspaces.length,
    hasMultipleWorkspaces: workspaces.length > 1,
    isResponsibleFor,
    getWorkspaceRole
  }
}
