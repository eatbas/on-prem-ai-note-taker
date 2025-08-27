import React from 'react'
import MicrophoneSelector from './MicrophoneSelector'
import SpeakerSelector from './SpeakerSelector'

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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <MicrophoneSelector
        selectedMicId={selectedMicId}
        onMicChange={onMicChange}
        showUsageLevels={showUsageLevels}
      />
      
      <SpeakerSelector
        selectedSpeakerId={selectedSpeakerId}
        onSpeakerChange={onSpeakerChange}
      />
    </div>
  )
}


