import React, { useEffect, useState, useRef } from 'react'
import { db } from '../../services'
import { globalRecordingManager, GlobalRecordingState } from '../../stores/globalRecordingManager'
import { queueMeetingProcessing } from '../../services/backgroundProcessor'
import { useToast } from '../common'
import { useNotification } from '../../contexts/NotificationContext'

// Import our new components
import RecordingControls from './RecordingControls'
import RecordingModal, { RecordingConfig } from './RecordingModal'

// InputModal no longer needed - removed naming step

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
  // No longer need naming modal - meetings are created immediately with timestamp names

  // const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle') // No longer needed
  // const [retryCount, setRetryCount] = useState(0) // No longer needed

  // No longer using local audio recorder hook - audio is handled by global recording manager
  
  // Notification system
  const { showNotification, removeNotification } = useNotification()
  const currentNotificationId = useRef<string | null>(null)
  
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

  // Cleanup on unmount - but DO NOT stop recording during navigation
  useEffect(() => {
    return () => {
      // Do not stop recording on component unmount - that was the bug!
      // Recording should persist across navigation
      console.log('🎙️ Recorder component unmounting - preserving recording state')
    }
  }, [])

  const handleStartRecording = () => {
    setShowModal(true)
  }

  const handleModalStartRecording = async (config: RecordingConfig) => {
    try {
      // Start recording - this will create the meeting automatically with timestamp name
      const result = await globalRecordingManager.startRecording({
        micDeviceId: config.micDeviceId,
        language: config.language,
        scope: config.scope
      })

      // Always close the modal, regardless of success or failure
      setShowModal(false)

      if (result.success && result.meetingId) {
        onCreated(result.meetingId)

        // Show system audio reminder notification
        showNotification(
          '🔊 Starting automatic system audio capture... Check console for details if no system audio is recorded.',
          'info',
          6000
        )

        // Notify Electron
        if (window.electronAPI) {
          window.electronAPI.sendRecordingState(true)
          window.electronAPI.sendRecordingStarted({
            meetingId: result.meetingId,
            recordingTime: 0,
            showFloating: config.showFloatingWidget
          })
        }

        console.log('🎙️ Dual-channel recording started successfully')
      } else {
        // Show error if recording failed
        showToast('❌ Failed to start recording. Please try again.', 'error')
        console.error('Recording failed:', result)
      }
    } catch (error) {
      // Always close the modal even on error
      setShowModal(false)
      console.error('Failed to start recording:', error)
      showToast(`❌ Recording error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  const handleStopRecording = async () => {
    console.log('🛑 Stopping recording...')

    // Stop recording using global recording manager (handles both audio and state)
    const stoppedMeetingId = await globalRecordingManager.stopRecording()
    console.log(`🎯 Recording stopped, meetingId from globalRecordingManager: ${stoppedMeetingId}`)

    // Notify Electron
    if (window.electronAPI) {
      window.electronAPI.sendRecordingState(false)
    }

    // Immediately call onStopped to update App state
    if (onStopped && stoppedMeetingId) {
      console.log('🔄 Calling onStopped callback immediately')
      onStopped(stoppedMeetingId)
    }

    // Queue meeting for background processing (no user interaction needed)
    if (stoppedMeetingId) {
      await queueBackgroundProcessing(stoppedMeetingId)
    }
  }

  // Queue meeting for background processing (persistent across navigation)
  const queueBackgroundProcessing = async (meetingId: string) => {
    try {
      console.log('🚀 Queuing meeting for background processing:', meetingId)
      
      // Update meeting duration
      await db.meetings.update(meetingId, {
        duration: recordingTime,
        updatedAt: Date.now()
      })
      
      // Queue for background processing - this will persist across navigation
      const jobId = await queueMeetingProcessing(meetingId, recordingTime)
      
      // Handle different queue results to prevent duplicates
      if (jobId === 'already_processed') {
        showToast('✅ Recording saved! Meeting was already processed.', 'success')
        return
      }
      
      if (jobId === 'already_processing') {
        showToast('⏳ Recording saved! Meeting is already being processed.', 'info')
        return
      }
      
      if (jobId === 'already_queued') {
        showToast('⚠️ Recording saved! Meeting is already queued for processing.', 'info')
        return
      }
      
      // Successfully queued - show notification that processing has started
      showNotification(
        '🔄 Meeting queued for processing. Processing will continue in background even if you navigate away.',
        'info',
        8000
      )
      
      showToast('✅ Recording saved! Processing started in background.', 'success')
      
      console.log('✅ Meeting queued successfully with job ID:', jobId)
      
    } catch (error) {
      console.error('❌ Failed to queue meeting for processing:', error)
      showToast(`❌ Failed to start processing: ${error}`, 'error')
    }
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
        error={globalRecordingState.error}
        micStream={globalRecordingState.micStream}
      />





      {/* Recording Modal */}
      <RecordingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onStartRecording={handleModalStartRecording}
        isRecording={isRecording}
      />

      {/* No longer need naming modal - meetings are created with timestamp names and can be renamed later */}
    </div>
  )
}
