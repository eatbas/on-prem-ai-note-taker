import React, { useState, useEffect } from 'react'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

interface SpeakerSelectorProps {
  selectedSpeakerId: string
  onSpeakerChange: (deviceId: string) => void
}

export default function SpeakerSelector({
  selectedSpeakerId,
  onSpeakerChange
}: SpeakerSelectorProps) {
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([])

  useEffect(() => {
    loadDevices()
    navigator.mediaDevices.addEventListener('devicechange', loadDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
    }
  }, [])

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      // Filter output devices
      const audioOutputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label,
          kind: device.kind as 'audiooutput'
        }))

      audioOutputs.sort((a, b) => {
        const aDef = /default/i.test(a.label) ? -1 : 0
        const bDef = /default/i.test(b.label) ? -1 : 0
        if (aDef !== bDef) return aDef - bDef
        return a.label.localeCompare(b.label)
      })

      setOutputDevices(audioOutputs)

      if (!selectedSpeakerId && audioOutputs.length > 0) {
        const defaultSpeaker = audioOutputs.find(d => /default/i.test(d.label)) || audioOutputs[0]
        onSpeakerChange(defaultSpeaker.deviceId)
      }

    } catch (error) {
      console.error('Failed to load speaker devices:', error)
    }
  }

  const selectedSpeaker = outputDevices.find(d => selectedSpeakerId === d.deviceId) || outputDevices[0]

  return (
    <div>
      <label style={{ 
        display: 'block',
        marginBottom: '12px',
        fontWeight: '500',
        color: '#374151'
      }}>
        🔊 Speaker Output:
      </label>

      <div style={{
        padding: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          fontSize: '16px',
          color: '#22c55e'
        }}>
          ✓
        </div>
        <div style={{
          fontSize: '14px',
          color: '#374151',
          flex: 1
        }}>
          {selectedSpeaker ? selectedSpeaker.label : 'Default Speaker'}
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Default
        </div>
      </div>
    </div>
  )
}
