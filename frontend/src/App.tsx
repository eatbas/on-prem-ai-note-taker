import React from 'react'
import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Import from new feature structure
import { Dashboard, MeetingView } from './features/meetings'
import { Recorder } from './features/recording'
import { AdminDashboard } from './features/admin'

// Import shared utilities
import { useToast } from './components/common'
import { watchOnline } from './services'
import { globalRecordingManager } from './stores/globalRecordingManager'
import { useVpsHealth } from './stores/apiStateManager'

// Import App components
import { AppShell, RecordingProvider } from './components/app'

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')
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

  // Watch online status
  useEffect(() => {
    return watchOnline((isOnline) => {
      setOnline(isOnline)
      console.log(`📶 Online status: ${isOnline ? 'Connected' : 'Disconnected'}`)
    })
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
    showToast('success', 'Recording started')
  }

  const handleRecordingStopped = (meetingId: string) => {
    console.log('🛑 Recording stopped:', meetingId)
    setRefreshSignal(prev => prev + 1)
    showToast('success', 'Recording stopped')
  }

  return (
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
          <Routes>
            <Route path="/" element={
              <Dashboard
                text={text}
                setText={setText}
                tag={tag}
                setTag={setTag}
                online={online}
                availableTags={availableTags}
                setAvailableTags={setAvailableTags}
                refreshSignal={refreshSignal}
                setRefreshSignal={setRefreshSignal}
              />
            } />
            
            <Route path="/meeting/:meetingId" element={<MeetingRoute />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/recorder-test" element={<RecorderTestPage />} />
          </Routes>
        </AppShell>
      </Router>
    </RecordingProvider>
  )
}

// Route components
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
