import React from 'react'

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

interface AdminStatsProps {
    stats: Stats | null
    loading: boolean
    error: string | null
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
    return (
        <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{ fontSize: '32px' }}>{icon}</div>
            <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                    {title}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                    {value}
                </div>
            </div>
        </div>
    )
}

export default function AdminStats({ stats, loading, error }: AdminStatsProps) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                <p>Loading statistics...</p>
            </div>
        )
    }

    if (error) {
        return (
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
        )
    }

    if (!stats) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>📊</div>
                <p>No statistics available</p>
            </div>
        )
    }

    return (
        <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
                📊 System Statistics
            </h2>

            {/* Key Metrics */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '16px',
                marginBottom: '32px'
            }}>
                <StatCard title="Total Users" value={stats.total_users} icon="👥" />
                <StatCard title="Total Meetings" value={stats.total_meetings} icon="📋" />
                <StatCard title="Transcriptions" value={stats.total_transcriptions} icon="📝" />
                <StatCard title="Summaries" value={stats.total_summaries} icon="📄" />
                <StatCard title="Recent (7 days)" value={stats.recent_meetings_7d} icon="🔥" />
                <StatCard 
                    title="Avg Duration" 
                    value={`${stats.average_meeting_duration_minutes.toFixed(1)}m`} 
                    icon="⏱️" 
                />
            </div>

            {/* System Information */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    🔧 System Configuration
                </h3>
                <div style={{ 
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                            <span style={{ fontWeight: '600', color: '#374151' }}>Whisper Model:</span>
                            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                {stats.system_info.whisper_model}
                            </span>
                        </div>
                        <div>
                            <span style={{ fontWeight: '600', color: '#374151' }}>Ollama Model:</span>
                            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                {stats.system_info.ollama_model}
                            </span>
                        </div>
                        <div>
                            <span style={{ fontWeight: '600', color: '#374151' }}>Ollama URL:</span>
                            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                {stats.system_info.ollama_base_url}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Tags */}
            {stats.top_tags.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                        🏷️ Most Used Tags
                    </h3>
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px' 
                    }}>
                        {stats.top_tags.slice(0, 10).map(([tag, count]) => (
                            <div
                                key={tag}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: '16px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span>{tag}</span>
                                <span style={{ 
                                    backgroundColor: '#1e40af',
                                    color: 'white',
                                    borderRadius: '10px',
                                    padding: '2px 6px',
                                    fontSize: '12px'
                                }}>
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
