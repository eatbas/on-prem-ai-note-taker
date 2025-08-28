/**
 * 🚀 STAGE 1 FRONTEND OPTIMIZATION: Audio Processing Configuration
 * 
 * Optimized audio configuration that aligns with backend revolutionary optimizations:
 * - Intelligent chunking strategy (45-second chunks vs 1-second)
 * - Audio format optimization for backend pre-normalization
 * - Compression settings for bandwidth optimization
 * - Concurrent processing configuration
 */

import config from '../utils/envLoader'

// 🎯 CRITICAL: Align with backend optimal chunk processing
export const AUDIO_PROCESSING_CONFIG = {
  // Backend-aligned chunking (matches CHUNK_DURATION_SECONDS)
  OPTIMAL_CHUNK_DURATION: 45000,     // 45 seconds - matches backend processing
  CHUNK_OVERLAP: 2000,               // 2 seconds overlap for continuity
  FORCE_DATA_INTERVAL: 15000,        // Force data every 15 seconds as backup
  
  // Audio format optimization for backend pre-normalization
  RECORDING_CONFIG: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 64000,             // Optimized for speech (vs 128000)
    sampleRate: 16000,                // Match backend normalization target
    channelCount: 1,                  // Mono for better backend processing
  },
  
  // Compression and optimization settings
  COMPRESSION: {
    enableClientCompression: true,    // Compress before upload
    targetBitrate: 64000,            // Speech-optimized bitrate
    enableSilenceDetection: true,    // Remove silence for efficiency
    silenceThreshold: 0.01,          // Silence detection sensitivity
  },
  
  // Upload optimization
  UPLOAD: {
    enableStreaming: true,           // Stream chunks during recording
    maxConcurrentUploads: 3,         // Parallel upload streams
    retryAttempts: 2,               // Upload retry logic
    uploadDelay: 1000,              // Delay between uploads (1s)
    enableProgressTracking: true,   // Real-time progress
  },
  
  // Memory management
  MEMORY: {
    maxChunksInMemory: 10,          // Limit memory usage
    enableChunkCleanup: true,       // Auto cleanup old chunks
    cleanupDelay: 30000,           // Cleanup after 30 seconds
  }
} as const

// 🎵 Audio format validation and optimization
export function getOptimizedRecordingOptions(): MediaRecorderOptions {
  const options: MediaRecorderOptions = {
    mimeType: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.mimeType,
    bitsPerSecond: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.bitsPerSecond
  }
  
  // Validate browser support and fallback
  if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
    console.warn('⚠️ Preferred audio format not supported, falling back to browser default')
    return {
      bitsPerSecond: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.bitsPerSecond
    }
  }
  
  return options
}

// 🎯 Get optimized microphone constraints
export function getOptimizedMicrophoneConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      // Optimized for backend audio pre-normalization
      echoCancellation: false,          // Let backend handle echo cancellation
      noiseSuppression: false,         // Backend has better noise suppression
      autoGainControl: false,          // Backend handles gain optimization
      sampleRate: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.sampleRate,
      channelCount: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.channelCount
    }
  }
}

// 🔊 Get optimized system audio constraints  
export function getOptimizedSystemAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.sampleRate,
      channelCount: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.channelCount
    }
  }
}

// 📊 Calculate optimal chunk metrics
export function getChunkMetrics(recordingDuration: number) {
  const optimalChunks = Math.ceil(recordingDuration / AUDIO_PROCESSING_CONFIG.OPTIMAL_CHUNK_DURATION)
  const estimatedSize = optimalChunks * (AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.bitsPerSecond / 8) * (AUDIO_PROCESSING_CONFIG.OPTIMAL_CHUNK_DURATION / 1000)
  
  return {
    expectedChunks: optimalChunks,
    estimatedTotalSize: estimatedSize,
    averageChunkSize: estimatedSize / optimalChunks,
    estimatedUploadTime: (estimatedSize / (1024 * 1024)) * 2, // Rough estimate at 0.5 MB/s
    memoryOptimized: optimalChunks <= AUDIO_PROCESSING_CONFIG.MEMORY.maxChunksInMemory
  }
}

// 🚀 Performance monitoring helpers
export function logAudioPerformanceMetrics(operation: string, duration: number, size?: number) {
  const metrics = {
    operation,
    duration,
    size,
    timestamp: Date.now(),
    config: {
      chunkDuration: AUDIO_PROCESSING_CONFIG.OPTIMAL_CHUNK_DURATION,
      bitrate: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.bitsPerSecond,
      streaming: AUDIO_PROCESSING_CONFIG.UPLOAD.enableStreaming
    }
  }
  
  console.log('📊 Audio Performance:', metrics)
  
  // Store metrics for performance analysis
  if (typeof window !== 'undefined') {
    const existing = JSON.parse(localStorage.getItem('audioPerformanceMetrics') || '[]')
    existing.push(metrics)
    
    // Keep only last 100 entries
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100)
    }
    
    localStorage.setItem('audioPerformanceMetrics', JSON.stringify(existing))
  }
}

// 🎯 Export optimized configuration for environment variables
export function getAudioConfigForEnvironment() {
  return {
    VITE_AUDIO_CHUNK_MS: AUDIO_PROCESSING_CONFIG.OPTIMAL_CHUNK_DURATION,
    VITE_AUDIO_BITRATE: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.bitsPerSecond,
    VITE_AUDIO_SAMPLE_RATE: AUDIO_PROCESSING_CONFIG.RECORDING_CONFIG.sampleRate,
    VITE_ENABLE_STREAMING_UPLOAD: AUDIO_PROCESSING_CONFIG.UPLOAD.enableStreaming,
    VITE_MAX_CONCURRENT_UPLOADS: AUDIO_PROCESSING_CONFIG.UPLOAD.maxConcurrentUploads
  }
}

export default AUDIO_PROCESSING_CONFIG
