/**
 * Services Index
 * Centralized exports for all application services
 */

// API Services
export * from './api'
export { createJobProgressStream } from './api'

// Database Services
export * from './db'

// Offline Services
export {
  generateId,
  createMeeting,
  addChunk,
  deleteMeetingLocally,
  deleteAudioChunksLocally,
  assembleFileFromChunks,
  assembleFilesByAudioType,
  autoProcessMeetingRecording,
  autoProcessMeetingRecordingWithWhisperOptimization,
  listMeetings,
  syncMeeting,
  syncAllQueued,
  watchOnline,
  updateMeetingTags as updateMeetingTagsOffline
} from './offline'

// Background Processing Services
export * from './backgroundProcessor'

// Legacy Types (to be moved to lib/types.ts)
export interface JobStatusResponse {
  status: string
  progress?: number
  message?: string
}

export interface GlobalRecordingState {
  isRecording: boolean
  meetingId: string | null
  recordingTime: number
}
