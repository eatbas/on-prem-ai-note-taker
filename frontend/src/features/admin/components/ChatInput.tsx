import React, { useRef, useEffect } from 'react'

interface ChatInputProps {
    prompt: string
    onPromptChange: (prompt: string) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    loading: boolean
    disabled: boolean
    online: boolean
    vpsUp: boolean | null
    elapsedSeconds: number
}

export default function ChatInput({
    prompt,
    onPromptChange,
    onSubmit,
    onCancel,
    loading,
    disabled,
    online,
    vpsUp,
    elapsedSeconds
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
        }
    }, [prompt])

    const getStatusMessage = () => {
        if (!online) return { text: '📡 Offline - No internet connection', color: '#ef4444' }
        if (!vpsUp) return { text: '🚫 AI Server Offline - Check connection', color: '#ef4444' }
        if (loading) return { text: `🤖 AI is thinking... (${elapsedSeconds}s)`, color: '#f59e0b' }
        return { text: '✅ Ready to chat', color: '#22c55e' }
    }

    const status = getStatusMessage()

    return (
        <div style={{
            position: 'sticky',
            bottom: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
            zIndex: 10
        }}>
            {/* Status Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                fontSize: '14px'
            }}>
                <span style={{ color: status.color, fontWeight: '500' }}>
                    {status.text}
                </span>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>
                    Model: qwen2.5:3b-instruct
                </span>
            </div>

            {/* Chat Form */}
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        placeholder={disabled 
                            ? (!online ? 'Offline - Check your internet connection' 
                               : !vpsUp ? 'AI Server Offline - Check VPS connection'
                               : 'Loading...')
                            : 'Ask the AI anything... (Shift+Enter for new line)'
                        }
                        disabled={disabled}
                        style={{
                            width: '100%',
                            minHeight: '60px',
                            maxHeight: '200px',
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            resize: 'none',
                            backgroundColor: disabled ? '#f9fafb' : '#ffffff',
                            color: disabled ? '#9ca3af' : '#1f2937',
                            outline: 'none'
                        }}
                        onFocus={(e) => {
                            if (!disabled) {
                                e.target.style.borderColor = '#3b82f6'
                            }
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb'
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                if (!disabled && prompt.trim()) {
                                    onSubmit(e)
                                }
                            }
                        }}
                    />
                    
                    {/* Character count */}
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        fontSize: '11px',
                        color: '#9ca3af',
                        backgroundColor: '#ffffff',
                        padding: '2px 6px',
                        borderRadius: '4px'
                    }}>
                        {prompt.length}/2000
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                    }}>
                        💡 Tip: Press Shift+Enter for new line, Enter to send
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {loading && (
                            <button
                                type="button"
                                onClick={onCancel}
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
                            >
                                ⏹️ Cancel
                            </button>
                        )}
                        
                        <button
                            type="submit"
                            disabled={disabled}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: disabled ? '#9ca3af' : (loading ? '#f59e0b' : '#3b82f6'),
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                if (!disabled && !loading) {
                                    e.currentTarget.style.backgroundColor = '#2563eb'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!disabled && !loading) {
                                    e.currentTarget.style.backgroundColor = '#3b82f6'
                                }
                            }}
                        >
                            {loading ? (
                                <>
                                    <div style={{
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid white',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    Thinking...
                                </>
                            ) : (
                                <>
                                    🚀 Send Question
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* CSS Animation */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
