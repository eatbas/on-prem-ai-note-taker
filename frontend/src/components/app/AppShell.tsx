import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Recorder, FloatingRecorder } from '../../features/recording'
import { useToast } from '../common'
import { globalRecordingManager } from '../../stores/globalRecordingManager'
import { getComputerUsername } from '../../utils/usernameDetector'
import dgMeetsLogo from '../../../../logo/dgMeets-512.png'

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
  const location = useLocation()
  const { ToastContainer } = useToast()
  
  // Check if we're on admin page
  const isAdminPage = location.pathname === '/admin'
  
  // Mobile navigation state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  
  // Global recording state for FloatingRecorder
  const [globalRecordingState, setGlobalRecordingState] = useState(() => 
    globalRecordingManager.getState()
  )

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        setIsMobileMenuOpen(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
      padding: isMobile ? '12px' : '24px',
      fontFamily: 'Inter, system-ui, Arial, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }}>
            {/* Responsive Header */}
      <header style={{
        marginBottom: isMobile ? '16px' : '32px',
        marginTop: globalRecordingState.isRecording ? (isMobile ? '70px' : '80px') : '0',
        padding: isMobile ? '12px 16px' : '16px 24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'margin-top 0.3s ease',
        position: 'relative',
        zIndex: 999
      }}>
        {/* Desktop Header */}
        {!isMobile ? (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
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
              <img 
                src={dgMeetsLogo} 
                alt="dgMeets Logo" 
                style={{ 
                  width: '48px',
                  height: '48px',
                  objectFit: 'contain'
                }}
              />
              <div>
                <h1 style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  margin: 0,
                  color: '#2563eb'
                }}>
                  dgMeets
                </h1>
                <p style={{ 
                  fontSize: '12px', 
                  color: '#6b7280', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  On-Prem AI-Powered Meeting Notes
                </p>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#3b82f6', 
                  margin: '4px 0 0 0',
                  fontWeight: '500'
                }}>
                  👋 Hello {getComputerUsername()}, ready to prepare your meeting notes securely
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

              {/* Navigation Buttons and Recording Controls */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Recording Controls - only show on non-admin pages */}
                {!isAdminPage && (
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
                )}
                
                {/* Navigation Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => navigate('/')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: location.pathname === '/' ? '#3b82f6' : '#f3f4f6',
                      color: location.pathname === '/' ? 'white' : '#374151',
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
                      backgroundColor: location.pathname === '/admin' ? '#3b82f6' : '#f3f4f6',
                      color: location.pathname === '/admin' ? 'white' : '#374151',
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
            </div>
          </div>
        ) : (
          /* Mobile Header */
          <div>
            {/* Top Row: Logo and Hamburger */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isMobileMenuOpen ? '16px' : '0'
            }}>
              {/* Logo */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate('/')}
              >
                <img 
                  src={dgMeetsLogo} 
                  alt="dgMeets Logo" 
                  style={{ 
                    width: '36px',
                    height: '36px',
                    objectFit: 'contain'
                  }}
                />
                <div>
                  <h1 style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    margin: 0,
                    color: '#2563eb'
                  }}>
                    dgMeets
                  </h1>
                </div>
              </div>

              {/* Hamburger Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb'
              }}>
                {/* Connection Status */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '12px',
                  color: '#6b7280',
                  padding: '8px'
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

                {/* Recording Controls - only show on non-admin pages */}
                {!isAdminPage && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
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
                )}
                
                {/* Navigation Buttons */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <button
                    onClick={() => {
                      navigate('/')
                      setIsMobileMenuOpen(false)
                    }}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: location.pathname === '/' ? '#3b82f6' : '#f3f4f6',
                      color: location.pathname === '/' ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      width: '100%'
                    }}
                  >
                    🏠 Home
                  </button>
                  
                  <button
                    onClick={() => {
                      navigate('/admin')
                      setIsMobileMenuOpen(false)
                    }}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: location.pathname === '/admin' ? '#3b82f6' : '#f3f4f6',
                      color: location.pathname === '/admin' ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      width: '100%'
                    }}
                  >
                    ⚙️ Admin
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main style={{
        paddingTop: '0',
        transition: 'padding-top 0.3s ease'
      }}>
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
