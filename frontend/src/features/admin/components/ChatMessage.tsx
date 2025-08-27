import React from 'react'

interface ChatEntry {
    id: number
    question: string
    answer: string
    model: string
    timestamp: Date
    durationSeconds: number
}

interface ChatMessageProps {
    entry: ChatEntry
}

export default function ChatMessage({ entry }: ChatMessageProps) {
    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        }
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}m ${remainingSeconds}s`
    }

    return (
        <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
            {/* Question */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                }}>
                    <div style={{
                        fontSize: '20px',
                        backgroundColor: '#dbeafe',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        👤
                    </div>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1f2937'
                    }}>
                        You asked:
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: '#6b7280'
                    }}>
                        {entry.timestamp.toLocaleTimeString()}
                    </span>
                </div>
                <div style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151'
                }}>
                    {entry.question}
                </div>
            </div>

            {/* Answer */}
            <div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                }}>
                    <div style={{
                        fontSize: '20px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        🤖
                    </div>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1f2937'
                    }}>
                        AI Response:
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: '#6b7280'
                    }}>
                        {entry.model}
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        borderRadius: '4px'
                    }}>
                        {formatDuration(entry.durationSeconds)}
                    </span>
                </div>
                <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fbbf24',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                }}>
                    {entry.answer}
                </div>
            </div>
        </div>
    )
}
