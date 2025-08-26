/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_BASIC_AUTH_USERNAME: string
  readonly VITE_BASIC_AUTH_PASSWORD: string
  readonly VITE_DEBUG: string
  readonly VITE_ENABLE_PROGRESS_TRACKING: string
  readonly VITE_ENABLE_SSE: string
  readonly VITE_ENABLE_JOB_MANAGEMENT: string
  readonly VITE_ENABLE_SPEAKER_IDENTIFICATION: string
  readonly VITE_ENABLE_SPEAKER_TRACKING: string
  readonly VITE_AUDIO_CHUNK_MS: string
  readonly VITE_MAX_FILE_SIZE_MB: string
  readonly VITE_DEFAULT_LANGUAGE: string
  readonly VITE_SUPPORTED_LANGUAGES: string
  readonly VITE_SHOW_LANGUAGE_SELECTOR: string
  readonly VITE_SHOW_PROGRESS_BARS: string
  readonly VITE_SHOW_ETA: string
  readonly VITE_DEV_MODE: string
  readonly VITE_LOG_LEVEL: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_DESCRIPTION: string
  readonly VITE_OLLAMA_MODEL: string
  readonly VITE_WHISPER_MODEL: string
  readonly VITE_PROGRESS_UPDATE_INTERVAL: string
  readonly VITE_SSE_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
