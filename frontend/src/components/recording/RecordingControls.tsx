import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useNotification } from '../../contexts/NotificationContext'

interface RecordingControlsProps {
  isRecording: boolean
  recordingTime: number
  onStart: () => void
  onStop: () => void
  showStopButton?: boolean
  disabled?: boolean
  error?: string | null
  micStream?: MediaStream | null
  speakerStream?: MediaStream | null
}

// 🚀 STAGE 2 OPTIMIZATION: Memoize component to prevent unnecessary re-renders
const RecordingControls = memo(function RecordingControls({
  isRecording,
  recordingTime,
  onStart,
  onStop,
  showStopButton = true,
  disabled = false,
  error,
  micStream,
  speakerStream
}: RecordingControlsProps) {
  
  const [micLevel, setMicLevel] = useState(0)
  const [speakerLevel, setSpeakerLevel] = useState(0)
  const [isForceStopMode, setIsForceStopMode] = useState(false)
  const [lastStopClick, setLastStopClick] = useState(0)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const tauriLevelPollingRef = useRef<number | null>(null)
  
  const { showNotification } = useNotification()

  // Show notification when error occurs
  useEffect(() => {
    if (error) {
      showNotification(error, 'error')
    }
  }, [error, showNotification])

  // Add/remove body class for recording state
  useEffect(() => {
    if (isRecording) {
      document.body.classList.add('recording-active')
    } else {
      document.body.classList.remove('recording-active')
    }

    return () => {
      document.body.classList.remove('recording-active')
    }
  }, [isRecording])

  // 🚀 STAGE 2 OPTIMIZATION: Memoize time formatting to prevent unnecessary recalculations
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // 🚀 STAGE 2 OPTIMIZATION: Memoize cleanup function to prevent unnecessary recreations
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (error) {
        console.warn('Error closing audio context:', error)
      }
      audioContextRef.current = null
    }

    micAnalyserRef.current = null
    speakerAnalyserRef.current = null
    setMicLevel(0)
    setSpeakerLevel(0)
  }, []) // No dependencies - cleanup logic is stable

  // 🚀 STAGE 2 OPTIMIZATION: Memoize high-frequency audio level updates
  const updateAudioLevels = useCallback(() => {
    // Update microphone level
    if (micAnalyserRef.current) {
      const micData = new Uint8Array(micAnalyserRef.current.frequencyBinCount)
      micAnalyserRef.current.getByteFrequencyData(micData)
      
      const micSum = micData.reduce((sum, value) => sum + value * value, 0)
      const micRms = Math.sqrt(micSum / micData.length)
      // Increase sensitivity and add minimum visible level
      const normalizedLevel = (micRms / 255) * 3 // Increase sensitivity by 3x
      setMicLevel(Math.max(normalizedLevel, 0.05)) // Minimum 5% visible level
    }

    // Update speaker level
    if (speakerAnalyserRef.current) {
      const speakerData = new Uint8Array(speakerAnalyserRef.current.frequencyBinCount)
      speakerAnalyserRef.current.getByteFrequencyData(speakerData)
      
      const speakerSum = speakerData.reduce((sum, value) => sum + value * value, 0)
      const speakerRms = Math.sqrt(speakerSum / speakerData.length)
      // Increase sensitivity and add minimum visible level
      const normalizedLevel = (speakerRms / 255) * 3 // Increase sensitivity by 3x
      setSpeakerLevel(Math.max(normalizedLevel, 0.05)) // Minimum 5% visible level
    }

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevels)
    }
  }, [isRecording]) // Only recreate if recording state changes

  // 🚀 STAGE 2 OPTIMIZATION: Memoize audio monitoring setup to prevent unnecessary recreations
  const setupAudioMonitoring = useCallback(() => {
    cleanup() // Clean up any existing monitoring

    try {
      audioContextRef.current = new AudioContext()

      // Setup microphone monitoring
      if (micStream && audioContextRef.current) {
        const micSource = audioContextRef.current.createMediaStreamSource(micStream)
        micAnalyserRef.current = audioContextRef.current.createAnalyser()
        micAnalyserRef.current.fftSize = 256
        micAnalyserRef.current.smoothingTimeConstant = 0.3
        micAnalyserRef.current.minDecibels = -90
        micAnalyserRef.current.maxDecibels = -10
        micSource.connect(micAnalyserRef.current)
      }

      // Setup speaker monitoring
      if (speakerStream && audioContextRef.current) {
        const speakerSource = audioContextRef.current.createMediaStreamSource(speakerStream)
        speakerAnalyserRef.current = audioContextRef.current.createAnalyser()
        speakerAnalyserRef.current.fftSize = 256
        speakerAnalyserRef.current.smoothingTimeConstant = 0.3
        speakerAnalyserRef.current.minDecibels = -90
        speakerAnalyserRef.current.maxDecibels = -10
        speakerSource.connect(speakerAnalyserRef.current)
      }

      // Start monitoring loop
      updateAudioLevels()
    } catch (error) {
      console.warn('Audio monitoring setup failed:', error)
    }
  }, [micStream, speakerStream, updateAudioLevels, cleanup]) // Dependencies: recreate only when streams or updateAudioLevels change

  // Setup audio monitoring when streams change
  useEffect(() => {
    // Debug logging for stream states
    console.log('🎵 RecordingControls: Stream state check', {
      isRecording,
      hasMicStream: !!micStream,
      hasSpeakerStream: !!speakerStream,
      micStreamTracks: micStream?.getAudioTracks().length || 0,
      speakerStreamTracks: speakerStream?.getAudioTracks().length || 0
    })
    
    // Only setup monitoring if we have streams with actual audio tracks
    const hasValidMicStream = micStream && micStream.getAudioTracks().length > 0
    const hasValidSpeakerStream = speakerStream && speakerStream.getAudioTracks().length > 0
    
    // Check if these are Tauri streams (empty streams with special markers)
    const isTauriMicStream = micStream && (micStream as any).__isTauriMicStream
    const isTauriSystemStream = speakerStream && (speakerStream as any).__isTauriSystemStream
    const hasTauriStreams = isTauriMicStream || isTauriSystemStream
    
    if (isRecording && hasTauriStreams) {
      // Use Tauri-specific audio level monitoring
      console.log('🦀 Setting up Tauri audio level monitoring...')
      
      const pollTauriAudioLevels = async () => {
        try {
          // Get real audio levels from Tauri native capture
          const { tauriAudio } = await import('../../services/tauriAudio')
          
          if (isTauriMicStream) {
            const micLevel = await tauriAudio.getMicrophoneLevel()
            // Add a small minimum for visual feedback when recording
            setMicLevel(Math.max(micLevel, 0.02))
          }
          
          if (isTauriSystemStream) {
            const systemLevel = await tauriAudio.getSystemAudioLevel()
            // Add a small minimum for visual feedback when recording
            setSpeakerLevel(Math.max(systemLevel, 0.02))
          }
        } catch (error) {
          console.warn('Failed to get Tauri audio levels, using fallback:', error)
          // Fallback to minimal simulation if real levels fail
          if (isTauriMicStream) {
            setMicLevel(0.05 + Math.random() * 0.1)
          }
          if (isTauriSystemStream) {
            setSpeakerLevel(0.05 + Math.random() * 0.1)
          }
        }
      }
      
      // Poll audio levels every 100ms for smooth updates
      const interval = setInterval(pollTauriAudioLevels, 100)
      tauriLevelPollingRef.current = interval as any
      
      // Initial call
      pollTauriAudioLevels()
      
      console.log('✅ Tauri audio level monitoring active')
    } else if (isRecording && (hasValidMicStream || hasValidSpeakerStream)) {
      setupAudioMonitoring()
    } else {
      cleanup()
    }

    return () => {
      cleanup()
      if (tauriLevelPollingRef.current) {
        clearInterval(tauriLevelPollingRef.current)
        tauriLevelPollingRef.current = null
      }
    }
  }, [isRecording, micStream, speakerStream, setupAudioMonitoring, cleanup])

  // 🚀 STAGE 2 OPTIMIZATION: Memoize expensive display calculations
  const formattedTime = useMemo(() => formatTime(recordingTime), [formatTime, recordingTime])
  
  const micLevelPercentage = useMemo(() => Math.round(micLevel * 100), [micLevel])
  const speakerLevelPercentage = useMemo(() => Math.round(speakerLevel * 100), [speakerLevel])

  // Handle stop recording with double-click force stop
  const handleStopClick = useCallback(async () => {
    const now = Date.now()
    const timeSinceLastClick = now - lastStopClick
    setLastStopClick(now)

    // Double-click within 500ms triggers force stop
    if (timeSinceLastClick < 500 && timeSinceLastClick > 0) {
      console.log('🚨 Double-click detected - FORCE STOPPING...')
      setIsForceStopMode(true)
      
      // Import and use force stop
      try {
        const { globalRecordingManager } = await import('../../stores/recording')
        await globalRecordingManager.forceStopRecording()
        console.log('✅ Force stop completed')
      } catch (error) {
        console.error('❌ Force stop failed:', error)
      }
      
      setIsForceStopMode(false)
      return
    }

    // Single click - normal stop
    console.log('🛑 Normal stop recording...')
    onStop()
  }, [lastStopClick, onStop])
  
  const streamStatusInfo = useMemo(() => ({
    micConnected: !!micStream,
    speakerConnected: !!speakerStream,
    bothConnected: !!micStream && !!speakerStream
  }), [micStream, speakerStream])

  return (
    <>
      {/* Sticky Recording Status Bar - only show when recording */}
      {isRecording && (
        <div 
          className="recording-banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            height: '80px',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
            border: '2px solid #fecaca',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            transition: 'all 0.3s ease'
          }}
        >
          {/* REC Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#dc2626'
          }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                animation: 'pulse 1.5s infinite',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
              }}
            />
            REC
          </div>

          {/* Timer */}
          <div style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1f2937',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            padding: '4px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '6px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            {formattedTime}
          </div>

                      {/* Audio Levels */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(34, 197, 94, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(34, 197, 94, 0.1)'
            }}>
              {/* Microphone Level */}
              {micStream && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ 
                    color: micLevel > 0.02 ? '#22c55e' : '#9ca3af',
                    minWidth: '24px',
                    fontSize: '16px',
                    filter: micLevel > 0.02 ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.4))' : 'none',
                    transition: 'all 0.2s ease'
                  }}>
                    🎤
                  </span>
                  <div style={{
                    width: '80px',
                    height: '20px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '10px',
                    border: '2px solid #e5e7eb',
                    overflow: 'hidden',
                    position: 'relative',
                    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(micLevelPercentage, 8)}%`,
                        background: micLevel > 0.7 ? 
                          'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)' :
                          micLevel > 0.3 ? 
                          'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
                          '#22c55e',
                        transition: 'width 0.15s ease-out',
                        borderRadius: '8px',
                        minWidth: '8px',
                        boxShadow: '0 0 8px rgba(34, 94, 197, 0.3)',
                        animation: micLevel > 0.1 ? 'audioPulse 2s ease-in-out infinite' : 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* System Audio Level */}
              {speakerStream && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ 
                    color: speakerLevel > 0.02 ? '#22c55e' : '#9ca3af',
                    minWidth: '24px',
                    fontSize: '16px',
                    filter: speakerLevel > 0.02 ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.4))' : 'none',
                    transition: 'all 0.2s ease'
                  }}>
                    🔊
                  </span>
                  <div style={{
                    width: '80px',
                    height: '20px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '10px',
                    border: '2px solid #e5e7eb',
                    overflow: 'hidden',
                    position: 'relative',
                    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(speakerLevelPercentage, 8)}%`,
                        background: speakerLevel > 0.7 ? 
                          'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)' :
                          speakerLevel > 0.3 ? 
                          'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
                          '#22c55e',
                        transition: 'width 0.15s ease-out',
                        borderRadius: '8px',
                        minWidth: '8px',
                        boxShadow: '0 0 8px rgba(34, 197, 94, 0.3)',
                        animation: speakerLevel > 0.1 ? 'audioPulse 2s ease-in-out infinite' : 'none'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

          {/* Stop Button with Force Stop on Double-Click */}
          <button 
            onClick={handleStopClick}
            disabled={isForceStopMode}
            style={{
              padding: '10px 18px',
              backgroundColor: isForceStopMode ? '#7c2d12' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isForceStopMode ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isForceStopMode ? 
                '0 4px 8px rgba(124, 45, 18, 0.5)' : 
                '0 4px 8px rgba(239, 68, 68, 0.3)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
              opacity: isForceStopMode ? 0.8 : 1
            }}
            onMouseEnter={(e) => {
              if (!isForceStopMode) {
                e.currentTarget.style.backgroundColor = '#dc2626'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 12px rgba(239, 68, 68, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isForceStopMode) {
                e.currentTarget.style.backgroundColor = '#ef4444'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)'
              }
            }}
            title="Click to stop recording. Double-click for force stop if recording won't stop normally."
          >
            {isForceStopMode ? (
              <>🚨 Force Stopping...</>
            ) : (
              <>⏹️ Stop Recording</>
            )}
          </button>
        </div>
      )}

      {/* Main Recording Controls - only show when not recording */}
      {!isRecording && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '8px'
        }}>
          <button 
            onClick={onStart} 
            disabled={disabled}
            style={{
              padding: '8px 16px',
              backgroundColor: disabled ? '#9ca3af' : '#3b82f6',
              color: disabled ? '#6b7280' : 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }
            }}
          >
            🎙️ Start Recording
          </button>
        </div>
      )}


    </>
  )
})

export default RecordingControls

// CSS for pulse animation (should be added to global styles)
export const recordingControlsStyles = `
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes audioPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.02);
  }
}
`
