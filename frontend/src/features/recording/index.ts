/**
 * Recording Feature Exports
 * All recording-related components, hooks, and utilities
 */

// Components
export { default as Recorder } from '../../components/recording/Recorder'
export { default as RecordingControls } from '../../components/recording/RecordingControls'
export { default as RecordingModal } from '../../components/recording/RecordingModal'
export { default as DeviceSelector } from '../../components/recording/DeviceSelector'
export { default as AudioLevelMonitor } from '../../components/recording/AudioLevelMonitor'
export { default as FloatingRecorder } from '../../components/recording/FloatingRecorder'

// Debug Components



// Hooks
export { useAudioRecorder } from '../../hooks/useAudioRecorder'

// Re-export types specific to recording
export type {
  AudioDevice,
  RecordingConfig,
  AudioRecorderState,
  RecordingSession,
  AudioType,
  RecordingState
} from '../../lib/types'
