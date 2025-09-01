import React from 'react'
import ChatMessage from './ChatMessage'

interface ChatEntry {
    id: number
    question: string
    answer: string
    model: string
    timestamp: Date
    durationSeconds: number
}

interface ChatHistoryProps {
    chatHistory: ChatEntry[]
    onClearHistory: () => void
    loading: boolean
}

export default function ChatHistory({ chatHistory, onClearHistory, loading }: ChatHistoryProps) {
    const totalDuration = chatHistory.reduce((sum, entry) => sum + entry.durationSeconds, 0)
    const avgDuration = chatHistory.length > 0 ? Math.round(totalDuration / chatHistory.length) : 0

    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        }
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}m ${remainingSeconds}s`
    }

    if (chatHistory.length === 0 && !loading) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#6b7280'
            }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>💬</div>
                <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#1f2937'
                }}>
                    No chat history yet
                </h3>
                <p style={{
                    fontSize: '16px',
                    marginBottom: '16px'
                }}>
                    Start a conversation with the AI to see your chat history here
                </p>
                <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #0ea5e9',
                    borderRadius: '8px',
                    padding: '16px',
                    maxWidth: '400px',
                    margin: '0 auto'
                }}>
                    <p style={{
                        fontSize: '14px',
                        color: '#0c4a6e',
                        margin: 0
                    }}>
                        💡 <strong>Tip:</strong> Your chat history is saved locally and will persist 
                        between sessions. Ask questions about your meetings, data analysis, or general topics!
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div>
            {/* History Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
            }}>
                <div>
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        margin: '0 0 4px 0',
                        color: '#1f2937'
                    }}>
                        💬 Chat History
                    </h3>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        fontSize: '14px',
                        color: '#6b7280'
                    }}>
                        <span>📊 {chatHistory.length} conversation{chatHistory.length !== 1 ? 's' : ''}</span>
                        {chatHistory.length > 0 && (
                            <>
                                <span>⏱️ Avg response: {formatDuration(avgDuration)}</span>
                                <span>🕒 Total time: {formatDuration(totalDuration)}</span>
                            </>
                        )}
                    </div>
                </div>
                
                {chatHistory.length > 0 && (
                    <button
                        onClick={onClearHistory}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef4444'
                        }}
                    >
                        🗑️ Clear History
                    </button>
                )}
            </div>

            {/* Chat Messages */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                {chatHistory.map((entry) => (
                    <ChatMessage key={entry.id} entry={entry} />
                ))}
            </div>

            {/* Footer Stats */}
            {chatHistory.length > 0 && (
                <div style={{
                    marginTop: '32px',
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '12px',
                    fontSize: '14px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                            {chatHistory.length}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                            Total Chats
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                            {formatDuration(avgDuration)}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                            Avg Response
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                            {formatDuration(totalDuration)}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                            Total Time
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                            {chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].timestamp.toLocaleDateString() : 'N/A'}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                            Last Chat
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
