import React, { useState, useEffect } from 'react'
import { chat } from '../../../services'

// Import chat components
import ChatInput from '../components/ChatInput'
import ChatHistory from '../components/ChatHistory'
import ChatMessage from '../components/ChatMessage'

// Import custom hook
import { useChatTimer } from '../hooks/useChatTimer'

interface ChatEntry {
    id: number
    question: string
    answer: string
    model: string
    timestamp: Date
    durationSeconds: number
}

interface AskLlamaProps {
    online: boolean
    vpsUp: boolean | null
}

export default function AskLlama({ online, vpsUp }: AskLlamaProps) {
    // Chat state
    const [prompt, setPrompt] = useState('')
    const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [model] = useState<string>('qwen2.5:3b-instruct')
    const [requestId, setRequestId] = useState(0)
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')

    // Custom timer hook
    const {
        elapsedSeconds,
        lastThinkingSeconds,
        getDurationSeconds,
        resetTimer,
        recordThinkingTime
    } = useChatTimer(loading)

    // Debug logging for status
    useEffect(() => {
        console.log('🔍 AskLlama Debug Status:', { online, vpsUp, loading, error })
    }, [online, vpsUp, loading, error])

    // Load chat history from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ask-llama-history')
            if (saved) {
                const parsed = JSON.parse(saved)
                // Convert timestamp strings back to Date objects
                const withDates = parsed.map((entry: any) => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp)
                }))
                setChatHistory(withDates)
            }
        } catch (err) {
            console.warn('Failed to load chat history from localStorage:', err)
        }
    }, [])

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('ask-llama-history', JSON.stringify(chatHistory))
        } catch (err) {
            console.warn('Failed to save chat history to localStorage:', err)
        }
    }, [chatHistory])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!prompt.trim() || loading || !online || !vpsUp) {
            return
        }

        const currentRequestId = requestId + 1
        setRequestId(currentRequestId)
        setLoading(true)
        setError(null)
        resetTimer()

        console.log(`[Request ${currentRequestId}] Starting chat request...`)

        const currentPrompt = prompt.trim()
        const currentModel = model || undefined

        try {
            console.log(`[Request ${currentRequestId}] Sending prompt to model ${currentModel}:`, currentPrompt)
            const result = await chat(currentPrompt, currentModel)
            console.log(`[Request ${currentRequestId}] Chat response received:`, result)

            // Only process if this is still the current request
            if (currentRequestId === requestId + 1) {
                const durationSeconds = recordThinkingTime()
                
                const newEntry: ChatEntry = {
                    id: Date.now(),
                    question: currentPrompt,
                    answer: result.response || result.answer || 'No response received',
                    model: currentModel || 'unknown',
                    timestamp: new Date(),
                    durationSeconds: durationSeconds
                }

                setChatHistory(prev => [...prev, newEntry])
                setPrompt('')
                setError(null)

                console.log(`✅ [Request ${currentRequestId}] Chat completed successfully in ${durationSeconds}s`)
            } else {
                console.log(`⚠️ [Request ${currentRequestId}] Request outdated, ignoring response`)
            }
        } catch (err) {
            console.error(`❌ [Request ${currentRequestId}] Chat request failed:`, err)
            if (currentRequestId === requestId + 1) {
                setError(err instanceof Error ? err.message : 'An error occurred')
            }
        } finally {
            if (currentRequestId === requestId + 1) {
                setLoading(false)
            }
        }
    }

    const handleCancel = () => {
        console.log('🛑 Chat request cancelled by user')
        setLoading(false)
        setError(null)
        resetTimer()
    }

    const resetChat = () => {
        setChatHistory([])
        setError(null)
        console.log('🔄 Chat history cleared')
    }

    // Input should only be disabled for connection issues, not empty text
    const isInputDisabled = !online || !vpsUp || loading
    const isSubmitDisabled = isInputDisabled || !prompt.trim()

    const getCurrentResponse = () => {
        if (loading) {
            return (
                <div style={{
                    backgroundColor: '#fffbeb',
                    border: '2px solid #fbbf24',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                    }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            border: '3px solid #fbbf24',
                            borderTop: '3px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <span style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#92400e'
                        }}>
                            🤖 AI is thinking...
                        </span>
                    </div>
                    <div style={{
                        fontSize: '14px',
                        color: '#92400e'
                    }}>
                        Please wait while we process your question ({elapsedSeconds}s)
                    </div>
                    {lastThinkingSeconds && (
                        <div style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            marginTop: '8px'
                        }}>
                            Previous response took {lastThinkingSeconds}s
                        </div>
                    )}
                </div>
            )
        }

        if (error) {
            return (
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '2px solid #fecaca',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                    }}>
                        <span style={{ fontSize: '20px' }}>❌</span>
                        <span style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#dc2626'
                        }}>
                            Error occurred
                        </span>
                    </div>
                    <div style={{
                        fontSize: '14px',
                        color: '#dc2626',
                        lineHeight: '1.5'
                    }}>
                        {error}
                    </div>
                </div>
            )
        }

        return null
    }

    const tabs = [
        { key: 'current', label: '💬 Current Chat', description: 'Ask questions here' },
        { key: 'history', label: `📚 History (${chatHistory.length})`, description: 'View past conversations' }
    ]

    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '20px',
            fontFamily: 'Inter, system-ui, Arial, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: '32px'
            }}>
                <h1 style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    margin: '0 0 8px 0',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    🤖 Ask AI Assistant
                </h1>
                <p style={{
                    fontSize: '16px',
                    color: '#6b7280',
                    margin: 0
                }}>
                    Chat with your AI assistant powered by {model}
                </p>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '6px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            flex: 1,
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
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                minHeight: '400px'
            }}>
                {activeTab === 'current' ? (
                    <div>
                        {/* Current Response */}
                        {getCurrentResponse()}

                        {/* Latest Message */}
                        {chatHistory.length > 0 && !loading && !error && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    marginBottom: '12px',
                                    color: '#1f2937'
                                }}>
                                    📝 Latest Conversation
                                </h3>
                                <ChatMessage entry={chatHistory[chatHistory.length - 1]} />
                            </div>
                        )}

                        {/* Chat Input */}
                        <ChatInput
                            prompt={prompt}
                            onPromptChange={setPrompt}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            loading={loading}
                            disabled={isInputDisabled}
                            online={online}
                            vpsUp={vpsUp}
                            elapsedSeconds={elapsedSeconds}
                        />
                    </div>
                ) : (
                    <ChatHistory
                        chatHistory={chatHistory}
                        onClearHistory={resetChat}
                        loading={loading}
                    />
                )}
            </div>

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
