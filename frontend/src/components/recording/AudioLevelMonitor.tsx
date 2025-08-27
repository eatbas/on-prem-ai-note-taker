import React, { useEffect, useRef, useState } from 'react'

interface AudioLevelMonitorProps {
  micStream: MediaStream | null
  speakerStream: MediaStream | null
  size?: 'small' | 'medium' | 'large'
}

export default function AudioLevelMonitor({ 
  micStream, 
  speakerStream, 
  size = 'medium' 
}: AudioLevelMonitorProps) {
  const [micLevel, setMicLevel] = useState(0)
  const [speakerLevel, setSpeakerLevel] = useState(0)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Setup audio monitoring when streams change
  useEffect(() => {
    if (micStream || speakerStream) {
      setupAudioMonitoring()
    } else {
      cleanup()
    }

    return cleanup
  }, [micStream, speakerStream])

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
      console.log('🎵 Audio monitoring initialized successfully')
    } catch (error) {
      console.warn('Audio monitoring setup failed (this is normal if no audio devices):', error instanceof Error ? error.message : String(error))
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

    animationFrameRef.current = requestAnimationFrame(updateAudioLevels)
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

  // Size configurations
  const sizeConfig = {
    small: { width: 120, height: 20, fontSize: '12px' },
    medium: { width: 180, height: 28, fontSize: '14px' },
    large: { width: 240, height: 36, fontSize: '16px' }
  }

  const config = sizeConfig[size]

  if (!micStream && !speakerStream) {
    return null
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      minWidth: config.width + 60
    }}>
      <h4 style={{
        margin: 0,
        fontSize: config.fontSize,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center'
      }}>
        🎵 Audio Levels
      </h4>

      {/* Microphone Level */}
      {micStream && (
        <AudioLevelBar
          label="🎤 Microphone"
          level={micLevel}
          width={config.width}
          height={config.height}
          fontSize={config.fontSize}
        />
      )}

      {/* Speaker Level */}
      {speakerStream && (
        <AudioLevelBar
          label="🔊 System Audio"
          level={speakerLevel}
          width={config.width}
          height={config.height}
          fontSize={config.fontSize}
        />
      )}

      {/* Status Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '11px',
        color: '#6b7280'
      }}>
        {micStream && (
          <span style={{ color: micLevel > 0.02 ? '#22c55e' : '#9ca3af' }}>
            MIC: {micLevel > 0.02 ? 'ACTIVE' : 'SILENT'}
          </span>
        )}
        {speakerStream && (
          <span style={{ color: speakerLevel > 0.02 ? '#22c55e' : '#9ca3af' }}>
            SYS: {speakerLevel > 0.02 ? 'ACTIVE' : 'SILENT'}
          </span>
        )}
      </div>
    </div>
  )
}

// Individual audio level bar component
interface AudioLevelBarProps {
  label: string
  level: number
  width: number
  height: number
  fontSize: string
}

function AudioLevelBar({ label, level, width, height, fontSize }: AudioLevelBarProps) {
  const isActive = level > 0.02

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        fontSize,
        fontWeight: '500',
        color: isActive ? '#22c55e' : '#9ca3af',
        minWidth: '120px'
      }}>
        {label}
      </div>

      <div style={{
        width,
        height,
        backgroundColor: '#f3f4f6',
        borderRadius: height / 2,
        border: '1px solid #e5e7eb',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background segments */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${i * 10}%`,
              top: 0,
              width: '8%',
              height: '100%',
              borderRight: i < 9 ? '1px solid #e5e7eb' : 'none'
            }}
          />
        ))}

        {/* Active level indicator */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${Math.min(level * 100, 100)}%`,
            background: level > 0.8 ? 
              'linear-gradient(90deg, #22c55e 0%, #f59e0b 60%, #ef4444 100%)' :
              level > 0.5 ? 
              'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
              level > 0.2 ?
              'linear-gradient(90deg, #22c55e 0%, #84cc16 100%)' :
              '#22c55e',
            transition: 'width 0.1s ease-out',
            borderRadius: height / 2
          }}
        />

        {/* Peak indicator */}
        {level > 0.02 && (
          <div
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              color: level > 0.5 ? '#ffffff' : '#374151',
              fontWeight: 'bold',
              textShadow: level > 0.5 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
            }}
          >
            {Math.round(level * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}
