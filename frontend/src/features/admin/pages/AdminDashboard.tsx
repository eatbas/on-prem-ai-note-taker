import React, { useEffect, useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast, ConfirmationModal } from '../../../components/common'
import { JobQueue } from '../../../components/queue'

// Import organized admin components
import {
  AdminTabNavigation,
  AdminHeader,
  AdminStats,
  AdminUsers,
  AdminMeetings,
  AdminWorkspaces,
  ProductionHealthDashboard
} from '../components/dashboard'

// Import admin API utilities
import {
  loadStats,
  loadUsers,
  loadMeetings,
  deleteUser,
  deleteMeeting
} from '../utils/adminApi'
import {
  getWorkspaces,
  getWorkspacesDropdown,
  createWorkspace,
  updateWorkspace,
  deactivateWorkspace,
  assignUserToWorkspace
} from '../../../services/api/workspaces'
import { apiBase, getApiHeaders } from '../../../services/api/core'
import { config } from '../../../utils/envLoader'

// Types
interface UserWorkspace {
  id: number
  name: string
  description: string
  role: string
  is_responsible: boolean
  assigned_at: string | null
}

interface User {
  id: string
  username: string
  created_at: string
  meeting_count: number
  workspace_id?: number
  workspace_name?: string
  workspaces?: UserWorkspace[]
  total_workspaces?: number
}

interface AdminMeeting {
  id: string
  user_id: string
  username: string
  title: string
  created_at: string
  updated_at: string
  duration?: number
  has_transcription: boolean
  has_summary: boolean
  tags: string[]
}

interface Stats {
  total_users: number
  total_meetings: number
  total_transcriptions: number
  total_summaries: number
  recent_meetings_7d: number
  average_meeting_duration_minutes: number
  top_tags: [string, number][]
  system_info: {
    whisper_model: string
    ollama_model: string
    ollama_base_url: string
  }
}

