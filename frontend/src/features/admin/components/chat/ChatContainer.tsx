import React, { memo } from 'react'
import ChatInput from '../ChatInput'
import ChatHistory from '../ChatHistory'
import ChatMessage from '../ChatMessage'

interface ChatEntry {
  id: number
  question: string
  answer: string
  model: string
  timestamp: Date
  durationSeconds: number
}

interface ChatContainerProps {
  activeTab: 'current' | 'history'
  chatHistory: ChatEntry[]
  loading: boolean
  error: string | null
  prompt: string
  onPromptChange: (prompt: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  online: boolean
  vpsUp: boolean | null
  elapsedSeconds: number
  onClearHistory: () => void
}

const ChatContainer = memo(function ChatContainer({
  activeTab,
  chatHistory,
  loading,
  error,
  prompt,
  onPromptChange,
  onSubmit,
  onCancel,
  online,
  vpsUp,
  elapsedSeconds,
  onClearHistory
}: ChatContainerProps) {
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

  return (
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
            onPromptChange={onPromptChange}
            onSubmit={onSubmit}
            onCancel={onCancel}
            loading={loading}
            disabled={!online || !vpsUp || loading}
            online={online}
            vpsUp={vpsUp}
            elapsedSeconds={elapsedSeconds}
          />
        </div>
      ) : (
        <ChatHistory
          chatHistory={chatHistory}
          onClearHistory={onClearHistory}
          loading={loading}
        />
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})

export default ChatContainer
