// Re-export specific types that might be missing
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

// Timer types - handle both browser and Node.js
export type TimerId = ReturnType<typeof setTimeout>
export type TimerIdNode = ReturnType<typeof setTimeout>

// Union type for cross-platform compatibility
export type CrossPlatformTimerId = number | TimerId

// Workspace types - re-export from workspace.ts
export * from './workspace'