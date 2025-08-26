/**
 * Centralized environment loader for frontend
 * Loads variables from root .env file via Vite's env handling
 */

// Load environment variables with centralized naming
export const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://95.111.244.159:8000/api',
  
  // Authentication (loaded from environment - no hardcoded fallbacks for security)
  basicAuthUsername: import.meta.env.VITE_BASIC_AUTH_USERNAME,
  basicAuthPassword: import.meta.env.VITE_BASIC_AUTH_PASSWORD,
  
  // Feature Flags
  enableProgressTracking: import.meta.env.VITE_ENABLE_PROGRESS_TRACKING === 'true',
  enableSSE: import.meta.env.VITE_ENABLE_SSE === 'true',
  enableJobManagement: import.meta.env.VITE_ENABLE_JOB_MANAGEMENT === 'true',
  enableSpeakerIdentification: import.meta.env.VITE_ENABLE_SPEAKER_IDENTIFICATION === 'true',
  enableSpeakerTracking: import.meta.env.VITE_ENABLE_SPEAKER_TRACKING === 'true',
  
  // Audio Configuration
  audioChunkMs: parseInt(import.meta.env.VITE_AUDIO_CHUNK_MS || '45000'),
  maxFileSizeMB: parseInt(import.meta.env.VITE_MAX_FILE_SIZE_MB || '200'),
  
  // Language Configuration
  defaultLanguage: import.meta.env.VITE_DEFAULT_LANGUAGE || 'auto',
  supportedLanguages: (import.meta.env.VITE_SUPPORTED_LANGUAGES || 'tr,en,auto').split(','),
  
  // UI Configuration
  showLanguageSelector: import.meta.env.VITE_SHOW_LANGUAGE_SELECTOR === 'true',
  showProgressBars: import.meta.env.VITE_SHOW_PROGRESS_BARS === 'true',
  showETA: import.meta.env.VITE_SHOW_ETA === 'true',
  
  // Development
  devMode: import.meta.env.VITE_DEV_MODE === 'true',
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  
  // App Information
  appTitle: import.meta.env.VITE_APP_TITLE || 'AI Note Taker',
  appDescription: import.meta.env.VITE_APP_DESCRIPTION || 'AI-powered note taking with transcription and summarization',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // Models
  ollamaModel: import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:3b-instruct',
  whisperModel: import.meta.env.VITE_WHISPER_MODEL || 'large-v3',
  
  // Performance
  progressUpdateInterval: parseInt(import.meta.env.VITE_PROGRESS_UPDATE_INTERVAL || '500'),
  sseTimeout: parseInt(import.meta.env.VITE_SSE_TIMEOUT || '30000'),
}

// Log configuration in development mode
if (config.devMode) {
  console.log('📋 Frontend configuration loaded:', config)
}

export default config
