// Export all from api except conflicting ones
export * from './api'
// Export all from db
export * from './db'
// Export specific items from offline to avoid conflicts
export {
  generateId,
  createMeeting,
  addChunk,
  deleteMeetingLocally,
  deleteAudioChunksLocally,
  assembleFileFromChunks,
  autoProcessMeetingRecording,
  listMeetings,
  syncMeeting,
  syncAllQueued,
  watchOnline,
  updateMeetingTags as updateMeetingTagsOffline
} from './offline'

// Export missing types
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
