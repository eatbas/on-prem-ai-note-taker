/**
 * Main Application Exports
 * Centralized exports for the entire frontend application
 */

// Core Application
export { default as App } from './App'

// Feature Modules
export * as Features from './features'

// Shared Library
export * as Lib from './lib'

// Services
export * as Services from './services'

// State Management
export * as Stores from './stores'

// Hooks
export * as Hooks from './hooks'

// Legacy Utils (deprecated - use Lib.* instead)
export * as Utils from './utils'

// Pages (direct exports for convenience)
export { default as Dashboard } from './pages/Dashboard'
export { default as MeetingView } from './pages/MeetingView'
export { default as AdminDashboard } from './pages/AdminDashboard'
export { default as AskLlama } from './pages/AskLlama'

// Most commonly used exports for convenience
export { useAudioRecorder, useDebounce, usePageVisibility } from './hooks'
export { generateId, createMeeting, addChunk } from './services'
export { globalRecordingManager } from './stores'

// Types (most commonly used)
export type {
  Meeting,
  AudioDevice,
  RecordingConfig,
  Job,
  ToastMessage
} from './lib/types'
