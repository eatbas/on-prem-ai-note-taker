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
  speakerDeviceId?: string // Optional - system audio is captured automatically
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
  status: 'local' | 'queued' | 'uploading' | 'processing' | 'synced'
  tags: string[]
  summary?: string
  transcript?: string
  workspace_id?: number
  is_personal: boolean
  vps_id?: string
  last_sync_attempt?: number
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
  confidence?: number
  speaker_confidence?: number
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

// 🚨 NEW: Speaker Intelligence Types for JSON Schema Support
export interface Speaker {
  speaker_id: string
  display_name: string
  custom_name?: string
  talking_time_percentage: number
  key_contributions: string[]
  communication_style: 'assertive' | 'collaborative' | 'analytical' | 'supportive' | 'questioning'
  engagement_level: 'high' | 'medium' | 'low'
  speaker_color?: string
}

export interface ConversationFlow {
  speaker: string
  contribution: string
  contribution_type: 'introduced' | 'agreed' | 'disagreed' | 'questioned' | 'clarified' | 'proposed'
}

export interface DiscussionPoint {
  topic: string
  conversation_flow: ConversationFlow[]
  consensus_reached: boolean
}

export interface Decision {
  decision: string
  proposed_by: string
  supported_by: string[]
  opposed_by: string[]
  final_agreement: string
  impact_level: 'high' | 'medium' | 'low'
}

export interface ActionItem {
  task: string
  assigned_to: string
  mentioned_by?: string
  due_date?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  context?: string
}

export interface SpeakerInsights {
  conversation_dynamics: {
    total_speaker_transitions: number
    average_speaking_duration: number
    interruptions_count: number
    collaboration_score: number
  }
  leadership_patterns: {
    speaker: string
    leadership_style: 'directive' | 'facilitative' | 'participative' | 'delegative'
    influence_level: 'high' | 'medium' | 'low'
  }[]
}

export interface MeetingEffectiveness {
  goal_achievement: 'fully_achieved' | 'partially_achieved' | 'not_achieved'
  time_management: 'efficient' | 'adequate' | 'poor'
  participation_quality: 'excellent' | 'good' | 'fair' | 'poor'
  decision_clarity: 'very_clear' | 'clear' | 'somewhat_clear' | 'unclear'
}

export interface OpenQuestion {
  question: string
  raised_by: string
  requires_follow_up: boolean
}

export interface NextStep {
  step: string
  owner?: string
  timeline?: string
}

export interface SpeakerParticipation {
  total_speakers: number
  dominant_speaker?: string
  participation_balance: 'balanced' | 'dominated' | 'mixed'
  engagement_level: 'high' | 'medium' | 'low'
}

// 🚨 NEW: JSON Schema Speaker-Enhanced Summary Structure
export interface SpeakerEnhancedSummary {
  meeting_overview: string
  speaker_participation: SpeakerParticipation
  speakers: Speaker[]
  key_discussion_points: DiscussionPoint[]
  decisions_made: Decision[]
  action_items: ActionItem[]
  speaker_insights?: SpeakerInsights
  next_steps: NextStep[]
  open_questions: OpenQuestion[]
  meeting_effectiveness?: MeetingEffectiveness
  
  // Meta information
  summary_type: 'speaker_enhanced_json' | 'speaker_enhanced_legacy' | 'standard'
  schema_validated?: boolean
}
