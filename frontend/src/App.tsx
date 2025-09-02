import React, { Suspense, lazy } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { isTauri, isElectron, logPlatformInfo } from './lib/tauri'

// 🚀 STAGE 3 OPTIMIZATION: Lazy load major components for code splitting
const Dashboard = lazy(() => import('./features/meetings/pages/Dashboard'))
const MeetingView = lazy(() => import('./features/meetings/pages/MeetingView'))
const AdminDashboard = lazy(() => import('./features/admin/pages/AdminDashboard'))

// Import Recorder directly (small component, frequently used)
import { Recorder } from './features/recording'

// Import shared utilities
import { useToast, ErrorBoundary } from './components/common'
import { watchOnline } from './services'
import { globalRecordingManager } from './stores/recording'
import { useVpsHealth } from './stores/apiStateManager'

// Import API state manager to ensure it initializes
import { apiStateManager } from './stores/api'

// Import App components
import { AppShell, RecordingProvider } from './components/app'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationContainer } from './components/common'
import { loadBackgroundProcessor, preloadCriticalServices } from './lib/serviceLoader'
import './services/cleanupJobs' // Import cleanup utilities for emergency use
import { cleanupSyncedMeetings } from './services/sync/duplicateChecker'

// Fix: Use a component instead of a variable to ensure proper React Router context
function RouterWrapper({ children }: { children: React.ReactNode }) {
  const isDesktopApp = isTauri() || isElectron()
  
  if (isDesktopApp) {
    return <HashRouter>{children}</HashRouter>
  }
  return <BrowserRouter>{children}</BrowserRouter>
}

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
  
  // Log platform information for debugging
  useEffect(() => {
    logPlatformInfo()
  }, [])

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
        
        // 🧹 PHASE 2: Cleanup synced meetings to prevent duplicates
        await cleanupSyncedMeetings()
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
        <RouterWrapper>
          <ErrorBoundary>
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
                <Route path="/tauri-audio-test" element={<TauriAudioTestPage />} />
              </Routes>
            </Suspense>
          </AppShell>
          </ErrorBoundary>
        </RouterWrapper>
        
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

function TauriAudioTestPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [activeDevices, setActiveDevices] = useState<string[]>([])
  const [bufferSize, setBufferSize] = useState(0)
  const [platform, setPlatform] = useState('')

  useEffect(() => {
    const initializePlatform = async () => {
      if (isTauri()) {
        setPlatform('Tauri')
        await loadDevices()
      } else if (isElectron()) {
        setPlatform('Electron')
      } else {
        setPlatform('Web Browser')
      }
    }
    
    initializePlatform()
  }, [])

  const loadDevices = async () => {
    if (!isTauri()) return
    
    try {
      const { tauriAudio } = await import('./services/tauriAudio')
      const audioDevices = await tauriAudio.getAudioDevices()
      setDevices(audioDevices)
      console.log('🎵 Available audio devices:', audioDevices)
    } catch (error) {
      console.error('Failed to load audio devices:', error)
    }
  }

  const startSystemAudio = async () => {
    if (!isTauri()) return
    
    try {
      const { tauriAudio } = await import('./services/tauriAudio')
      const success = await tauriAudio.startSystemAudioCapture()
      if (success) {
        setIsRecording(true)
        console.log('✅ System audio capture started!')
      }
    } catch (error) {
      console.error('Failed to start system audio:', error)
    }
  }

  const startMicrophone = async () => {
    if (!isTauri()) return
    
    try {
      const { tauriAudio } = await import('./services/tauriAudio')
      const success = await tauriAudio.startMicrophoneCapture()
      if (success) {
        setIsRecording(true)
        console.log('✅ Microphone capture started!')
      }
    } catch (error) {
      console.error('Failed to start microphone:', error)
    }
  }

  const stopCapture = async () => {
    if (!isTauri()) return
    
    try {
      const { tauriAudio } = await import('./services/tauriAudio')
      await tauriAudio.stopCapture()
      setIsRecording(false)
      console.log('🛑 Audio capture stopped!')
    } catch (error) {
      console.error('Failed to stop capture:', error)
    }
  }

  const checkStatus = async () => {
    if (!isTauri()) return
    
    try {
      const { tauriAudio } = await import('./services/tauriAudio')
      const recording = await tauriAudio.isCurrentlyRecording()
      const devices = await tauriAudio.getActiveDevices()
      const bufferSize = await tauriAudio.getBufferSize()
      
      setIsRecording(recording)
      setActiveDevices(devices)
      setBufferSize(bufferSize)
      
      console.log('📊 Status:', { recording, devices, bufferSize })
    } catch (error) {
      console.error('Failed to check status:', error)
    }
  }

  const showFloatingRecorder = async () => {
    if (!isTauri()) return
    
    try {
      const { safeInvoke } = await import('./lib/tauri')
      await safeInvoke('show_floating_recorder')
      console.log('🪟 Floating recorder shown!')
    } catch (error) {
      console.error('Failed to show floating recorder:', error)
    }
  }

  const hideFloatingRecorder = async () => {
    if (!isTauri()) return
    
    try {
      const { safeInvoke } = await import('./lib/tauri')
      await safeInvoke('hide_floating_recorder')
      console.log('🫥 Floating recorder hidden!')
    } catch (error) {
      console.error('Failed to hide floating recorder:', error)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h1>🔊 Tauri Native Audio Test</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Platform: {platform}</h3>
        <p>
          {isTauri() && '✅ Tauri detected - Native audio available!'}
          {isElectron() && '⚡ Electron detected - Limited browser audio'}
          {!isTauri() && !isElectron() && '🌐 Web browser - Basic audio only'}
        </p>
      </div>

      {isTauri() && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <h3>🎵 Available Audio Devices ({devices.length})</h3>
            <button onClick={loadDevices} style={{ marginBottom: '10px' }}>
              🔄 Refresh Devices
            </button>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px' }}>
              {devices.map((device, index) => (
                <div key={index} style={{ 
                  padding: '5px', 
                  margin: '5px 0', 
                  backgroundColor: device.is_system ? '#e3f2fd' : '#f5f5f5',
                  borderRadius: '4px'
                }}>
                  <strong>{device.name}</strong> 
                  {device.is_system && ' 🔊 SYSTEM AUDIO'}
                  <br />
                  <small>ID: {device.id} | Channels: {device.channels} | Sample Rate: {device.sample_rate}Hz</small>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>🪟 Window Controls</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
              <button 
                onClick={showFloatingRecorder}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#9C27B0', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🪟 Show Floating Recorder
              </button>
              
              <button 
                onClick={hideFloatingRecorder}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#607D8B', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🫥 Hide Floating Recorder
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>🎙️ Audio Capture Controls</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={startSystemAudio} 
                disabled={isRecording}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#2196F3', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                  opacity: isRecording ? 0.6 : 1
                }}
              >
                🔊 Start System Audio
              </button>
              
              <button 
                onClick={startMicrophone} 
                disabled={isRecording}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#4CAF50', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                  opacity: isRecording ? 0.6 : 1
                }}
              >
                🎤 Start Microphone
              </button>
              
              <button 
                onClick={stopCapture} 
                disabled={!isRecording}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#f44336', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: !isRecording ? 'not-allowed' : 'pointer',
                  opacity: !isRecording ? 0.6 : 1
                }}
              >
                🛑 Stop Capture
              </button>
              
              <button 
                onClick={checkStatus}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#FF9800', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                📊 Check Status
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>📊 Current Status</h3>
            <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <p><strong>Recording:</strong> {isRecording ? '🔴 Active' : '⚫ Stopped'}</p>
              <p><strong>Active Devices:</strong> {activeDevices.length > 0 ? activeDevices.join(', ') : 'None'}</p>
              <p><strong>Buffer Size:</strong> {bufferSize.toLocaleString()} samples</p>
            </div>
          </div>
        </>
      )}

      {!isTauri() && (
        <div style={{ padding: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '8px' }}>
          <h3>⚠️ Tauri Not Detected</h3>
          <p>This test page requires Tauri for native audio capture. You're currently running in {platform}.</p>
          <p>To test native audio:</p>
          <ol>
            <li>Make sure you're running the Tauri desktop app</li>
            <li>Use <code>cargo tauri dev</code> to start the app</li>
          </ol>
        </div>
      )}
    </div>
  )
}
