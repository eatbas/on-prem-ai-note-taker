import React, { useState, useEffect, memo } from 'react'
import { chat } from '../../../services'

// Import chat components
import {
  ChatHeader,
  ChatTabNavigation,
  ChatContainer
} from '../components/chat'

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

const AskLlama = memo(function AskLlama({ online, vpsUp }: AskLlamaProps) {
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

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Inter, system-ui, Arial, sans-serif'
    }}>
      {/* Header */}
      <ChatHeader model={model} />

      {/* Tab Navigation */}
      <ChatTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        chatHistoryCount={chatHistory.length}
      />

      {/* Chat Container */}
      <ChatContainer
        activeTab={activeTab}
        chatHistory={chatHistory}
        loading={loading}
        error={error}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        online={online}
        vpsUp={vpsUp}
        elapsedSeconds={elapsedSeconds}
        onClearHistory={resetChat}
      />

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})

export default AskLlama
