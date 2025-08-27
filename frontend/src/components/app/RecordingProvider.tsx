import React, { useEffect } from 'react'

interface RecordingProviderProps {
  isRecording: boolean
  recordingMeetingId: string | null
  onRecordingCreated: (meetingId: string) => void
  onRecordingStopped: (meetingId: string) => void
  children: React.ReactNode
}

export default function RecordingProvider({
  isRecording,
  recordingMeetingId,
  onRecordingCreated,
  onRecordingStopped,
  children
}: RecordingProviderProps) {
  // Handle Electron integration
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI

      // Update Electron tray with recording state
      electronAPI.sendRecordingState(isRecording)

      // Send recording details if recording
      if (isRecording && recordingMeetingId) {
        electronAPI.sendRecordingStarted({
          meetingId: recordingMeetingId,
          recordingTime: 0,
          showFloating: true
        })
      }
    }
  }, [isRecording, recordingMeetingId])

  // Handle page refresh during recording
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRecording) {
        event.preventDefault()
        event.returnValue = 'You have an active recording. Are you sure you want to leave?'
        return event.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isRecording])

  // Clear stuck recording states on mount
  useEffect(() => {
    const clearStuckStates = async () => {
      try {
        // Import dynamically to avoid circular dependencies
        const { clearStuckRecordingState } = await import('../../utils')
        await clearStuckRecordingState()
      } catch (error) {
        console.warn('Failed to clear stuck recording states:', error)
      }
    }

    clearStuckStates()
  }, [])

  return <>{children}</>
}
