import React, { useState, useEffect, useRef } from 'react'
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

export default function RecordingControls({
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
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  const { showNotification } = useNotification()

  // Show notification when error occurs
  useEffect(() => {
    if (error) {
      showNotification(error, 'error')
    }
  }, [error, showNotification])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Setup audio monitoring when streams change
  useEffect(() => {
    if (isRecording && (micStream || speakerStream)) {
      setupAudioMonitoring()
    } else {
      cleanup()
    }

    return cleanup
  }, [isRecording, micStream, speakerStream])

  const setupAudioMonitoring = () => {
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
  }

  const updateAudioLevels = () => {
    // Update microphone level
    if (micAnalyserRef.current) {
      const micData = new Uint8Array(micAnalyserRef.current.frequencyBinCount)
      micAnalyserRef.current.getByteFrequencyData(micData)
      
      const micSum = micData.reduce((sum, value) => sum + value * value, 0)
      const micRms = Math.sqrt(micSum / micData.length)
      setMicLevel(micRms / 255)
    }

    // Update speaker level
    if (speakerAnalyserRef.current) {
      const speakerData = new Uint8Array(speakerAnalyserRef.current.frequencyBinCount)
      speakerAnalyserRef.current.getByteFrequencyData(speakerData)
      
      const speakerSum = speakerData.reduce((sum, value) => sum + value * value, 0)
      const speakerRms = Math.sqrt(speakerSum / speakerData.length)
      setSpeakerLevel(speakerRms / 255)
    }

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevels)
    }
  }

  const cleanup = () => {
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
  }

  return (
    <>
      {/* Sticky Recording Status Bar - only show when recording */}
      {isRecording && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
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
                animation: 'pulse 1.5s infinite'
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
            letterSpacing: '1px'
          }}>
            {formatTime(recordingTime)}
          </div>

          {/* Audio Levels */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '12px'
          }}>
            {/* Microphone Level */}
            {micStream && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ 
                  color: micLevel > 0.02 ? '#22c55e' : '#9ca3af',
                  minWidth: '24px'
                }}>
                  🎤
                </span>
                <div style={{
                  width: '60px',
                  height: '12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(micLevel * 100, 100)}%`,
                      background: micLevel > 0.7 ? 
                        'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)' :
                        micLevel > 0.3 ? 
                        'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
                        '#22c55e',
                      transition: 'width 0.1s ease-out',
                      borderRadius: '5px'
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
                gap: '6px'
              }}>
                <span style={{ 
                  color: speakerLevel > 0.02 ? '#22c55e' : '#9ca3af',
                  minWidth: '24px'
                }}>
                  🔊
                </span>
                <div style={{
                  width: '60px',
                  height: '12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(speakerLevel * 100, 100)}%`,
                      background: speakerLevel > 0.7 ? 
                        'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)' :
                        speakerLevel > 0.3 ? 
                        'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
                        '#22c55e',
                      transition: 'width 0.1s ease-out',
                      borderRadius: '5px'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stop Button */}
          <button 
            onClick={onStop}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444'
            }}
          >
            ⏹️ Stop Recording
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
}

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
`
