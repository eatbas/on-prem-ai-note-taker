import React, { Suspense, lazy } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

// 🚀 STAGE 3 OPTIMIZATION: Lazy load major components for code splitting
const Dashboard = lazy(() => import('./features/meetings/pages/Dashboard'))
const MeetingView = lazy(() => import('./features/meetings/pages/MeetingView'))
const AdminDashboard = lazy(() => import('./features/admin/pages/AdminDashboard'))

// Import Recorder directly (small component, frequently used)
import { Recorder } from './features/recording'

// Import shared utilities
import { useToast } from './components/common'
import { watchOnline } from './services'
import { globalRecordingManager } from './stores/globalRecordingManager'
import { useVpsHealth } from './stores/apiStateManager'

// Import API state manager to ensure it initializes
import { apiStateManager } from './stores/api'

// Import App components
import { AppShell, RecordingProvider } from './components/app'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationContainer } from './components/common'
import { loadBackgroundProcessor, preloadCriticalServices } from './lib/serviceLoader'
import './services/cleanupJobs' // Import cleanup utilities for emergency use

const isElectron = typeof navigator !== 'undefined' && 
                  navigator.userAgent.toLowerCase().includes('electron') &&
                  typeof window !== 'undefined' && 
                  !!(window as any).electronAPI
const Router = isElectron ? HashRouter : BrowserRouter

export default function App() {
  // Global state
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [availableTags, setAvailableTags] = useState<[string, number][]>([])
  const [refreshSignal, setRefreshSignal] = useState(0)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingMeetingId, setRecordingMeetingId] = useState<string | null>(null)

  const { showToast } = useToast()
  const vpsHealth = useVpsHealth()

  // Ensure API state manager is referenced so it gets imported and initialized
  console.log('🔗 API State Manager loaded:', !!apiStateManager)

  // Watch online status
  useEffect(() => {
    return watchOnline((isOnline: boolean) => {
      setOnline(isOnline)
      console.log(`📶 Online status: ${isOnline ? 'Connected' : 'Disconnected'}`)
    })
  }, [])

  // TEMP FIX: Manually check VPS health on startup to fix AI status
  useEffect(() => {
    const checkVpsHealth = async () => {
      try {
        const { getVpsHealth } = await import('./services/api/diagnostics')
        const healthResult = await getVpsHealth()
        console.log('✅ Manual VPS health check successful:', healthResult)
        
        // Force update the API state manager
        if (apiStateManager) {
          apiStateManager.updateState({
            vpsHealth: {
              status: 'ok',
              data: healthResult,
              lastUpdated: Date.now()
            }
          })
          console.log('🔄 VPS health state updated manually')
        }
      } catch (error) {
        console.error('❌ Manual VPS health check failed:', error)
      }
    }

    // Delay to ensure app is loaded
    setTimeout(checkVpsHealth, 2000)
  }, [])

  // 🚀 STAGE 3 OPTIMIZATION: Initialize background processor with dynamic loading
  useEffect(() => {
    const initializeServices = async () => {
      try {
        const { initializeBackgroundProcessor } = await loadBackgroundProcessor()
        initializeBackgroundProcessor()
        
        // Preload other critical services during idle time
        preloadCriticalServices()
      } catch (error) {
        console.error('Failed to initialize background processor:', error)
      }
    }
    
    initializeServices()
  }, [])

  // Subscribe to global recording state
  useEffect(() => {
    const unsubscribe = globalRecordingManager.subscribe((state) => {
      setIsRecording(state.isRecording)
      setRecordingMeetingId(state.meetingId)
    })

    // Initialize with current state
    const currentState = globalRecordingManager.getState()
    setIsRecording(currentState.isRecording)
    setRecordingMeetingId(currentState.meetingId)

    return unsubscribe
  }, [])

  const handleRecordingCreated = (meetingId: string) => {
    console.log('🎙️ Recording created:', meetingId)
    setRefreshSignal(prev => prev + 1)
    showToast('Recording started', 'success')
  }

  const handleRecordingStopped = (meetingId: string) => {
    console.log('🛑 Recording stopped:', meetingId)
    setRefreshSignal(prev => prev + 1)
    showToast('Recording stopped', 'success')
  }

  return (
    <NotificationProvider>
      <RecordingProvider
        isRecording={isRecording}
        recordingMeetingId={recordingMeetingId}
        onRecordingCreated={handleRecordingCreated}
        onRecordingStopped={handleRecordingStopped}
      >
        <Router>
          <AppShell
            text={text}
            setText={setText}
            tag={tag}
            setTag={setTag}
            online={online}
            availableTags={availableTags}
            setAvailableTags={setAvailableTags}
            refreshSignal={refreshSignal}
            setRefreshSignal={setRefreshSignal}
            vpsUp={vpsHealth.status === 'ok'}
          >
            {/* 🚀 STAGE 3 OPTIMIZATION: Wrap routes with Suspense for lazy loading */}
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={
                  <DashboardRoute 
                    text={text}
                    setText={setText}
                    tag={tag}
                    setTag={setTag}
                    online={online}
                    vpsUp={vpsHealth.status === 'ok'}
                    onTagsChange={setAvailableTags}
                    refreshSignal={refreshSignal}
                    isRecording={isRecording}
                    recordingMeetingId={recordingMeetingId}
                  />
                } />
                
                <Route path="/meeting/:meetingId" element={<MeetingRoute />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/recorder-test" element={<RecorderTestPage />} />
              </Routes>
            </Suspense>
          </AppShell>
        </Router>
        
        {/* Global notification container */}
        <NotificationContainer />
      </RecordingProvider>
    </NotificationProvider>
  )
}

// 🚀 STAGE 3 OPTIMIZATION: Loading component for lazy loaded routes
function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '400px',
      color: '#64748b',
      fontSize: '16px',
      fontWeight: '500'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span>⚡ Loading optimized content...</span>
      </div>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

// Route components
function DashboardRoute(props: {
  text: string
  setText: (text: string) => void
  tag: string
  setTag: (tag: string) => void
  online: boolean
  vpsUp: boolean | null
  onTagsChange: (tags: [string, number][]) => void
  refreshSignal: number
  isRecording: boolean
  recordingMeetingId: string | null
}) {
  const navigate = useNavigate()
  
  const handleOpenMeeting = (meetingId: string) => {
    navigate(`/meeting/${meetingId}`)
  }
  
  return (
    <Dashboard
      onOpen={handleOpenMeeting}
      {...props}
    />
  )
}

function MeetingRoute() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  
  if (!meetingId) {
    navigate('/')
    return null
  }
  
  return (
    <MeetingView 
      meetingId={meetingId} 
      onBack={() => navigate('/')} 
    />
  )
}

function RecorderTestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>🎙️ Audio Recording Test</h1>
      <Recorder
        onCreated={(id) => console.log('Test recording created:', id)}
        onStopped={(id) => console.log('Test recording stopped:', id)}
        text=""
        setText={() => {}}
        tag=""
        setTag={() => {}}
        online={true}
        vpsUp={true}
      />
    </div>
  )
}
