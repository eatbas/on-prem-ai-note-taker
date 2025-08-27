/**
 * Shared Type Definitions
 * Centralized type definitions used across the application
 */

// Base Types
export type ID = string
export type Timestamp = number
export type Language = 'tr' | 'en' | 'auto'

// Audio Types
export type AudioType = 'microphone' | 'system' | 'speaker' | 'mixed'
export type RecordingState = 'idle' | 'recording' | 'stopping' | 'processing'
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed'

// Device Types
export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export interface DevicePermissions {
  microphone: boolean
  camera: boolean
  screen: boolean
}

// Recording Types
export interface RecordingConfig {
  micDeviceId: string
  speakerDeviceId: string
  language: Language
  showFloatingWidget: boolean
}

export interface AudioRecorderState {
  isRecording: boolean
  micStream: MediaStream | null
  speakerStream: MediaStream | null
  micRecorder: MediaRecorder | null
  speakerRecorder: MediaRecorder | null
  error: string | null
}

export interface RecordingSession {
  meetingId: string
  startTime: Timestamp
  duration: number
  audioTypes: AudioType[]
  deviceInfo: {
    microphone?: AudioDevice
    speaker?: AudioDevice
  }
}

// Meeting Types
export interface Meeting {
  id: ID
  title: string
  createdAt: Timestamp
  updatedAt: Timestamp
  duration?: number
  language?: Language
  status: 'local' | 'uploaded' | 'processing' | 'complete'
  tags: string[]
  summary?: string
  transcript?: string
}

export interface MeetingMetadata {
  id: ID
  title: string
  duration: number
  createdAt: Timestamp
  participantCount?: number
  audioQuality?: 'low' | 'medium' | 'high'
  hasSystemAudio: boolean
}

// Chunk Types
export interface AudioChunk {
  id: ID
  meetingId: ID
  index: number
  blob: Blob
  audioType: AudioType
  createdAt: Timestamp
  size: number
}

export interface ChunkAnalysis {
  chunkCount: number
  totalSize: number
  chunks: AudioChunk[]
  isEmpty: boolean
}

// Job Types
export type JobType = 'transcribe' | 'summarize' | 'process' | 'upload'
export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled'

export interface Job {
  id: ID
  type: JobType
  status: JobStatus
  message: string
  progress: number
  createdAt: Timestamp
  startedAt?: Timestamp
  completedAt?: Timestamp
  error?: string
  canGoBack?: boolean
  metadata?: Record<string, any>
}

export interface JobProgress {
  jobId: ID
  progress: number
  message: string
  stage?: string
}

// API Types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TranscriptionResult {
  text: string
  language: string
  confidence: number
  segments?: TranscriptionSegment[]
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface SummaryResult {
  summary: string
  keyPoints: string[]
  actionItems?: string[]
  participants?: string[]
}

// UI Types
export interface ToastMessage {
  id: ID
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  disabled?: boolean
  helpText?: string
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type AsyncFunction<T extends any[], R> = (...args: T) => Promise<R>

// Event Types
export interface AppEvent {
  type: string
  payload?: any
  timestamp: Timestamp
}

export interface RecordingEvent extends AppEvent {
  type: 'recording:started' | 'recording:stopped' | 'recording:error'
  payload: {
    meetingId: ID
    duration?: number
    error?: string
  }
}

// State Types
export interface AppState {
  user: {
    id: ID
    preferences: UserPreferences
  }
  recording: {
    isRecording: boolean
    meetingId: ID | null
    duration: number
    error: string | null
  }
  jobs: {
    active: Job[]
    completed: Job[]
    error: string | null
  }
  ui: {
    modals: {
      recording: boolean
      settings: boolean
    }
    toasts: ToastMessage[]
    loading: boolean
  }
}

export interface UserPreferences {
  language: Language
  audioSettings: {
    micDeviceId?: string
    speakerDeviceId?: string
    showFloatingWidget: boolean
  }
  uiSettings: {
    theme: 'light' | 'dark' | 'auto'
    compactMode: boolean
  }
}

// Error Types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: Timestamp
}

export class RecordingError extends Error {
  code: string
  constructor(message: string, code: string = 'RECORDING_ERROR') {
    super(message)
    this.name = 'RecordingError'
    this.code = code
  }
}

export class APIError extends Error {
  status: number
  code: string
  
  constructor(message: string, status: number = 500, code: string = 'API_ERROR') {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.code = code
  }
}
