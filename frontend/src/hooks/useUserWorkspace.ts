import React, { useState, useEffect } from 'react'
import { getUserProfile, type UserWorkspace } from '../services/api/user'
import { getUserId } from '../services/api/core'

export interface UseUserWorkspaceResult {
  workspace: UserWorkspace | null
  hasWorkspace: boolean
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useUserWorkspace(): UseUserWorkspaceResult {
  const [workspace, setWorkspace] = useState<UserWorkspace | null>(null)
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

      const userProfile = await getUserProfile()
      setWorkspace(userProfile.workspace)
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

  return {
    workspace,
    hasWorkspace: workspace !== null,
    loading,
    error,
    refetch: fetchUserWorkspace
  }
}
