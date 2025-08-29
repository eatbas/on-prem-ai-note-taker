/**
 * API Services Index
 * Centralized exports for all API functionality
 */

// Core utilities
export * from './core'

// Feature modules
export * from './transcription'
export * from './summarization'
export * from './chat'
export * from './meetings'
export * from './jobs'
export * from './queue'
export * from './tags'
export * from './diagnostics'
export * from './workspaces'

// Legacy compatibility - maintain existing import paths
export { transcribe, transcribeAndSummarize, submitTranscribeAndSummarizeJob, submitQueueTranscription } from './transcription'
export { summarize, submitQueueSummarization } from './summarization'
export { chat } from './chat'
export { 
  getMeetings, 
  getVpsMeetings, 
  getMeeting, 
  updateMeeting, 
  deleteMeeting,
  startMeeting,
  uploadMeetingAudio,
  autoProcessMeeting,
  autoProcessDualMeeting,
  getMeetingSpeakers,
  updateSpeakerName
} from './meetings'
export { getJobStatus, cancelJob, createJobProgressStream } from './jobs'
export { getQueueStats, getQueueTaskStatus, getQueueTaskResult, getProgressStats } from './queue'
export { getTags, updateMeetingTags } from './tags'
export { getVpsHealth, runVpsDiagnostics, quickVpsTest } from './diagnostics'
export { 
  createWorkspace,
  getWorkspaces,
  getWorkspacesDropdown,
  getWorkspace,
  updateWorkspace,
  deactivateWorkspace,
  getWorkspaceStats,
  assignUserToWorkspace,
  removeUserFromWorkspace
} from './workspaces'

// Re-export types
export type { JobStatus } from './jobs'
export type { QueueStats, ProgressStats } from './queue'
export type { Tag } from './tags'
export type { VpsDiagnosticResult } from './diagnostics'
