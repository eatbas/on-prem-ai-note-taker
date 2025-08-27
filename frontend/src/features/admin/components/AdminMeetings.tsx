import React, { useState } from 'react'

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

interface AdminMeetingsProps {
    meetings: AdminMeeting[]
    pagination: {
        total_count: number
        offset: number
        limit: number
    }
    loading: boolean
    error: string | null
    searchTerm: string
    selectedUser: string
    onSearchChange: (term: string) => void
    onUserFilterChange: (userId: string) => void
    onDeleteMeeting: (meetingId: string) => Promise<void>
    onPageChange: (offset: number) => void
    users: Array<{ id: string; username: string }>
}

export default function AdminMeetings({
    meetings,
    pagination,
    loading,
    error,
    searchTerm,
    selectedUser,
    onSearchChange,
    onUserFilterChange,
    onDeleteMeeting,
    onPageChange,
    users
}: AdminMeetingsProps) {
    const [deletingMeetings, setDeletingMeetings] = useState<Set<string>>(new Set())

    const handleDeleteMeeting = async (meetingId: string) => {
        setDeletingMeetings(prev => new Set(prev).add(meetingId))
        try {
            await onDeleteMeeting(meetingId)
        } finally {
            setDeletingMeetings(prev => {
                const newSet = new Set(prev)
                newSet.delete(meetingId)
                return newSet
            })
        }
    }

    const formatDuration = (seconds?: number) => {
        if (!seconds) return 'N/A'
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
    const totalPages = Math.ceil(pagination.total_count / pagination.limit)

    return (
        <div>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                    📋 Meeting Management
                </h2>
                
                {/* Filters */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Search meetings..."
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
                    
                    <select
                        value={selectedUser}
                        onChange={(e) => onUserFilterChange(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            minWidth: '150px'
                        }}
                    >
                        <option value="">All Users</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.username}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                    <p>Loading meetings...</p>
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
                                Showing {meetings.length} of {pagination.total_count} meetings
                            </span>
                            {(searchTerm || selectedUser) && (
                                <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                    (filtered)
                                </span>
                            )}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '14px' }}>
                            Page {currentPage} of {totalPages}
                        </div>
                    </div>

                    {/* Meetings Grid */}
                    {meetings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                            <p>
                                {searchTerm || selectedUser ? 'No meetings match your criteria' : 'No meetings found'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{
                                                fontSize: '18px',
                                                fontWeight: '600',
                                                margin: '0 0 8px 0',
                                                color: '#1f2937'
                                            }}>
                                                {meeting.title || 'Untitled Meeting'}
                                            </h3>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                fontSize: '14px',
                                                color: '#6b7280'
                                            }}>
                                                <span>👤 {meeting.username}</span>
                                                <span>📅 {new Date(meeting.created_at).toLocaleDateString()}</span>
                                                {meeting.duration && (
                                                    <span>⏱️ {formatDuration(meeting.duration)}</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <button
                                            onClick={() => handleDeleteMeeting(meeting.id)}
                                            disabled={deletingMeetings.has(meeting.id)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: deletingMeetings.has(meeting.id) ? '#9ca3af' : '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                cursor: deletingMeetings.has(meeting.id) ? 'not-allowed' : 'pointer',
                                                opacity: deletingMeetings.has(meeting.id) ? 0.6 : 1
                                            }}
                                        >
                                            {deletingMeetings.has(meeting.id) ? '⏳' : '🗑️'} Delete
                                        </button>
                                    </div>

                                    {/* Status Indicators */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginBottom: '12px'
                                    }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            backgroundColor: meeting.has_transcription ? '#22c55e' : '#6b7280',
                                            color: 'white',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '500'
                                        }}>
                                            {meeting.has_transcription ? '✅' : '❌'} Transcription
                                        </span>
                                        <span style={{
                                            padding: '2px 8px',
                                            backgroundColor: meeting.has_summary ? '#22c55e' : '#6b7280',
                                            color: 'white',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '500'
                                        }}>
                                            {meeting.has_summary ? '✅' : '❌'} Summary
                                        </span>
                                    </div>

                                    {/* Tags */}
                                    {meeting.tags.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '6px'
                                        }}>
                                            {meeting.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    style={{
                                                        padding: '2px 6px',
                                                        backgroundColor: '#dbeafe',
                                                        color: '#1e40af',
                                                        borderRadius: '8px',
                                                        fontSize: '11px',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Meeting ID */}
                                    <div style={{
                                        marginTop: '12px',
                                        fontSize: '11px',
                                        color: '#9ca3af',
                                        fontFamily: 'monospace'
                                    }}>
                                        ID: {meeting.id}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px',
                            marginTop: '32px'
                        }}>
                            <button
                                onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: currentPage === 1 ? '#f3f4f6' : '#3b82f6',
                                    color: currentPage === 1 ? '#9ca3af' : 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                ← Previous
                            </button>

                            <span style={{
                                fontSize: '14px',
                                color: '#6b7280',
                                padding: '8px 12px'
                            }}>
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                onClick={() => onPageChange(pagination.offset + pagination.limit)}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#3b82f6',
                                    color: currentPage === totalPages ? '#9ca3af' : 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
