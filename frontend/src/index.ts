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

// Pages are now organized under Features
// Use Features.Meetings.Dashboard, Features.Admin.AdminDashboard, etc.

// Most commonly used exports for convenience
export { useDebounce, usePageVisibility } from './hooks'
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
