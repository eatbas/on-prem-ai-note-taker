import React, { useState } from 'react'

interface User {
    id: string
    username: string
    created_at: string
    meeting_count: number
}

interface AdminUsersProps {
    users: User[]
    loading: boolean
    error: string | null
    searchTerm: string
    onSearchChange: (term: string) => void
    onDeleteUser: (userId: string) => Promise<void>
}

export default function AdminUsers({
    users,
    loading,
    error,
    searchTerm,
    onSearchChange,
    onDeleteUser
}: AdminUsersProps) {
    const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set())

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
                                gridTemplateColumns: '1fr 1fr 120px 100px 120px',
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
                                        gridTemplateColumns: '1fr 1fr 120px 100px 120px',
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
        </div>
    )
}
