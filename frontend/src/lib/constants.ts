/**
 * Application Constants
 * Centralized configuration and constants
 */

// Recording Configuration
export const RECORDING_CONFIG = {
  CHUNK_DURATION_MS: 30000,
  SAMPLE_RATE: 44100,
  CHANNEL_COUNT: 2,
  MIME_TYPE: 'audio/webm;codecs=opus',
  BITS_PER_SECOND: 128000,
} as const

// Audio Monitoring
export const AUDIO_MONITOR_CONFIG = {
  FFT_SIZE: 256,
  SMOOTHING_TIME_CONSTANT: 0.3,
  MIN_DECIBELS: -90,
  MAX_DECIBELS: -10,
  ACTIVITY_THRESHOLD: 0.02,
} as const

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 200,
  MODAL_Z_INDEX: 1000,
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 300,
  MAX_FILE_LINES: 350,
} as const

// API Configuration
export const API_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  REQUEST_TIMEOUT: 30000,
} as const

// Meeting Configuration
export const MEETING_CONFIG = {
  DEFAULT_LANGUAGE: 'auto' as const,
  SUPPORTED_LANGUAGES: ['auto', 'tr', 'en'] as const,
  MAX_TITLE_LENGTH: 100,
} as const

// Job Queue Configuration
export const JOB_CONFIG = {
  POLL_INTERVAL: 1000,
  MAX_CONCURRENT_JOBS: 3,
  JOB_TIMEOUT: 300000, // 5 minutes
} as const

// Storage Keys
export const STORAGE_KEYS = {
  USER_ID: 'onprem_user_id',
  AUTH_TOKEN: 'onprem_auth_token',
  PREFERENCES: 'onprem_preferences',
  DEVICE_SETTINGS: 'onprem_device_settings',
} as const

// Error Messages
export const ERROR_MESSAGES = {
  MICROPHONE_ACCESS: 'Microphone access denied. Please check permissions.',
  MEDIA_NOT_SUPPORTED: 'Media recording not supported in this browser.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  PROCESSING_FAILED: 'Processing failed. Please try again.',
  INVALID_MEETING: 'Invalid meeting data.',
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  RECORDING_STARTED: 'Recording started successfully',
  RECORDING_STOPPED: 'Recording stopped and saved',
  MEETING_PROCESSED: 'Meeting processed successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
} as const
