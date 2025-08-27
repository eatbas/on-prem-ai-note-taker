import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Recorder, FloatingRecorder } from '../../features/recording'
import { useToast } from '../common'
import { globalRecordingManager } from '../../stores/globalRecordingManager'

interface AppShellProps {
  text: string
  setText: (text: string) => void
  tag: string
  setTag: (tag: string) => void
  online: boolean
  availableTags: [string, number][]
  setAvailableTags: (tags: [string, number][]) => void
  refreshSignal: number
  setRefreshSignal: (signal: number) => void
  vpsUp: boolean
  children: React.ReactNode
}

export default function AppShell({
  text,
  setText,
  tag,
  setTag,
  online,
  availableTags,
  setAvailableTags,
  refreshSignal,
  setRefreshSignal,
  vpsUp,
  children
}: AppShellProps) {
  const navigate = useNavigate()
  const { ToastContainer } = useToast()
  
  // Global recording state for FloatingRecorder
  const [globalRecordingState, setGlobalRecordingState] = useState(() => 
    globalRecordingManager.getState()
  )

  // Subscribe to global recording state changes
  useEffect(() => {
    const handleStateChange = (state: any) => {
      setGlobalRecordingState(state)
    }
    
    const unsubscribe = globalRecordingManager.subscribe(handleStateChange)
    return unsubscribe
  }, [])

  const handleRecordingCreated = (meetingId: string) => {
    console.log('🎙️ Recording created:', meetingId)
    setRefreshSignal(refreshSignal + 1)
  }

  const handleRecordingStopped = (meetingId: string) => {
    console.log('🛑 Recording stopped:', meetingId)
    setRefreshSignal(refreshSignal + 1)
  }

  const handleFloatingRecorderStop = () => {
    console.log('🛑 FloatingRecorder stop requested')
    globalRecordingManager.stopRecording()
  }

  return (
    <div style={{ 
      maxWidth: '100%', 
      margin: '0 auto', 
      padding: '24px',
      fontFamily: 'Inter, system-ui, Arial, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px',
        padding: '16px 24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Logo and Title */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          <div style={{ 
            fontSize: '32px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold'
          }}>
            🎙️
          </div>
          <div>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              margin: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              dgMeets
            </h1>
            <p style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              margin: 0,
              fontWeight: '500'
            }}>
              AI-Powered Meeting Notes
            </p>
          </div>
        </div>

        {/* Navigation and Status */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px' 
        }}>
          {/* Connection Status */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: online ? '#22c55e' : '#ef4444'
            }} />
            {online ? 'Online' : 'Offline'}
            
            {vpsUp !== null && (
              <>
                <span style={{ margin: '0 4px' }}>•</span>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: vpsUp ? '#22c55e' : '#ef4444'
                }} />
                AI {vpsUp ? 'Ready' : 'Unavailable'}
              </>
            )}
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
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
              🏠 Home
            </button>
            
            <button
              onClick={() => navigate('/admin')}
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
              ⚙️ Admin
            </button>
          </div>
        </div>
      </header>

      {/* Recording Controls Bar */}
      <div style={{
        marginBottom: '24px',
        padding: '16px 24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <Recorder
          onCreated={handleRecordingCreated}
          onStopped={handleRecordingStopped}
          text={text}
          setText={setText}
          tag={tag}
          setTag={setTag}
          online={online}
          vpsUp={vpsUp}
          showStopButton={true}
        />
      </div>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Floating Recorder for Electron */}
      <FloatingRecorder
        isRecording={globalRecordingState.isRecording}
        recordingTime={globalRecordingState.recordingTime}
        meetingId={globalRecordingState.meetingId}
        onStopRecording={handleFloatingRecorderStop}
      />

      {/* Toast Container */}
      <ToastContainer />
    </div>
  )
}
