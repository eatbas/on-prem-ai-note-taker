import React, { useState } from 'react'
import type { WorkspaceListItem } from '../../../../types/workspace'
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
    onDeleteUser: (userId: string) => void
    onAssignWorkspace: (userId: string, workspaceId: number | null) => void
    onAssignMultipleWorkspaces: (userId: string, assignments: WorkspaceAssignment[]) => Promise<void>
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
    const [workspaceAssignmentModal, setWorkspaceAssignmentModal] = useState<{
        isOpen: boolean
        userId: string
        userName: string
    }>({
        isOpen: false,
        userId: '',
        userName: ''
    })

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

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #e2e8f0',
                    borderTop: '3px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                }} />
                <p style={{ color: '#6b7280' }}>Loading users...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{
                padding: '20px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                textAlign: 'center'
            }}>
                <p style={{ color: '#dc2626', fontWeight: '600' }}>Error loading users</p>
                <p style={{ color: '#7f1d1d', fontSize: '14px' }}>{error}</p>
            </div>
        )
    }

    return (
        <div>
            {/* Header with Search */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0
                }}>
                    👥 User Management
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                            minWidth: '200px'
                        }}
                    />
                    <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#6b7280',
                        fontWeight: '500'
                    }}>
                        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{
                            backgroundColor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb'
                        }}>
                            <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#6b7280',
                                textTransform: 'uppercase'
                            }}>Username</th>
                            <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#6b7280',
                                textTransform: 'uppercase'
                            }}>Meetings</th>
                            <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#6b7280',
                                textTransform: 'uppercase'
                            }}>Workspaces</th>
                            <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#6b7280',
                                textTransform: 'uppercase'
                            }}>Created</th>
                            <th style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#6b7280',
                                textTransform: 'uppercase'
                            }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user, index) => (
                            <tr key={user.id} style={{
                                borderBottom: index < filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none'
                            }}>
                                <td style={{ padding: '16px' }}>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#1f2937'
                                    }}>
                                        {user.username}
                                    </div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280'
                                    }}>
                                        ID: {user.id}
                                    </div>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        backgroundColor: '#f0f9ff',
                                        color: '#0369a1',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500'
                                    }}>
                                        📋 {user.meeting_count}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    {user.workspaces && user.workspaces.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {user.workspaces.slice(0, 2).map((workspace) => (
                                                <span key={workspace.id} style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 6px',
                                                    backgroundColor: '#dcfce7',
                                                    color: '#166534',
                                                    borderRadius: '10px',
                                                    fontSize: '11px',
                                                    fontWeight: '500'
                                                }}>
                                                    🏢 {workspace.name}
                                                    {workspace.is_responsible && <span>👑</span>}
                                                </span>
                                            ))}
                                            {user.workspaces.length > 2 && (
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: '#6b7280'
                                                }}>
                                                    +{user.workspaces.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{
                                            color: '#9ca3af',
                                            fontSize: '12px',
                                            fontStyle: 'italic'
                                        }}>
                                            No workspaces
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{
                                        fontSize: '12px',
                                        color: '#6b7280'
                                    }}>
                                        {formatDate(user.created_at)}
                                    </span>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => handleOpenWorkspaceAssignment(user.id, user.username)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                fontWeight: '500'
                                            }}
                                        >
                                            🏢 Workspaces
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm(`Delete user "${user.username}"? This will remove all their data.`)) {
                                                    onDeleteUser(user.id)
                                                }
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                fontWeight: '500'
                                            }}
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredUsers.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    marginTop: '16px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                        {searchTerm ? 'No users found' : 'No users yet'}
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                        {searchTerm ? 'Try adjusting your search term' : 'Users will appear here when they create accounts'}
                    </p>
                </div>
            )}

            {/* 🚨 MULTI-WORKSPACE: Workspace Assignment Modal */}
            {workspaceAssignmentModal.isOpen && (
                <UserWorkspaceAssignment
                    userId={workspaceAssignmentModal.userId}
                    userName={workspaceAssignmentModal.userName}
                    availableWorkspaces={workspaces.filter(w => w.is_active).map(w => ({
                        id: w.id,
                        name: w.name,
                        description: '' // WorkspaceListItem doesn't have description
                    }))}
                    currentWorkspaces={
                        users.find(u => u.id === workspaceAssignmentModal.userId)?.workspaces || []
                    }
                    isOpen={workspaceAssignmentModal.isOpen}
                    onClose={handleCloseWorkspaceAssignment}
                    onAssignMultiple={onAssignMultipleWorkspaces}
                />
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
