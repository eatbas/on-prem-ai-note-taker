/**
 * Vite configuration that loads environment variables from root .env file
 */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env from root directory instead of frontend directory
  const projectRoot = path.resolve(__dirname)
  const env = loadEnv(mode, projectRoot, '')
  
  console.log('📋 Vite loading environment from:', projectRoot)
  console.log('🔧 Environment mode:', mode)
  
  // Create VITE_ prefixed environment variables from root env
  const viteEnv = {}
  Object.keys(env).forEach(key => {
    // Add VITE_ prefix to make variables available to frontend
    viteEnv[`VITE_${key}`] = env[key]
  })
  
  return {
    plugins: [react()],
    base: './', // Use relative paths for Electron
    server: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'frontend/dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        }
      }
    },
    // Pass environment variables to the frontend
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || `http://${env.VPS_HOST || '95.111.244.159'}:8000/api`),
      'import.meta.env.VITE_BASIC_AUTH_USERNAME': JSON.stringify(env.BASIC_AUTH_USERNAME),
      'import.meta.env.VITE_BASIC_AUTH_PASSWORD': JSON.stringify(env.BASIC_AUTH_PASSWORD),
      'import.meta.env.VITE_AUDIO_CHUNK_MS': JSON.stringify(env.CHUNK_DURATION_SECONDS ? env.CHUNK_DURATION_SECONDS * 1000 : '45000'),
      'import.meta.env.VITE_MAX_FILE_SIZE_MB': JSON.stringify(env.MAX_UPLOAD_MB || '200'),
      'import.meta.env.VITE_WHISPER_MODEL': JSON.stringify(env.WHISPER_MODEL || 'large-v3'),
      'import.meta.env.VITE_OLLAMA_MODEL': JSON.stringify(env.OLLAMA_MODEL || 'qwen2.5:3b-instruct'),
      'import.meta.env.VITE_ENABLE_SPEAKER_TRACKING': JSON.stringify(env.ENABLE_SPEAKER_IDENTIFICATION || 'true'),
      'import.meta.env.VITE_DEFAULT_LANGUAGE': JSON.stringify('auto'),
      'import.meta.env.VITE_SUPPORTED_LANGUAGES': JSON.stringify(env.ALLOWED_LANGUAGES || 'tr,en,auto'),
      'import.meta.env.VITE_SHOW_LANGUAGE_SELECTOR': JSON.stringify('true'),
      'import.meta.env.VITE_SHOW_PROGRESS_BARS': JSON.stringify('true'),
      'import.meta.env.VITE_SHOW_ETA': JSON.stringify('true'),
      'import.meta.env.VITE_DEV_MODE': JSON.stringify(mode === 'development' ? 'true' : 'false'),
      'import.meta.env.VITE_LOG_LEVEL': JSON.stringify(env.LOG_LEVEL?.toLowerCase() || 'info'),
      'import.meta.env.VITE_APP_TITLE': JSON.stringify('AI Note Taker'),
      'import.meta.env.VITE_APP_DESCRIPTION': JSON.stringify('AI-powered note taking with transcription and summarization'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0.0'),
      'import.meta.env.VITE_PROGRESS_UPDATE_INTERVAL': JSON.stringify(env.PROGRESS_UPDATE_INTERVAL_MS || '500'),
      'import.meta.env.VITE_SSE_TIMEOUT': JSON.stringify('30000'),
      'import.meta.env.VITE_ENABLE_PROGRESS_TRACKING': JSON.stringify(env.ENABLE_PROGRESS_TRACKING || 'true'),
      'import.meta.env.VITE_ENABLE_SSE': JSON.stringify(env.ENABLE_SSE || 'true'),
      'import.meta.env.VITE_ENABLE_JOB_MANAGEMENT': JSON.stringify('true'),
      'import.meta.env.VITE_ENABLE_SPEAKER_IDENTIFICATION': JSON.stringify(env.ENABLE_SPEAKER_IDENTIFICATION || 'true'),
    }
  }
})
