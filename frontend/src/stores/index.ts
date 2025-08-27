/**
 * Stores Index
 * Centralized exports for all application state management
 */

// Note: Some stores are imported dynamically in services to avoid circular dependencies
// Import them directly from their individual files when needed statically.

// State Managers
export { globalRecordingManager } from './globalRecordingManager'
export { jobQueueManager } from './jobQueueManager'

// API Managers
export { apiStateManager } from './apiStateManager'
export { electronApiOptimizer } from './electronApiOptimizer'

// Re-export types
export type { GlobalRecordingState } from './globalRecordingManager'
