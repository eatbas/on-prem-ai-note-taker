import React, { memo } from 'react'

interface ChatHeaderProps {
  model: string
}

const ChatHeader = memo(function ChatHeader({ model }: ChatHeaderProps) {
  return (
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
  )
})

export default ChatHeader
