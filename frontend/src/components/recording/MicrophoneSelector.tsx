import React, { useState, useEffect, useRef } from 'react'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

interface MicrophoneSelectorProps {
  selectedMicId: string
  onMicChange: (deviceId: string) => void
  showUsageLevels?: boolean
}

export default function MicrophoneSelector({
  selectedMicId,
  onMicChange,
  showUsageLevels = false
}: MicrophoneSelectorProps) {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
  const [micUsageLevels, setMicUsageLevels] = useState<Record<string, number>>({})
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  
  const monitorContextsRef = useRef<Record<string, AudioContext>>({})
  const monitorAnalysersRef = useRef<Record<string, AnalyserNode>>({})
  const monitorStreamsRef = useRef<Record<string, MediaStream>>({})
  const monitorAnimationRef = useRef<number | null>(null)

  // Load devices on mount and when devices change
  useEffect(() => {
    loadDevices()
    navigator.mediaDevices.addEventListener('devicechange', loadDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
      stopUsageMonitoring()
    }
  }, [])

  // Start/stop monitoring when showUsageLevels changes
  useEffect(() => {
    if (showUsageLevels && inputDevices.length > 0) {
      startUsageMonitoring()
    } else {
      stopUsageMonitoring()
    }
  }, [showUsageLevels, inputDevices])

  // Force stop monitoring when component unmounts or showUsageLevels becomes false
  useEffect(() => {
    return () => {
      console.log('🧹 MicrophoneSelector: Component unmounting, forcing cleanup...')
      stopUsageMonitoring()
    }
  }, [])

  const loadDevices = async () => {
    try {
      setIsLoadingDevices(true)
      console.log('🔍 Testing microphone devices for availability...')
      
      // Request permission first to get proper device labels
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop())
      })

      const devices = await navigator.mediaDevices.enumerateDevices()
      
      // Filter and clean input devices
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .filter(device => !device.label.toLowerCase().startsWith('communications'))
      
      // Test each device to see if it's active/working
      const workingDevices: AudioDevice[] = []
      for (const device of audioInputs) {
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: device.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          })
          
          // Check if the stream has active audio tracks
          const audioTracks = testStream.getAudioTracks()
          if (audioTracks.length > 0 && audioTracks[0].enabled && audioTracks[0].readyState === 'live') {
            workingDevices.push({
              deviceId: device.deviceId,
              label: device.label,
              kind: device.kind as 'audioinput'
            })
          }
          
          // Clean up test stream
          testStream.getTracks().forEach(track => track.stop())
        } catch (err) {
          console.warn(`Device ${device.label} not accessible:`, err)
        }
      }

      // Deduplicate by label + deviceId, preferring non-default names
      const deviceMap = new Map<string, AudioDevice>()
      for (const device of workingDevices) {
        const baseLabel = device.label.replace(/^default\s*-\s*/i, '').trim()
        const key = baseLabel.toLowerCase()
        
        // Prefer non-default names (e.g., "AirPods" over "Default - AirPods")
        if (!deviceMap.has(key) || device.label.toLowerCase().startsWith('default')) {
          if (!deviceMap.has(key) || !device.label.toLowerCase().startsWith('default')) {
            deviceMap.set(key, device)
          }
        }
      }
      
      const cleanInputs = Array.from(deviceMap.values())

      // Sort devices: AirPods first, then others alphabetically
      cleanInputs.sort((a, b) => {
        // Prioritize AirPods
        const aIsAirPods = /airpods?/i.test(a.label)
        const bIsAirPods = /airpods?/i.test(b.label)
        if (aIsAirPods && !bIsAirPods) return -1
        if (!aIsAirPods && bIsAirPods) return 1
        
        // Then sort alphabetically
        return a.label.localeCompare(b.label)
      })

      setInputDevices(cleanInputs)

      // Auto-select best microphone if none selected
      if (!selectedMicId && cleanInputs.length > 0) {
        // Prefer AirPods, then first working device
        const airpodsMic = cleanInputs.find(d => /airpods?/i.test(d.label))
        const selectedMic = airpodsMic || cleanInputs[0]
        onMicChange(selectedMic.deviceId)
        console.log('🎤 Auto-selected microphone:', selectedMic.label)
      }

      console.log('📱 Microphones loaded:', {
        inputs: cleanInputs.length,
        workingMics: cleanInputs.map(d => d.label)
      })

    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setIsLoadingDevices(false)
    }
  }

  const startUsageMonitoring = async () => {
    if (isMonitoring) return
    setIsMonitoring(true)

    try {
      // Stop any existing monitoring
      stopUsageMonitoring()

      // Monitor each microphone
      for (const device of inputDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: device.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          })

          const audioContext = new AudioContext()
          const analyser = audioContext.createAnalyser()
          const source = audioContext.createMediaStreamSource(stream)

          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.3
          analyser.minDecibels = -90
          analyser.maxDecibels = -10

          source.connect(analyser)

          monitorContextsRef.current[device.deviceId] = audioContext
          monitorAnalysersRef.current[device.deviceId] = analyser
          monitorStreamsRef.current[device.deviceId] = stream

        } catch (err) {
          console.warn(`Failed to monitor device ${device.label}:`, err)
        }
      }

      updateUsageLevels()
    } catch (error) {
      console.error('Failed to start usage monitoring:', error)
      setIsMonitoring(false)
    }
  }

  const stopUsageMonitoring = () => {
    console.log('🛑 MicrophoneSelector: Stopping usage monitoring...')
    setIsMonitoring(false)

    if (monitorAnimationRef.current) {
      cancelAnimationFrame(monitorAnimationRef.current)
      monitorAnimationRef.current = null
      console.log('🧹 MicrophoneSelector: Cancelled animation frame')
    }

    // Stop all monitoring streams first (most important for mic release)
    Object.entries(monitorStreamsRef.current).forEach(([deviceId, stream]) => {
      try { 
        console.log(`🎤 MicrophoneSelector: Stopping monitoring stream for device ${deviceId}`)
        stream.getTracks().forEach((track, index) => {
          console.log(`🎤 MicrophoneSelector: Stopping track ${index} (${track.kind}) for device ${deviceId}`)
          track.stop()
        })
      } catch (e) { 
        console.warn(`⚠️ MicrophoneSelector: Failed to stop stream for device ${deviceId}:`, e)
      }
    })

    // Close audio contexts
    Object.entries(monitorContextsRef.current).forEach(([deviceId, context]) => {
      try { 
        console.log(`🔊 MicrophoneSelector: Closing audio context for device ${deviceId}`)
        context.close() 
      } catch (e) { 
        console.warn(`⚠️ MicrophoneSelector: Failed to close context for device ${deviceId}:`, e)
      }
    })

    monitorContextsRef.current = {}
    monitorAnalysersRef.current = {}
    monitorStreamsRef.current = {}
    setMicUsageLevels({})
    
    console.log('✅ MicrophoneSelector: Usage monitoring stopped, all streams should be released')
  }

  const updateUsageLevels = () => {
    const newLevels: Record<string, number> = {}

    Object.entries(monitorAnalysersRef.current).forEach(([deviceId, analyser]) => {
      try {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)

        const sum = dataArray.reduce((acc, value) => acc + value * value, 0)
        const rms = Math.sqrt(sum / dataArray.length)
        newLevels[deviceId] = rms / 255
      } catch (err) {
        newLevels[deviceId] = 0
      }
    })

    setMicUsageLevels(newLevels)

    if (isMonitoring) {
      monitorAnimationRef.current = requestAnimationFrame(updateUsageLevels)
    }
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <label style={{ fontWeight: '500', color: '#374151' }}>
          🎤 Microphone:
        </label>
        <button
          onClick={loadDevices}
          disabled={isLoadingDevices}
          style={{
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            cursor: isLoadingDevices ? 'not-allowed' : 'pointer',
            color: isLoadingDevices ? '#9ca3af' : '#6b7280',
            opacity: isLoadingDevices ? 0.6 : 1
          }}
          title={isLoadingDevices ? "Testing microphones..." : "Refresh device list"}
        >
          {isLoadingDevices ? '⏳ Testing...' : '🔄 Refresh'}
        </button>
      </div>

      <select
        value={selectedMicId}
        onChange={(e) => onMicChange(e.target.value)}
        disabled={isLoadingDevices}
        style={{
          width: '100%',
          padding: '12px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: isLoadingDevices ? '#f9fafb' : '#ffffff',
          color: '#374151',
          cursor: isLoadingDevices ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          opacity: isLoadingDevices ? 0.6 : 1
        }}
        onFocus={(e) => {
          if (!isLoadingDevices) {
            e.target.style.borderColor = '#3b82f6'
            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#d1d5db'
          e.target.style.boxShadow = 'none'
        }}
      >
        <option value="" disabled>
          {isLoadingDevices ? 'Testing microphones...' : 'Select a microphone...'}
        </option>
        {inputDevices.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>

      {/* Device Status Indicator */}
      {(isLoadingDevices || inputDevices.length > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: isLoadingDevices ? '#fef3c7' : '#ecfdf5',
          border: `1px solid ${isLoadingDevices ? '#f59e0b' : '#10b981'}`,
          borderRadius: '6px',
          fontSize: '12px',
          marginTop: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: isLoadingDevices ? '#92400e' : '#047857'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isLoadingDevices ? '#f59e0b' : '#10b981',
              animation: isLoadingDevices ? 'pulse 2s infinite' : 'none'
            }} />
            {isLoadingDevices 
              ? 'Testing microphone availability...'
              : `${inputDevices.length} active microphone${inputDevices.length !== 1 ? 's' : ''} detected`
            }
          </div>
          {!isLoadingDevices && inputDevices.length > 0 && (
            <div style={{
              fontSize: '10px',
              color: '#047857',
              fontWeight: '500'
            }}>
              Only working devices shown
            </div>
          )}
        </div>
      )}

      {showUsageLevels && isMonitoring && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#0369a1',
          marginTop: '8px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            animation: 'pulse 2s infinite'
          }} />
          Monitoring microphone activity levels
        </div>
      )}
    </div>
  )
}
