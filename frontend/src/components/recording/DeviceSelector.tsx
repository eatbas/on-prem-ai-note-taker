import React, { useState, useEffect, useRef } from 'react'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

interface DeviceSelectorProps {
  selectedMicId: string
  selectedSpeakerId: string
  onMicChange: (deviceId: string) => void
  onSpeakerChange: (deviceId: string) => void
  showUsageLevels?: boolean
}

export default function DeviceSelector({
  selectedMicId,
  selectedSpeakerId,
  onMicChange,
  onSpeakerChange,
  showUsageLevels = false
}: DeviceSelectorProps) {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([])
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])
  const [micUsageLevels, setMicUsageLevels] = useState<Record<string, number>>({})
  const [isMonitoring, setIsMonitoring] = useState(false)
  
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

  const loadDevices = async () => {
    try {
      // Request permission first to get proper device labels
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop())
      })

      const devices = await navigator.mediaDevices.enumerateDevices()
      
      // Filter and clean input devices
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .filter(device => !device.label.toLowerCase().startsWith('communications'))
      
      // Deduplicate by label + groupId
      const cleanInputs = Array.from(
        new Map(audioInputs.map(device => [
          `${device.label}|${device.groupId || ''}`, 
          { deviceId: device.deviceId, label: device.label, kind: device.kind as 'audioinput' }
        ])).values()
      )

      // Filter output devices
      const audioOutputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label,
          kind: device.kind as 'audiooutput'
        }))

      // Sort devices: default first, then alphabetically
      cleanInputs.sort((a, b) => {
        const aDef = /default/i.test(a.label) ? -1 : 0
        const bDef = /default/i.test(b.label) ? -1 : 0
        if (aDef !== bDef) return aDef - bDef
        return a.label.localeCompare(b.label)
      })

      audioOutputs.sort((a, b) => {
        const aDef = /default/i.test(a.label) ? -1 : 0
        const bDef = /default/i.test(b.label) ? -1 : 0
        if (aDef !== bDef) return aDef - bDef
        return a.label.localeCompare(b.label)
      })

      setInputDevices(cleanInputs)
      setOutputDevices(audioOutputs)

      // Auto-select default devices if none selected
      if (!selectedMicId && cleanInputs.length > 0) {
        const defaultMic = cleanInputs.find(d => /default/i.test(d.label)) || cleanInputs[0]
        onMicChange(defaultMic.deviceId)
      }

      if (!selectedSpeakerId && audioOutputs.length > 0) {
        const defaultSpeaker = audioOutputs.find(d => /default/i.test(d.label)) || audioOutputs[0]
        onSpeakerChange(defaultSpeaker.deviceId)
      }

      console.log('📱 Devices loaded:', {
        inputs: cleanInputs.length,
        outputs: audioOutputs.length
      })

    } catch (error) {
      console.error('Failed to load devices:', error)
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
    setIsMonitoring(false)

    if (monitorAnimationRef.current) {
      cancelAnimationFrame(monitorAnimationRef.current)
      monitorAnimationRef.current = null
    }

    Object.values(monitorContextsRef.current).forEach(context => {
      try { context.close() } catch (e) { /* ignore */ }
    })

    Object.values(monitorStreamsRef.current).forEach(stream => {
      try { stream.getTracks().forEach(track => track.stop()) } catch (e) { /* ignore */ }
    })

    monitorContextsRef.current = {}
    monitorAnalysersRef.current = {}
    monitorStreamsRef.current = {}
    setMicUsageLevels({})
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Microphone Selection */}
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
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
            title="Refresh device list"
          >
            🔄 Refresh
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {inputDevices.map(device => (
            <DeviceOption
              key={device.deviceId}
              device={device}
              selected={selectedMicId === device.deviceId}
              onClick={() => onMicChange(device.deviceId)}
              usageLevel={showUsageLevels ? micUsageLevels[device.deviceId] : undefined}
            />
          ))}
        </div>

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

      {/* Speaker/Output Selection */}
      <div>
        <label style={{ 
          display: 'block',
          marginBottom: '12px',
          fontWeight: '500',
          color: '#374151'
        }}>
          🔊 Speaker Output:
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {outputDevices.map(device => (
            <DeviceOption
              key={device.deviceId}
              device={device}
              selected={selectedSpeakerId === device.deviceId}
              onClick={() => onSpeakerChange(device.deviceId)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Individual device option component
interface DeviceOptionProps {
  device: AudioDevice
  selected: boolean
  onClick: () => void
  usageLevel?: number
}

function DeviceOption({ device, selected, onClick, usageLevel }: DeviceOptionProps) {
  const isActive = usageLevel !== undefined && usageLevel > 0.02

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        border: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: selected ? '#eff6ff' : '#ffffff',
        transition: 'all 0.2s ease',
        gap: '12px'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: 1
      }}>
        <div style={{
          fontSize: '16px',
          color: selected ? '#3b82f6' : '#6b7280'
        }}>
          {selected ? '●' : '○'}
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: selected ? '600' : '400',
          color: selected ? '#1e293b' : '#374151',
          flex: 1
        }}>
          {device.label}
        </div>
      </div>

      {usageLevel !== undefined && (
        <div style={{ minWidth: '80px' }}>
          <UsageLevelIndicator level={usageLevel} />
        </div>
      )}
    </div>
  )
}

// Usage level indicator component
interface UsageLevelIndicatorProps {
  level: number
}

function UsageLevelIndicator({ level }: UsageLevelIndicatorProps) {
  const isActive = level > 0.02

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px'
    }}>
      <div style={{ 
        fontSize: '12px',
        color: isActive ? '#22c55e' : '#9ca3af'
      }}>
        {isActive ? '🎤' : '🔇'}
      </div>
      <div style={{
        width: '60px',
        height: '16px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        border: '1px solid #e5e7eb',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background segments */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${i * 20}%`,
              top: 0,
              width: '18%',
              height: '100%',
              borderRight: i < 4 ? '1px solid #e5e7eb' : 'none'
            }}
          />
        ))}
        
        {/* Active level */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${Math.min(level * 100, 100)}%`,
            background: level > 0.7 ? 
              'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)' :
              level > 0.3 ? 
              'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
              '#22c55e',
            transition: 'width 0.1s ease-out',
            borderRadius: '3px'
          }}
        />
      </div>
    </div>
  )
}
