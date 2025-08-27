import React from 'react'
import MicrophoneSelector from './MicrophoneSelector'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

interface DeviceSelectorProps {
  selectedMicId: string
  onMicChange: (deviceId: string) => void
  showUsageLevels?: boolean
}

export default function DeviceSelector({
  selectedMicId,
  onMicChange,
  showUsageLevels = false
}: DeviceSelectorProps) {
  return (
    <div>
      <MicrophoneSelector
        selectedMicId={selectedMicId}
        onMicChange={onMicChange}
        showUsageLevels={showUsageLevels}
      />
    </div>
  )
}


