/**
 * Audio Debug Module Exports
 * Modular audio debugging utilities
 */

// Main debugger class
export { AudioDebugger } from './AudioDebugger'

// Individual test modules
export { MicrophoneTests } from './microphoneTests'
export { RecordingTests } from './recordingTests'
export { StorageTests } from './storageTests'

// Utilities
export { DebugLogger } from './logger'

// Types
export type {
    DebugResult,
    ComprehensiveResults,
    AudioDeviceInfo,
    RecordingTestResult,
    ElectronAudioSource
} from './types'

// Legacy export for backward compatibility
export { AudioDebugger as default } from './AudioDebugger'
