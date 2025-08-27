import React, { useEffect, useState } from 'react'
import { createMeeting, autoProcessMeetingRecordingWithWhisperOptimization, db } from '../../services'
import { globalRecordingManager, GlobalRecordingState } from '../../stores/globalRecordingManager'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useToast } from '../common'

// Import our new components
import RecordingControls from './RecordingControls'
import RecordingModal, { RecordingConfig } from './RecordingModal'

import { InputModal } from '../common'

// CSS animations for the component
const styles = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`

// Inject styles once
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = styles
  document.head.appendChild(styleElement)
}

interface RecorderProps {
  onCreated: (meetingId: string) => void
  onStopped?: (meetingId: string) => void
  text: string
  setText: (text: string) => void
  tag: string
  setTag: (tag: string) => void
  online: boolean
  vpsUp: boolean | null
  showStopButton?: boolean
}

export default function Recorder({
  onCreated,
  onStopped,
  text: _text,
  setText: _setText,
  tag: _tag,
  setTag: _setTag,
  online: _online,
  vpsUp: _vpsUp,
  showStopButton = true
}: RecorderProps) {
  // Global recording state
  const [globalRecordingState, setGlobalRecordingState] = useState<GlobalRecordingState>(
    globalRecordingManager.getState()
  )
  
  // Local state
  const [showModal, setShowModal] = useState(false)
  const [showNamingModal, setShowNamingModal] = useState(false)
  const [pendingMeetingId, setPendingMeetingId] = useState<string | null>(null)

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle')
  const [retryCount, setRetryCount] = useState(0)

  // Audio recorder hook
  const { state: recorderState, startRecording, stopRecording, cleanup } = useAudioRecorder()
  
  // Toast notifications
  const { showToast } = useToast()

  // Derived state
  const isRecording = globalRecordingState.isRecording
  const recordingTime = globalRecordingState.recordingTime

  // Subscribe to global recording manager
  useEffect(() => {
    const unsubscribe = globalRecordingManager.subscribe((state) => {
      setGlobalRecordingState(state)
    })

    // Initialize with current state
    setGlobalRecordingState(globalRecordingManager.getState())

    // Check for interrupted recording
    if (globalRecordingManager.isRecordingInterrupted()) {
      const info = globalRecordingManager.getInterruptedRecordingInfo()
      if (info) {
        console.warn('🎙️ Recording interrupted by page refresh:', info)
        // You could show a dialog here to resume or clear the state
        globalRecordingManager.clearInterruptedState()
      }
    }

    return unsubscribe
  }, [])

  // Electron integration
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onTrayAction((action) => {
        if (action === 'start-recording' && !isRecording) {
          handleStartRecording()
        } else if (action === 'stop-recording' && isRecording) {
          handleStopRecording()
        }
      })

      return () => {
        window.electronAPI.removeTrayActionListener()
      }
    }
  }, [isRecording])

  // Update Electron tray when recording state changes
  useEffect(() => {
    if (window.electronAPI) {
      console.log('🎙️ Sending recording state to Electron:', isRecording)
      window.electronAPI.sendRecordingState(isRecording)
    }
  }, [isRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const handleStartRecording = () => {
    setShowModal(true)
  }

  const handleModalStartRecording = async (config: RecordingConfig) => {
    try {
      // Create meeting
      const now = new Date()
      const human = now.toLocaleString()
      const meeting = await createMeeting(`Meeting ${human}`, [], config.language)
      const meetingId = meeting.id

      console.log('📝 Meeting created:', {
        id: meetingId.slice(0, 8) + '...',
        title: meeting.title,
        language: config.language
      })

      // Start audio recording
      const success = await startRecording(meetingId, {
        micDeviceId: config.micDeviceId,
        speakerDeviceId: config.speakerDeviceId,
        language: config.language
      })

      if (success) {

        setShowModal(false)
        onCreated(meetingId)

        // Start global recording manager for timer and UI state (audio handling is in useAudioRecorder)
        globalRecordingManager.startRecording(meetingId)

        // Notify Electron
        if (window.electronAPI) {
          window.electronAPI.sendRecordingState(true)
          window.electronAPI.sendRecordingStarted({
            meetingId,
            recordingTime: 0,
            showFloating: config.showFloatingWidget
          })
        }

        console.log('🎙️ Dual-channel recording started successfully')
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopRecording = async () => {
    console.log('🛑 Stopping recording...')

    // Stop audio recording
    await stopRecording()

    // Stop global recording manager
    const stoppedMeetingId = globalRecordingManager.stopRecording()

    // Notify Electron
    if (window.electronAPI) {
      window.electronAPI.sendRecordingState(false)
    }

    // Immediately call onStopped to update App state
    if (onStopped && stoppedMeetingId) {
      console.log('🔄 Calling onStopped callback immediately')
      onStopped(stoppedMeetingId)
    }

    // Process the meeting
    if (stoppedMeetingId) {
      await processMeeting(stoppedMeetingId)
    }


  }

  const processMeeting = async (meetingId: string) => {
    // Show modal to ask for meeting name
    setPendingMeetingId(meetingId)
    setShowNamingModal(true)
  }

  const handleMeetingNameConfirm = async (title: string) => {
    if (pendingMeetingId && title.trim()) {
      await db.meetings.update(pendingMeetingId, {
        title: title.trim(),
        updatedAt: Date.now(),
        duration: recordingTime
      })
    }
    setShowNamingModal(false)
    
    // Continue with auto-processing if we have a meeting ID
    if (pendingMeetingId) {
      continueProcessing(pendingMeetingId)
    }
    setPendingMeetingId(null)
  }

  const handleMeetingNameCancel = () => {
    setShowNamingModal(false)
    // Continue with auto-processing with default name if we have a meeting ID
    if (pendingMeetingId) {
      continueProcessing(pendingMeetingId)
    }
    setPendingMeetingId(null)
  }

  const continueProcessing = async (meetingId: string) => {

    // Auto-process the meeting
    setTimeout(async () => {
      try {
        console.log('Auto-processing meeting...')
        setSyncStatus('syncing')
        await autoProcessMeetingRecordingWithWhisperOptimization(meetingId)
        console.log('Meeting auto-processed successfully!')
        setSyncStatus('success')
        setRetryCount(0)

        // Reset success status after 3 seconds
        setTimeout(() => setSyncStatus('idle'), 3000)

        // Final callback after processing
        if (onStopped) {
          console.log('🔄 Final onStopped callback after processing')
          onStopped(meetingId)
        }
      } catch (error) {
        console.error('Auto-processing failed:', error)
        setSyncStatus('failed')

        // Auto-retry logic with proper state management
        if (retryCount < 3) {
          const nextRetryCount = retryCount + 1
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
          console.log(`Auto-retry in ${delay / 1000} seconds... (attempt ${nextRetryCount}/3)`)
          
          setRetryCount(nextRetryCount)
          
          setTimeout(async () => {
            console.log(`🔄 Retry ${nextRetryCount}/3: Starting auto-processing...`)
            setSyncStatus('syncing')
            
            try {
              await autoProcessMeetingRecordingWithWhisperOptimization(meetingId)
              console.log('✅ Retry successful!')
              setSyncStatus('success')
              setRetryCount(0)
              showToast('✅ Meeting processed successfully!', 'success')
              setTimeout(() => setSyncStatus('idle'), 3000)
            } catch (retryError) {
              console.error(`❌ Retry ${nextRetryCount}/3 failed:`, retryError)
              if (nextRetryCount >= 3) {
                console.log('❌ Max retries reached - giving up')
                setSyncStatus('failed')
                showToast(`❌ Auto-processing failed after 3 attempts. Please try processing manually.`, 'error')
                setTimeout(() => {
                  setSyncStatus('idle')
                  setRetryCount(0)
                }, 5000)
              } else {
                // Let the next iteration handle the retry
                setSyncStatus('failed')
                showToast(`⚠️ Processing failed, retrying... (${nextRetryCount}/3)`, 'info')
              }
            }
          }, delay)
        } else {
          console.log('❌ Max retries reached - stopping')
          setSyncStatus('failed')
          showToast(`❌ Auto-processing failed after 3 attempts. Please try processing manually.`, 'error')
          setTimeout(() => {
            setSyncStatus('idle')
            setRetryCount(0)
          }, 5000)
        }
      }
    }, 1000)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px',
      padding: '20px'
    }}>
      {/* Recording Controls */}
      <RecordingControls
        isRecording={isRecording}
        recordingTime={recordingTime}
        onStart={handleStartRecording}
        onStop={handleStopRecording}
        showStopButton={showStopButton}
        error={recorderState.error}
        micStream={recorderState.micStream}
        speakerStream={recorderState.speakerStream}
      />



      {/* Processing Status - only show syncing, errors go to notifications */}
      {syncStatus === 'syncing' && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#f59e0b',
            animation: 'pulse 1.5s infinite'
          }} />
          <span style={{
            fontWeight: 'bold',
            color: '#92400e'
          }}>
            🔄 Processing meeting with AI...{retryCount > 0 ? ` (Retry ${retryCount}/3)` : ''}
          </span>
        </div>
      )}

      {/* Recording Modal */}
      <RecordingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onStartRecording={handleModalStartRecording}
        isRecording={isRecording}
      />

      {/* Meeting Naming Modal */}
      <InputModal
        isOpen={showNamingModal}
        title="Name this meeting"
        placeholder="Enter meeting name..."
        defaultValue="New meeting"
        onConfirm={handleMeetingNameConfirm}
        onCancel={handleMeetingNameCancel}
      />
    </div>
  )
}
