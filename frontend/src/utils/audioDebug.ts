/**
 * Audio Debug - Legacy Compatibility Export
 * 
 * This file maintains backward compatibility while providing
 * access to the new modular debug structure.
 */

// Export everything from the modular debug system
export * from './debug'

// Maintain legacy default export
export { AudioDebugger as default } from './debug'

// Legacy named exports for backward compatibility
export { AudioDebugger } from './debug'
export { DebugLogger } from './debug'
export { MicrophoneTests } from './debug'
export { RecordingTests } from './debug'
export { StorageTests } from './debug'

// This ensures existing imports like:
// import { AudioDebugger } from '../utils/audioDebug'
// continue to work without changes
