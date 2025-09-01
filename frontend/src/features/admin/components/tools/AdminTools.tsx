import React, { useState } from 'react'
import { getVpsHealth } from '../../../../services'

interface AdminToolsProps {
    onShowToast: (type: 'success' | 'error', message: string) => void
}

export default function AdminTools({ onShowToast }: AdminToolsProps) {
    const [testingHealth, setTestingHealth] = useState(false)

    const handleHealthCheck = async () => {
        setTestingHealth(true)
        try {
            const health = await getVpsHealth()
            // eslint-disable-next-line no-alert
            alert(`Backend OK\nWhisper: ${health.whisper_model}\nOllama: ${health.ollama_model}`)
            onShowToast('success', 'Health check completed successfully')
        } catch (error) {
            console.error('Health check failed:', error)
            onShowToast('error', `Health check failed: ${error}`)
        } finally {
            setTestingHealth(false)
        }
    }

    const handleClearLocalStorage = () => {
        if (confirm('Are you sure you want to clear all local storage? This will log you out and remove all local data.')) {
            localStorage.clear()
            sessionStorage.clear()
            onShowToast('success', 'Local storage cleared')
            // Reload the page to reset the app state
            window.location.reload()
        }
    }

    const handleReloadApp = () => {
        if (confirm('Are you sure you want to reload the application?')) {
            window.location.reload()
        }
    }

    const handleExportLogs = () => {
        try {
            // Get console logs (limited to what's available)
            const logs = [
                `Admin Dashboard Logs - ${new Date().toISOString()}`,
                '='.repeat(50),
                'Browser Information:',
                `User Agent: ${navigator.userAgent}`,
                `Platform: ${navigator.platform}`,
                `Language: ${navigator.language}`,
                `Cookies Enabled: ${navigator.cookieEnabled}`,
                `Online: ${navigator.onLine}`,
                '',
                'Storage Information:',
                `Local Storage Items: ${localStorage.length}`,
                `Session Storage Items: ${sessionStorage.length}`,
                '',
                'Performance Information:',
                `Memory Used: ${(performance as any).memory ? `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`,
                `Connection: ${(navigator as any).connection ? `${(navigator as any).connection.effectiveType} (${(navigator as any).connection.downlink} Mbps)` : 'N/A'}`,
                '',
                'Application State:',
                `Current URL: ${window.location.href}`,
                `Timestamp: ${new Date().toISOString()}`,
                ''
            ].join('\n')

            const blob = new Blob([logs], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            
            const a = document.createElement('a')
            a.href = url
            a.download = `admin-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
            a.click()
            
            URL.revokeObjectURL(url)
            onShowToast('success', 'Logs exported successfully')
        } catch (error) {
            console.error('Failed to export logs:', error)
            onShowToast('error', 'Failed to export logs')
        }
    }

    const tools = [
        {
            title: 'Backend Health Check',
            description: 'Test connection to the backend API and check service status',
            icon: '🏥',
            action: handleHealthCheck,
            loading: testingHealth,
            color: '#22c55e'
        },
        {
            title: 'Clear Local Storage',
            description: 'Remove all locally stored data and reset the application',
            icon: '🧹',
            action: handleClearLocalStorage,
            loading: false,
            color: '#f59e0b'
        },
        {
            title: 'Reload Application',
            description: 'Force refresh the entire application',
            icon: '🔄',
            action: handleReloadApp,
            loading: false,
            color: '#3b82f6'
        },
        {
            title: 'Export Debug Logs',
            description: 'Download application logs and system information',
            icon: '📥',
            action: handleExportLogs,
            loading: false,
            color: '#8b5cf6'
        }
    ]

    return (
        <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
                🔧 Administrative Tools
            </h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
            }}>
                {tools.map((tool, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '24px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                fontSize: '32px',
                                width: '48px',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: `${tool.color}15`,
                                borderRadius: '12px'
                            }}>
                                {tool.icon}
                            </div>
                            <div>
                                <h3 style={{
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    margin: 0,
                                    color: '#1f2937'
                                }}>
                                    {tool.title}
                                </h3>
                            </div>
                        </div>

                        <p style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            lineHeight: '1.5',
                            margin: '0 0 20px 0'
                        }}>
                            {tool.description}
                        </p>

                        <button
                            onClick={tool.action}
                            disabled={tool.loading}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                backgroundColor: tool.loading ? '#9ca3af' : tool.color,
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: tool.loading ? 'not-allowed' : 'pointer',
                                opacity: tool.loading ? 0.6 : 1,
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                if (!tool.loading) {
                                    e.currentTarget.style.opacity = '0.9'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!tool.loading) {
                                    e.currentTarget.style.opacity = '1'
                                }
                            }}
                        >
                            {tool.loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        border: '2px solid white',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    Processing...
                                </span>
                            ) : (
                                `Execute ${tool.title}`
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* Warning Notice */}
            <div style={{
                marginTop: '32px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '8px',
                padding: '16px'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                }}>
                    <div style={{ fontSize: '20px' }}>⚠️</div>
                    <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        margin: 0,
                        color: '#92400e'
                    }}>
                        Administrative Tools Notice
                    </h4>
                </div>
                <p style={{
                    fontSize: '14px',
                    color: '#92400e',
                    lineHeight: '1.5',
                    margin: 0
                }}>
                    These tools perform system-level operations. Use with caution in production environments. 
                    Some actions (like clearing local storage) will require you to reload the application.
                </p>
            </div>

            {/* Add CSS animation */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
