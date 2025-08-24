import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './Toast'

interface User {
    id: string
    username: string
    created_at: string
    meeting_count: number
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

const API_BASE = (() => {
    try {
        // @ts-ignore
        const fromPreload = (window as any).API_BASE_URL as string | undefined
        if (fromPreload) return fromPreload
    } catch {}
    return (import.meta as any).env.VITE_API_BASE_URL || '/api'
})()

// Get auth credentials from environment variables
const getAuthCredentials = () => {
    const username = (import.meta as any).env.VITE_BASIC_AUTH_USERNAME
    const password = (import.meta as any).env.VITE_BASIC_AUTH_PASSWORD
    
    if (!username || !password) {
        throw new Error('Admin credentials not configured. Please check your .env.local file.')
    }
    
    return { username, password }
}

async function makeAdminRequest(path: string, options?: RequestInit) {
    try {
        const credentials = getAuthCredentials()
        const token = btoa(`${credentials.username}:${credentials.password}`)
        
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        })
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid credentials. Please check your .env.local file.')
            }
            throw new Error(`Request failed: ${response.status} ${response.statusText}`)
        }
        
        return response.json()
    } catch (err) {
        if (err instanceof Error && err.message.includes('credentials not configured')) {
            throw new Error('Admin authentication not configured. Please set VITE_BASIC_AUTH_USERNAME and VITE_BASIC_AUTH_PASSWORD in your .env.local file.')
        }
        throw err
    }
}

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'meetings'>('stats')
    const [stats, setStats] = useState<Stats | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [meetings, setMeetings] = useState<AdminMeeting[]>([])
    const [meetingsPagination, setMeetingsPagination] = useState({
        total_count: 0,
        offset: 0,
        limit: 25,
        has_more: false
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUser, setSelectedUser] = useState('')
    const { ToastContainer } = useToast()

    useEffect(() => {
        if (activeTab === 'stats') {
            loadStats()
        } else if (activeTab === 'users') {
            loadUsers()
        } else if (activeTab === 'meetings') {
            loadMeetings()
        }
    }, [activeTab])

    async function loadStats() {
        setLoading(true)
        setError(null)
        try {
            const data = await makeAdminRequest('/admin/stats')
            setStats(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stats')
        } finally {
            setLoading(false)
        }
    }

    async function loadUsers() {
        setLoading(true)
        setError(null)
        try {
            const data = await makeAdminRequest('/admin/users')
            setUsers(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    async function loadMeetings(offset = 0) {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                limit: meetingsPagination.limit.toString(),
                offset: offset.toString(),
            })
            
            if (searchTerm) params.append('search', searchTerm)
            if (selectedUser) params.append('user_id', selectedUser)
            
            const data = await makeAdminRequest(`/admin/meetings?${params}`)
            setMeetings(data.meetings)
            setMeetingsPagination({
                total_count: data.total_count,
                offset: data.offset,
                limit: data.limit,
                has_more: data.has_more
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load meetings')
        } finally {
            setLoading(false)
        }
    }

    async function deleteUser(userId: string) {
        if (!confirm('Are you sure? This will delete the user and ALL their meetings permanently.')) {
            return
        }
        
        try {
            await makeAdminRequest(`/admin/users/${userId}`, { method: 'DELETE' })
            loadUsers()
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete user')
        }
    }

    async function deleteMeeting(meetingId: string) {
        if (!confirm('Are you sure? This will delete the meeting permanently.')) {
            return
        }
        
        try {
            await makeAdminRequest(`/admin/meetings/${meetingId}`, { method: 'DELETE' })
            loadMeetings(meetingsPagination.offset)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete meeting')
        }
    }

    return (
        <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto', 
            padding: '24px',
            fontFamily: 'Inter, system-ui, Arial, sans-serif'
        }}>
            <ToastContainer />
            <header style={{ marginBottom: '32px', textAlign: 'center' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        ← Back to App
                    </button>
                    <div style={{ flex: 1 }}></div>
                </div>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    color: '#1e293b',
                    background: 'linear-gradient(135deg, #dc2626 0%, #7c2d12 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '8px'
                }}>
                    🛠️ VPS Admin Dashboard
                </h1>
                <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                    Manage users, meetings, and system resources
                </p>
            </header>

            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex',
                gap: '8px',
                marginBottom: '32px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '16px'
            }}>
                {[
                    { key: 'stats', label: '📊 Statistics', icon: '📊' },
                    { key: 'users', label: '👥 Users', icon: '👥' },
                    { key: 'meetings', label: '📋 Meetings', icon: '📋' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor: activeTab === tab.key ? '#dc2626' : '#f8fafc',
                            color: activeTab === tab.key ? 'white' : '#64748b',
                            fontWeight: activeTab === tab.key ? '600' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '14px'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {error && (
                <div style={{
                    padding: '16px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #dc2626',
                    borderRadius: '8px',
                    color: '#dc2626',
                    marginBottom: '24px'
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>Loading statistics...</div>
                    ) : stats ? (
                        <div>
                            {/* Overview Cards */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '16px',
                                marginBottom: '32px'
                            }}>
                                <StatCard title="Total Users" value={stats.total_users} icon="👥" />
                                <StatCard title="Total Meetings" value={stats.total_meetings} icon="📋" />
                                <StatCard title="Transcriptions" value={stats.total_transcriptions} icon="📝" />
                                <StatCard title="Summaries" value={stats.total_summaries} icon="📄" />
                                <StatCard title="Recent (7d)" value={stats.recent_meetings_7d} icon="📅" />
                                <StatCard 
                                    title="Avg Duration" 
                                    value={`${stats.average_meeting_duration_minutes}m`} 
                                    icon="⏱️" 
                                />
                            </div>

                            {/* System Info */}
                            <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '24px',
                                marginBottom: '32px'
                            }}>
                                <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>🖥️ System Configuration</h3>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    <div><strong>Whisper Model:</strong> {stats.system_info.whisper_model}</div>
                                    <div><strong>Ollama Model:</strong> {stats.system_info.ollama_model}</div>
                                    <div><strong>Ollama URL:</strong> {stats.system_info.ollama_base_url}</div>
                                </div>
                            </div>

                            {/* Top Tags */}
                            {stats.top_tags.length > 0 && (
                                <div style={{
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    padding: '24px'
                                }}>
                                    <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>🏷️ Popular Tags</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {stats.top_tags.map(([tag, count]) => (
                                            <span
                                                key={tag}
                                                style={{
                                                    backgroundColor: '#dc2626',
                                                    color: 'white',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '14px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                {tag} ({count})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>Loading users...</div>
                    ) : (
                        <div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '24px'
                            }}>
                                <h2>👥 Users ({users.length})</h2>
                                <button
                                    onClick={loadUsers}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🔄 Refresh
                                </button>
                            </div>

                            <div style={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                overflow: 'hidden'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#f8fafc' }}>
                                        <tr>
                                            <th style={tableHeaderStyle}>Username</th>
                                            <th style={tableHeaderStyle}>Created</th>
                                            <th style={tableHeaderStyle}>Meetings</th>
                                            <th style={tableHeaderStyle}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tableCellStyle}>{user.username}</td>
                                                <td style={tableCellStyle}>
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </td>
                                                <td style={tableCellStyle}>{user.meeting_count}</td>
                                                <td style={tableCellStyle}>
                                                    <button
                                                        onClick={() => deleteUser(user.id)}
                                                        style={{
                                                            padding: '4px 12px',
                                                            backgroundColor: '#dc2626',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Meetings Tab */}
            {activeTab === 'meetings' && (
                <div>
                    {/* Search and Filters */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '24px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <input
                            type="text"
                            placeholder="Search meetings..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                flex: 1,
                                minWidth: '200px'
                            }}
                        />
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px'
                            }}
                        >
                            <option value="">All Users</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.username} ({user.meeting_count})
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => loadMeetings(0)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            🔍 Search
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>Loading meetings...</div>
                    ) : (
                        <div>
                            <div style={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                overflow: 'hidden'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#f8fafc' }}>
                                        <tr>
                                            <th style={tableHeaderStyle}>Title</th>
                                            <th style={tableHeaderStyle}>User</th>
                                            <th style={tableHeaderStyle}>Created</th>
                                            <th style={tableHeaderStyle}>Duration</th>
                                            <th style={tableHeaderStyle}>Status</th>
                                            <th style={tableHeaderStyle}>Tags</th>
                                            <th style={tableHeaderStyle}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {meetings.map(meeting => (
                                            <tr key={meeting.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tableCellStyle}>
                                                    <div style={{ fontWeight: '500' }}>{meeting.title}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                        {meeting.id.slice(0, 8)}...
                                                    </div>
                                                </td>
                                                <td style={tableCellStyle}>{meeting.username}</td>
                                                <td style={tableCellStyle}>
                                                    {new Date(meeting.created_at).toLocaleDateString()}
                                                </td>
                                                <td style={tableCellStyle}>
                                                    {meeting.duration ? `${Math.round(meeting.duration / 60)}m` : '-'}
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {meeting.has_transcription && (
                                                            <span style={{ 
                                                                backgroundColor: '#22c55e', 
                                                                color: 'white', 
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px', 
                                                                fontSize: '10px' 
                                                            }}>T</span>
                                                        )}
                                                        {meeting.has_summary && (
                                                            <span style={{ 
                                                                backgroundColor: '#3b82f6', 
                                                                color: 'white', 
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px', 
                                                                fontSize: '10px' 
                                                            }}>S</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                        {meeting.tags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                style={{
                                                                    backgroundColor: '#e5e7eb',
                                                                    color: '#374151',
                                                                    padding: '1px 4px',
                                                                    borderRadius: '3px',
                                                                    fontSize: '10px'
                                                                }}
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <button
                                                        onClick={() => deleteMeeting(meeting.id)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            backgroundColor: '#dc2626',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '16px',
                                padding: '16px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px'
                            }}>
                                <div style={{ fontSize: '14px', color: '#64748b' }}>
                                    Showing {meetingsPagination.offset + 1}-{Math.min(meetingsPagination.offset + meetingsPagination.limit, meetingsPagination.total_count)} of {meetingsPagination.total_count}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => loadMeetings(Math.max(0, meetingsPagination.offset - meetingsPagination.limit))}
                                        disabled={meetingsPagination.offset === 0}
                                        style={{
                                            padding: '6px 12px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: meetingsPagination.offset === 0 ? '#f3f4f6' : 'white',
                                            borderRadius: '4px',
                                            cursor: meetingsPagination.offset === 0 ? 'not-allowed' : 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        ← Previous
                                    </button>
                                    <button
                                        onClick={() => loadMeetings(meetingsPagination.offset + meetingsPagination.limit)}
                                        disabled={!meetingsPagination.has_more}
                                        style={{
                                            padding: '6px 12px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: !meetingsPagination.has_more ? '#f3f4f6' : 'white',
                                            borderRadius: '4px',
                                            cursor: !meetingsPagination.has_more ? 'not-allowed' : 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
    return (
        <div style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</div>
            <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#1e293b',
                marginBottom: '4px'
            }}>
                {value}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>{title}</div>
        </div>
    )
}

const tableHeaderStyle = {
    padding: '12px',
    textAlign: 'left' as const,
    fontWeight: '600',
    color: '#374151',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '14px'
}

const tableCellStyle = {
    padding: '12px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '14px',
    verticalAlign: 'top' as const
}
