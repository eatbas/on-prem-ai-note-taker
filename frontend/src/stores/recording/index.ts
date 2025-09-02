/**
 * Recording Manager - Main Export
 * Provides a clean interface to the recording system
 */

export { GlobalRecordingManager } from './manager'
export type { 
	GlobalRecordingState, 
	RecordingOptions, 
	StartRecordingResult, 
	InterruptedRecordingInfo,
	StateListener 
} from './types'

// Export singleton instance
import { GlobalRecordingManager } from './manager'
export const globalRecordingManager = new GlobalRecordingManager()