const AdminDashboard = memo(function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'meetings' | 'workspaces' | 'tools' | 'jobs' | 'health'>('stats')
  
  // Data state
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [meetings, setMeetings] = useState<AdminMeeting[]>([])
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [workspaceDropdown, setWorkspaceDropdown] = useState<any[]>([])
  const [meetingsPagination, setMeetingsPagination] = useState({
    total_count: 0,
    offset: 0,
    limit: 10
  })
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  
  // Confirmation modal state
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })
  
  const { showToast, ToastContainer } = useToast()

  const tabs = [
    { key: 'stats', label: '📊 Statistics', description: 'System overview' },
    { key: 'users', label: '👥 Users', description: 'User management' },
    { key: 'meetings', label: '📋 Meetings', description: 'Meeting management' },
    { key: 'workspaces', label: '🏢 Workspaces', description: 'Workspace management' },
    
    { key: 'jobs', label: '⚙️ Jobs', description: 'Background jobs' },
    { key: 'health', label: '🔍 Health', description: 'Production monitoring' }
  ]

  // Load data when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'stats':
        loadStatsData()
        break
      case 'users':
        loadUsersData()
        break
      case 'meetings':
        loadMeetingsData()
        break
      case 'workspaces':
        loadWorkspacesData()
        break
    }
  }, [activeTab])

  // Load workspace dropdown data when users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      loadWorkspaceDropdownData()
    }
  }, [activeTab])

  // Reload meetings when search/filter changes
  useEffect(() => {
    if (activeTab === 'meetings') {
      loadMeetingsData(0) // Reset to first page
    }
  }, [searchTerm, selectedUser])

  const loadStatsData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadStats()
      setStats(data)
    } catch (err) {
      console.error('❌ Admin Stats Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stats')
      showToast('Failed to load statistics', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadUsersData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
      showToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadMeetingsData = async (offset = meetingsPagination.offset) => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadMeetings({
        limit: meetingsPagination.limit,
        offset: offset,
        search: searchTerm || undefined,
        user_id: selectedUser || undefined
      })
      setMeetings(data.meetings)
      setMeetingsPagination({
        ...meetingsPagination,
        total_count: data.total_count,
        offset: offset
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
      showToast('Failed to load meetings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkspacesData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getWorkspaces(true) // Include inactive
      setWorkspaces(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces')
      showToast('Failed to load workspaces', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkspaceDropdownData = async () => {
    try {
      const data = await getWorkspacesDropdown()
      setWorkspaceDropdown(data)
    } catch (err) {
      console.error('Failed to load workspace dropdown:', err)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    const userName = user?.username || 'Unknown'
    
    setConfirmation({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete user "${userName}"? This will permanently remove the user and ALL their meetings. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteUser(userId)
          await loadUsersData() // Reload users
          showToast('User deleted successfully', 'success')
        } catch (err) {
          console.error('Failed to delete user:', err)
          showToast(`Failed to delete user: ${err}`, 'error')
        }
      }
    })
  }

  const handleDeleteMeeting = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId)
    const meetingTitle = meeting?.title || 'Untitled Meeting'
    
    setConfirmation({
      isOpen: true,
      title: 'Delete Meeting',
      message: `Are you sure you want to delete "${meetingTitle}"? This will permanently remove the meeting and all its data. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteMeeting(meetingId)
          await loadMeetingsData() // Reload current page
          showToast('Meeting deleted successfully', 'success')
        } catch (err) {
          console.error('Failed to delete meeting:', err)
          showToast(`Failed to delete meeting: ${err}`, 'error')
        }
      }
    })
  }

  const handleMeetingPageChange = (offset: number) => {
    setMeetingsPagination(prev => ({ ...prev, offset }))
    loadMeetingsData(offset)
  }

  // Workspace handlers
  const handleCreateWorkspace = async (workspace: any) => {
    await createWorkspace(workspace)
    await loadWorkspacesData()
    showToast('Workspace created successfully', 'success')
  }

  const handleUpdateWorkspace = async (id: number, update: any) => {
    await updateWorkspace(id, update)
    await loadWorkspacesData()
    showToast('Workspace updated successfully', 'success')
  }

  const handleDeactivateWorkspace = async (id: number) => {
    const workspace = workspaces.find(w => w.id === id)
    const workspaceName = workspace?.name || 'Unknown Workspace'
    
    setConfirmation({
      isOpen: true,
      title: 'Deactivate Workspace',
      message: `Are you sure you want to deactivate workspace "${workspaceName}"? All users will be unassigned from this workspace. You can reactivate it later if needed.`,
      onConfirm: async () => {
        try {
          await deactivateWorkspace(id)
          await loadWorkspacesData()
          showToast('Workspace deactivated successfully', 'success')
        } catch (err) {
          console.error('Failed to deactivate workspace:', err)
          showToast(`Failed to deactivate workspace: ${err}`, 'error')
        }
      }
    })
  }

  const handleAssignWorkspace = async (userId: string, workspaceId: number | null) => {
    try {
      const user = users.find(u => u.id === userId)
      const workspace = workspaceDropdown.find(w => w.id === workspaceId)
      
      await assignUserToWorkspace(userId, { workspace_id: workspaceId })
      await loadUsersData()
      
      if (workspaceId) {
        showToast(`User '${user?.username}' assigned to workspace '${workspace?.name}'`, 'success')
      } else {
        showToast(`User '${user?.username}' removed from workspace`, 'success')
      }
    } catch (error) {
      console.error('Failed to assign workspace:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('404')) {
        showToast('User or workspace not found. Please refresh and try again.', 'error')
      } else if (errorMessage.includes('403') || errorMessage.includes('401')) {
        showToast('Permission denied. Please check your admin credentials.', 'error')
      } else if (errorMessage.includes('500')) {
        showToast('Server error. The workspace assignment service may be having issues.', 'error')
      } else {
        showToast(`Failed to assign workspace: ${errorMessage}`, 'error')
      }
    }
  }

  const handleAssignMultipleWorkspaces = async (userId: string, assignments: any[]) => {
    try {
      // Remove existing workspace assignments
      const user = users.find(u => u.id === userId)
      if (user?.workspaces) {
        for (const workspace of user.workspaces) {
          try {
            // Use centralized API base and headers (handles proxy and auth)
            const response = await fetch(`${apiBase}/admin/workspaces/users/${userId}/workspaces/${workspace.id}`, {
              method: 'DELETE',
              headers: {
                ...getApiHeaders()
              }
            })
            if (!response.ok) {
              const errorText = await response.text()
              console.warn(`Failed to remove workspace ${workspace.id}:`, errorText)
              showToast(`Warning: Could not remove workspace '${workspace.name}' (${response.status})`, 'error')
            }
          } catch (e) {
            console.warn('Failed to remove workspace assignment:', e)
            showToast(`Warning: Error removing workspace '${workspace.name}'`, 'error')
          }
        }
      }

      // Add new workspace assignments
      for (const assignment of assignments) {
        try {
          // Use centralized API base and headers (handles proxy and auth)
          const response = await fetch(`${apiBase}/admin/workspaces/users/${userId}/workspaces`, {
            method: 'POST',
            headers: {
              ...getApiHeaders()
            },
            body: JSON.stringify(assignment)
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to assign workspace ${assignment.workspace_id}: ${errorText}`)
          }
        } catch (e) {
          console.error(`Failed to assign workspace ${assignment.workspace_id}:`, e)
          const workspace = workspaceDropdown.find(w => w.id === assignment.workspace_id)
          showToast(`Failed to assign workspace '${workspace?.name || assignment.workspace_id}': ${e instanceof Error ? e.message : 'Unknown error'}`, 'error')
          throw e
        }
      }

      await loadUsersData()
      showToast('User workspace assignments updated successfully', 'success')
    } catch (error) {
      console.error('Failed to update workspace assignments:', error)
      showToast('Failed to update workspace assignments', 'error')
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'stats':
        return (
          <AdminStats
            stats={stats}
            loading={loading}
            error={error}
          />
        )
      case 'users':
        return (
          <AdminUsers
            users={users}
            workspaces={workspaceDropdown}
            loading={loading}
            error={error}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onDeleteUser={handleDeleteUser}
            onAssignWorkspace={handleAssignWorkspace}
            onAssignMultipleWorkspaces={handleAssignMultipleWorkspaces}
          />
        )
      case 'meetings':
        return (
          <AdminMeetings
            meetings={meetings}
            pagination={meetingsPagination}
            loading={loading}
            error={error}
            searchTerm={searchTerm}
            selectedUser={selectedUser}
            onSearchChange={setSearchTerm}
            onUserFilterChange={setSelectedUser}
            onDeleteMeeting={handleDeleteMeeting}
            onPageChange={handleMeetingPageChange}
            users={users}
          />
        )
      case 'workspaces':
        return (
          <AdminWorkspaces
            workspaces={workspaces}
            loading={loading}
            error={error}
            onCreateWorkspace={handleCreateWorkspace}
            onUpdateWorkspace={handleUpdateWorkspace}
            onDeactivateWorkspace={handleDeactivateWorkspace}
          />
        )
      
      case 'jobs':
        return <JobQueue online={true} vpsUp={true} />
      case 'health':
        return <ProductionHealthDashboard />
      default:
        return null
    }
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Inter, system-ui, Arial, sans-serif'
    }}>
      {/* Header */}
      <AdminHeader onBackToApp={() => navigate('/')} />

      {/* Tab Navigation */}
      <AdminTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      {/* Tab Content */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        minHeight: '600px'
      }}>
        {renderTabContent()}
      </div>

      {/* Auth Configuration Status */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: config.basicAuthUsername && config.basicAuthPassword ? '#f0f9ff' : '#fef2f2',
        border: `1px solid ${config.basicAuthUsername && config.basicAuthPassword ? '#bae6fd' : '#fecaca'}`,
        borderRadius: '6px',
        fontSize: '14px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          🔐 Authentication Status
        </div>
        <div>
          Username: {config.basicAuthUsername ? '✅ Configured' : '❌ Missing'}
        </div>
        <div>
          Password: {config.basicAuthPassword ? '✅ Configured' : '❌ Missing'}
        </div>
        <div>
          API URL: {config.apiBaseUrl}
        </div>
        {(!config.basicAuthUsername || !config.basicAuthPassword) && (
          <div style={{ marginTop: '8px', color: '#dc2626', fontWeight: 'bold' }}>
            ⚠️ Admin credentials not configured in environment variables!
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmText="Delete"
        danger={true}
      />

      <ToastContainer />
    </div>
  )
})

export default AdminDashboard
