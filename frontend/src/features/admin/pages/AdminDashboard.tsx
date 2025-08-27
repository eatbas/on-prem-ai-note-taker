import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../../components/common'
import { ProgressDashboard, JobQueue } from '../../../components/queue'

// Import new admin components
import AdminStats from '../components/AdminStats'
import AdminUsers from '../components/AdminUsers'
import AdminMeetings from '../components/AdminMeetings'
import AdminTools from '../components/AdminTools'

// Import admin API utilities
import {
    loadStats,
    loadUsers,
    loadMeetings,
    deleteUser,
    deleteMeeting
} from '../utils/adminApi'
import { config } from '../../../utils/envLoader'

// Types
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

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'meetings' | 'tools' | 'jobs' | 'progress'>('stats')
    
    // Data state
    const [stats, setStats] = useState<Stats | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [meetings, setMeetings] = useState<AdminMeeting[]>([])
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
    
    const { showToast, ToastContainer } = useToast()

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
            // Debug: Log auth configuration
            console.log('🔐 Admin Auth Debug:', {
                hasUsername: !!config.basicAuthUsername,
                hasPassword: !!config.basicAuthPassword,
                apiBaseUrl: config.apiBaseUrl,
                username: config.basicAuthUsername ? `${config.basicAuthUsername.substring(0, 2)}***` : 'undefined'
            })
            
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

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure? This will delete the user and ALL their meetings permanently.')) {
            return
        }
        
        try {
            await deleteUser(userId)
            await loadUsersData() // Reload users
            showToast('User deleted successfully', 'success')
        } catch (err) {
            console.error('Failed to delete user:', err)
            showToast(`Failed to delete user: ${err}`, 'error')
        }
    }

    const handleDeleteMeeting = async (meetingId: string) => {
        if (!confirm('Are you sure? This will delete the meeting permanently.')) {
            return
        }
        
        try {
            await deleteMeeting(meetingId)
            await loadMeetingsData() // Reload current page
            showToast('Meeting deleted successfully', 'success')
        } catch (err) {
            console.error('Failed to delete meeting:', err)
            showToast(`Failed to delete meeting: ${err}`, 'error')
        }
    }

    const handleMeetingPageChange = (offset: number) => {
        setMeetingsPagination(prev => ({ ...prev, offset }))
        loadMeetingsData(offset)
    }

    const tabs = [
        { key: 'stats', label: '📊 Statistics', description: 'System overview' },
        { key: 'users', label: '👥 Users', description: 'User management' },
        { key: 'meetings', label: '📋 Meetings', description: 'Meeting management' },
        { key: 'tools', label: '🔧 Tools', description: 'Administrative tools' },
        { key: 'jobs', label: '⚙️ Jobs', description: 'Background jobs' },
        { key: 'progress', label: '📈 Progress', description: 'System progress' }
    ]

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
                        loading={loading}
                        error={error}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onDeleteUser={handleDeleteUser}
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
            case 'tools':
                return (
                    <AdminTools
                        onShowToast={(type: 'success' | 'error', message: string) => showToast(message, type)}
                    />
                )
            case 'jobs':
                return <JobQueue online={true} vpsUp={true} />
            case 'progress':
                return <ProgressDashboard online={true} vpsUp={true} />
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
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '32px' 
            }}>
                <div>
                    <h1 style={{ 
                        fontSize: '32px', 
                        fontWeight: 'bold', 
                        margin: '0 0 8px 0',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Admin Dashboard
                    </h1>
                    <p style={{ 
                        fontSize: '16px', 
                        color: '#6b7280', 
                        margin: 0 
                    }}>
                        System administration and monitoring
                    </p>
                </div>
                
                <button
                    onClick={() => navigate('/')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        fontWeight: '500'
                    }}
                >
                    ← Back to App
                </button>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '6px',
                marginBottom: '32px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                gap: '4px',
                overflowX: 'auto'
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            flex: '1',
                            minWidth: '140px',
                            padding: '12px 16px',
                            backgroundColor: activeTab === tab.key ? '#ffffff' : 'transparent',
                            color: activeTab === tab.key ? '#1f2937' : '#6b7280',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab.key ? '600' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== tab.key) {
                                e.currentTarget.style.backgroundColor = '#f1f5f9'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== tab.key) {
                                e.currentTarget.style.backgroundColor = 'transparent'
                            }
                        }}
                    >
                        <span>{tab.label}</span>
                        <span style={{ 
                            fontSize: '11px', 
                            color: activeTab === tab.key ? '#6b7280' : '#9ca3af' 
                        }}>
                            {tab.description}
                        </span>
                    </button>
                ))}
            </div>

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

            {/* Auth Configuration Status - Bottom */}
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

            <ToastContainer />
        </div>
    )
}
