import React, { useState } from 'react'
import type { WorkspaceListItem } from '../../../types/workspace'
import UserWorkspaceAssignment from './UserWorkspaceAssignment'

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
    // 🚨 MULTI-WORKSPACE: New fields
    workspaces?: UserWorkspace[]
    total_workspaces?: number
}

interface WorkspaceAssignment {
    workspace_id: number
    role: string
    is_responsible: boolean
}

interface AdminUsersProps {
    users: User[]
    workspaces: WorkspaceListItem[]
    loading: boolean
    error: string | null
    searchTerm: string
    onSearchChange: (term: string) => void
    onDeleteUser: (userId: string) => Promise<void>
    onAssignWorkspace: (userId: string, workspaceId: number | null) => Promise<void>
    // 🚨 MULTI-WORKSPACE: New function for bulk workspace assignment
    onAssignMultipleWorkspaces?: (userId: string, assignments: WorkspaceAssignment[]) => Promise<void>
}

export default function AdminUsers({
    users,
    workspaces,
    loading,
    error,
    searchTerm,
    onSearchChange,
    onDeleteUser,
    onAssignWorkspace,
    onAssignMultipleWorkspaces
}: AdminUsersProps) {
    const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set())
    const [assigningWorkspace, setAssigningWorkspace] = useState<Set<string>>(new Set())
    // 🚨 MULTI-WORKSPACE: New state for workspace assignment modal
    const [workspaceAssignmentModal, setWorkspaceAssignmentModal] = useState<{
        isOpen: boolean
        userId: string
        userName: string
    }>({
        isOpen: false,
        userId: '',
        userName: ''
    })

    const handleDeleteUser = async (userId: string) => {
        setDeletingUsers(prev => new Set(prev).add(userId))
        try {
            await onDeleteUser(userId)
        } finally {
            setDeletingUsers(prev => {
                const newSet = new Set(prev)
                newSet.delete(userId)
                return newSet
            })
        }
    }

    const handleWorkspaceChange = async (userId: string, workspaceId: string) => {
        const workspaceIdNum = workspaceId === '' ? null : parseInt(workspaceId)
        setAssigningWorkspace(prev => new Set(prev).add(userId))
        try {
            await onAssignWorkspace(userId, workspaceIdNum)
        } finally {
            setAssigningWorkspace(prev => {
                const newSet = new Set(prev)
                newSet.delete(userId)
                return newSet
            })
        }
    }

    // 🚨 MULTI-WORKSPACE: New handlers for multi-workspace assignment
    const handleOpenWorkspaceAssignment = (userId: string, userName: string) => {
        setWorkspaceAssignmentModal({
            isOpen: true,
            userId,
            userName
        })
    }

    const handleCloseWorkspaceAssignment = () => {
        setWorkspaceAssignmentModal({
            isOpen: false,
            userId: '',
            userName: ''
        })
    }

    const handleSaveWorkspaceAssignments = async (assignments: WorkspaceAssignment[]) => {
        if (onAssignMultipleWorkspaces) {
            await onAssignMultipleWorkspaces(workspaceAssignmentModal.userId, assignments)
        }
    }

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                    👥 User Management
                </h2>
                
                {/* Search */}
                <input
                    type="text"
                    placeholder="🔍 Search users..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        minWidth: '250px'
                    }}
                />
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                    <p>Loading users...</p>
                </div>
            )}

            {error && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '40px',
                    color: '#ef4444',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px'
                }}>
                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>❌</div>
                    <p><strong>Error:</strong> {error}</p>
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* Summary */}
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <span style={{ fontWeight: '600', color: '#374151' }}>
                                Showing {filteredUsers.length} of {users.length} users
                            </span>
                            {searchTerm && (
                                <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                    (filtered by "{searchTerm}")
                                </span>
                            )}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '14px' }}>
                            Total meetings: {users.reduce((sum, user) => sum + user.meeting_count, 0)}
                        </div>
                    </div>

                    {/* Users Table */}
                    {filteredUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
                            <p>
                                {searchTerm ? 'No users match your search criteria' : 'No users found'}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}>
                            {/* Table Header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 180px 120px 100px 160px',
                                gap: '12px',
                                padding: '16px',
                                backgroundColor: '#f9fafb',
                                borderBottom: '1px solid #e5e7eb',
                                fontWeight: '600',
                                fontSize: '14px',
                                color: '#374151'
                            }}>
                                <div>Username</div>
                                <div>User ID</div>
                                <div>Workspaces</div>
                                <div>Meetings</div>
                                <div>Created</div>
                                <div>Actions</div>
                            </div>

                            {/* Table Rows */}
                            {filteredUsers.map((user, index) => (
                                <div
                                    key={user.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 180px 120px 100px 160px',
                                        gap: '12px',
                                        padding: '16px',
                                        borderBottom: index < filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none',
                                        backgroundColor: '#ffffff',
                                        fontSize: '14px',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                        {user.username}
                                    </div>
                                    <div style={{ 
                                        fontFamily: 'monospace', 
                                        fontSize: '12px', 
                                        color: '#6b7280',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {user.id}
                                    </div>
                                    <div>
                                        {/* 🚨 MULTI-WORKSPACE: New workspace display */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {/* Show current workspaces */}
                                            {user.workspaces && user.workspaces.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                    {user.workspaces.slice(0, 2).map(workspace => (
                                                        <span
                                                            key={workspace.id}
                                                            style={{
                                                                fontSize: '10px',
                                                                backgroundColor: workspace.is_responsible ? '#3b82f6' : '#6b7280',
                                                                color: 'white',
                                                                padding: '2px 4px',
                                                                borderRadius: '8px',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            {workspace.is_responsible && '👑'} {workspace.name}
                                                        </span>
                                                    ))}
                                                    {user.workspaces.length > 2 && (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            color: '#6b7280',
                                                            padding: '2px 4px'
                                                        }}>
                                                            +{user.workspaces.length - 2} more
                                                        </span>
                                                    )}
                                                </div>
                                            ) : user.workspace_name ? (
                                                // Legacy single workspace display
                                                <span style={{
                                                    fontSize: '10px',
                                                    backgroundColor: '#6b7280',
                                                    color: 'white',
                                                    padding: '2px 4px',
                                                    borderRadius: '8px',
                                                    fontWeight: '500'
                                                }}>
                                                    {user.workspace_name}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                                                    No workspaces
                                                </span>
                                            )}
                                            
                                            {/* Manage workspaces button */}
                                            <button
                                                onClick={() => handleOpenWorkspaceAssignment(user.id, user.username)}
                                                style={{
                                                    fontSize: '10px',
                                                    padding: '2px 6px',
                                                    backgroundColor: '#f3f4f6',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    color: '#374151'
                                                }}
                                            >
                                                🏢 Manage
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span style={{
                                            backgroundColor: user.meeting_count > 0 ? '#22c55e' : '#6b7280',
                                            color: 'white',
                                            borderRadius: '12px',
                                            padding: '2px 8px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            {user.meeting_count}
                                        </span>
                                    </div>
                                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={deletingUsers.has(user.id)}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: deletingUsers.has(user.id) ? '#9ca3af' : '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                cursor: deletingUsers.has(user.id) ? 'not-allowed' : 'pointer',
                                                opacity: deletingUsers.has(user.id) ? 0.6 : 1
                                            }}
                                        >
                                            {deletingUsers.has(user.id) ? '⏳' : '🗑️'} Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* 🚨 MULTI-WORKSPACE: Workspace Assignment Modal */}
            <UserWorkspaceAssignment
                userId={workspaceAssignmentModal.userId}
                userName={workspaceAssignmentModal.userName}
                availableWorkspaces={workspaces.filter(w => w.is_active).map(w => ({
                    id: w.id,
                    name: w.name,
                    description: w.description || ''
                }))}
                currentWorkspaces={
                    users.find(u => u.id === workspaceAssignmentModal.userId)?.workspaces || []
                }
                isOpen={workspaceAssignmentModal.isOpen}
                onClose={handleCloseWorkspaceAssignment}
                onSave={handleSaveWorkspaceAssignments}
            />
        </div>
    )
}
