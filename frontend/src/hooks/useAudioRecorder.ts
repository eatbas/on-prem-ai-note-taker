import { useRef, useState, useCallback } from 'react'
import { addChunk } from '../services'
import config from '../utils/envLoader'
import { 
  AUDIO_PROCESSING_CONFIG, 
  getOptimizedRecordingOptions,
  getOptimizedMicrophoneConstraints,
  getOptimizedSystemAudioConstraints,
  logAudioPerformanceMetrics
} from '../lib/audioConfig'
import { DualStreamingUploader } from '../services/streamingUploader'
import { compressAudioChunk } from '../lib/audioCompression'

export interface AudioRecorderState {
  isRecording: boolean
  micStream: MediaStream | null
  speakerStream: MediaStream | null
  micRecorder: MediaRecorder | null
  speakerRecorder: MediaRecorder | null
  error: string | null
  streamingUploader: DualStreamingUploader | null
  uploadProgress: { mic: number, speaker: number, total: number }
}

export interface RecordingOptions {
  micDeviceId?: string
  speakerDeviceId?: string
  language: 'tr' | 'en' | 'auto'
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    micStream: null,
    speakerStream: null,
    micRecorder: null,
    speakerRecorder: null,
    error: null,
    streamingUploader: null,
    uploadProgress: { mic: 0, speaker: 0, total: 0 }
  })

  const micChunkIndexRef = useRef(0)
  const speakerChunkIndexRef = useRef(0)
  const currentMeetingIdRef = useRef<string | null>(null)

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const startRecording = useCallback(async (
    meetingId: string, 
    options: RecordingOptions
  ): Promise<boolean> => {
    try {
      setError(null)
      
      // Reset chunk indices
      micChunkIndexRef.current = 0
      speakerChunkIndexRef.current = 0
      currentMeetingIdRef.current = meetingId

      // 🚀 STAGE 1 OPTIMIZATION: Use optimized microphone constraints
      const micConstraints = getOptimizedMicrophoneConstraints(options.micDeviceId)

      console.log('🎤 Using microphone constraints:', {
        deviceId: options.micDeviceId,
        hasConstraint: !!options.micDeviceId
      })

      const micStream = await navigator.mediaDevices.getUserMedia(micConstraints)
      console.log('✅ Microphone stream obtained')

      // Get speaker/system audio stream using multiple methods
      let speakerStream: MediaStream | null = null
      
      // Method 1: Try Electron-specific system audio capture (automatic)
      if ((window as any).desktopCapture) {
        try {
          console.log('🔊 Attempting automatic system audio capture via Electron...')
          speakerStream = await (window as any).desktopCapture.captureSystemAudio()
          if (speakerStream) {
            console.log('✅ Automatic system audio capture successful!')
          }
        } catch (err) {
          console.warn('⚠️ Automatic system audio capture failed:', err)
        }
      }
      
      // Method 2: Try desktop capturer for system audio (Electron-specific, automatic)
      if (!speakerStream && (window as any).desktopCapture) {
        try {
          console.log('🔊 Trying desktop capturer for system audio...')
          speakerStream = await (window as any).desktopCapture.captureDesktopAudio()
          if (speakerStream) {
            console.log('✅ Desktop capturer system audio successful!')
          }
        } catch (err) {
          console.warn('⚠️ Desktop capturer system audio failed:', err)
        }
      }
      
      // Method 2.5: Try Electron loopback device detection (automatic)
      if (!speakerStream && (window as any).desktopCapture) {
        try {
          console.log('🔊 Trying Electron loopback device detection...')
          speakerStream = await (window as any).desktopCapture.captureLoopbackAudio()
          if (speakerStream) {
            console.log('✅ Electron loopback device detection successful!')
          }
        } catch (err) {
          console.warn('⚠️ Electron loopback device detection failed:', err)
        }
      }
      
      // Method 3: Try automatic loopback device detection
      if (!speakerStream) {
        try {
          console.log('🔊 Attempting automatic loopback device detection...')
          const devices = await navigator.mediaDevices.enumerateDevices()
          
          // Look for system audio loopback devices
          const loopbackDevice = devices.find(device => 
            device.kind === 'audioinput' && (
              device.label.toLowerCase().includes('stereo mix') ||
              device.label.toLowerCase().includes('what u hear') ||
              device.label.toLowerCase().includes('loopback') ||
              device.label.toLowerCase().includes('system audio') ||
              device.label.toLowerCase().includes('monitor') ||
              device.label.toLowerCase().includes('desktop audio')
            )
          )
          
          if (loopbackDevice) {
            console.log('🔊 Found loopback device:', loopbackDevice.label)
            // 🚀 STAGE 1 OPTIMIZATION: Use optimized system audio constraints
            const systemConstraints = getOptimizedSystemAudioConstraints()
            const constraintsWithDevice = {
              audio: {
                ...(systemConstraints.audio as MediaTrackConstraints),
                deviceId: { exact: loopbackDevice.deviceId }
              }
            }
            speakerStream = await navigator.mediaDevices.getUserMedia(constraintsWithDevice)
            console.log('✅ Loopback device system audio successful!')
          } else {
            console.log('📍 No loopback devices found. Available audio input devices:')
            devices.filter(d => d.kind === 'audioinput').forEach(device => {
              console.log(`  - ${device.label} (${device.deviceId.slice(0, 20)}...)`)
            })
          }
        } catch (err) {
          console.warn('⚠️ Loopback device detection failed:', err)
        }
      }
      
      // Method 4: Last resort - try traditional screen capture (requires user interaction)
      if (!speakerStream) {
        try {
          console.log('🔊 Fallback: Requesting system audio via screen capture...')
          
          // 🚀 STAGE 1 OPTIMIZATION: Use optimized system audio constraints for screen capture
          const systemConstraints = getOptimizedSystemAudioConstraints()
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: false, // Try audio-only first  
            audio: systemConstraints.audio as any
          })
          
          console.log('🖥️ Display media stream obtained, checking for audio tracks...')
          
          // Extract only audio tracks
          const audioTracks = screenStream.getAudioTracks()
          console.log(`🔊 Found ${audioTracks.length} audio tracks in screen capture`)
          
          if (audioTracks.length > 0) {
            speakerStream = new MediaStream(audioTracks)
            console.log('✅ Screen capture system audio successful!')
            console.log('🔊 Audio track details:', audioTracks.map(track => ({
              kind: track.kind,
              label: track.label,
              enabled: track.enabled,
              readyState: track.readyState
            })))
          }
          
          // Stop video tracks if any
          const videoTracks = screenStream.getVideoTracks()
          if (videoTracks.length > 0) {
            console.log(`📹 Stopping ${videoTracks.length} video tracks...`)
            videoTracks.forEach(track => track.stop())
          }
          
        } catch (err) {
          console.warn('⚠️ Screen capture system audio failed:', err)
        }
      }
      
      // Summary of system audio capture attempt
      if (speakerStream) {
        const tracks = speakerStream.getAudioTracks()
        console.log('🎉 System audio capture successful!', {
          trackCount: tracks.length,
          trackLabels: tracks.map(t => t.label),
          trackStates: tracks.map(t => t.readyState)
        })
      } else {
        console.warn('❌ All system audio capture methods failed')
        console.warn('💡 System audio will not be recorded')
      }

      // 🚀 STAGE 1 OPTIMIZATION: Use optimized recording options
      const recordingOptions = getOptimizedRecordingOptions()
      
      console.log('🎵 Using optimized recording options:', recordingOptions)

      // Create microphone recorder
      const micRecorder = new MediaRecorder(micStream, recordingOptions)
      micRecorder.ondataavailable = async (event) => {
        const chunkSize = event.data?.size || 0
        console.log(`🎤 Mic data available: ${chunkSize} bytes`)
        
        if (event.data && event.data.size > 0 && currentMeetingIdRef.current) {
          try {
            const chunkStartTime = Date.now()
            console.log(`💾 Saving OPTIMIZED mic chunk ${micChunkIndexRef.current} with meetingId: ${currentMeetingIdRef.current}`)
            
            // 🚀 STAGE 1 OPTIMIZATION: Audio compression for bandwidth optimization
            let chunkToStore = event.data
            let chunkToStream = event.data
            
            if (AUDIO_PROCESSING_CONFIG.COMPRESSION.enableClientCompression) {
              console.log(`🗜️ Compressing mic chunk ${micChunkIndexRef.current} for bandwidth optimization...`)
              const compressionResult = await compressAudioChunk(event.data, 'microphone')
              
              if (compressionResult.compressionRatio > 1.1) { // Only use compression if it reduces size by at least 10%
                chunkToStore = compressionResult.compressedBlob
                chunkToStream = compressionResult.compressedBlob
                console.log(`✅ Mic chunk ${micChunkIndexRef.current} compressed: ${compressionResult.originalSize} → ${compressionResult.compressedSize} bytes (${((compressionResult.compressionRatio - 1) * 100).toFixed(1)}% reduction)`)
              } else {
                console.log(`📊 Mic chunk ${micChunkIndexRef.current} compression not beneficial, using original`)
              }
            }
            
            // Local storage for reliability (existing behavior)
            await addChunk(
              currentMeetingIdRef.current, 
              chunkToStore, 
              micChunkIndexRef.current, 
              'microphone'
            )
            
            // 🚀 STAGE 1 OPTIMIZATION: Streaming upload for real-time processing
            if (streamingUploader && AUDIO_PROCESSING_CONFIG.UPLOAD.enableStreaming) {
              console.log(`📤 Streaming upload mic chunk ${micChunkIndexRef.current} for real-time processing...`)
              await streamingUploader.addMicrophoneChunk(chunkToStream, micChunkIndexRef.current)
            }
            
            const chunkSaveTime = Date.now() - chunkStartTime
            console.log(`✅ OPTIMIZED mic chunk ${micChunkIndexRef.current} saved + streamed: ${chunkSize} bytes in ${chunkSaveTime}ms`)
            
            // 🚀 STAGE 1: Performance monitoring for optimized chunks
            logAudioPerformanceMetrics('chunk_save_mic', chunkSaveTime, chunkSize)
            
            micChunkIndexRef.current++
          } catch (error) {
            console.error('❌ Failed to save mic chunk:', error)
            setError(`Failed to save audio: ${error}`)
          }
        } else {
          console.warn(`⚠️ Empty mic data: ${chunkSize} bytes, meetingId: ${currentMeetingIdRef.current}`)
        }
      }

      // Create speaker recorder if we have speaker stream
      let speakerRecorder: MediaRecorder | null = null
      if (speakerStream) {
        speakerRecorder = new MediaRecorder(speakerStream, recordingOptions)
        speakerRecorder.ondataavailable = async (event) => {
          const chunkSize = event.data?.size || 0
          console.log(`🔊 Speaker data available: ${chunkSize} bytes`)
          
          if (event.data && event.data.size > 0 && currentMeetingIdRef.current) {
            try {
              const chunkStartTime = Date.now()
              console.log(`💾 Saving OPTIMIZED speaker chunk ${speakerChunkIndexRef.current} with meetingId: ${currentMeetingIdRef.current}`)
              
              // 🚀 STAGE 1 OPTIMIZATION: Audio compression for bandwidth optimization
              let chunkToStore = event.data
              let chunkToStream = event.data
              
              if (AUDIO_PROCESSING_CONFIG.COMPRESSION.enableClientCompression) {
                console.log(`🗜️ Compressing speaker chunk ${speakerChunkIndexRef.current} for bandwidth optimization...`)
                const compressionResult = await compressAudioChunk(event.data, 'speaker')
                
                if (compressionResult.compressionRatio > 1.1) { // Only use compression if it reduces size by at least 10%
                  chunkToStore = compressionResult.compressedBlob
                  chunkToStream = compressionResult.compressedBlob
                  console.log(`✅ Speaker chunk ${speakerChunkIndexRef.current} compressed: ${compressionResult.originalSize} → ${compressionResult.compressedSize} bytes (${((compressionResult.compressionRatio - 1) * 100).toFixed(1)}% reduction)`)
                } else {
                  console.log(`📊 Speaker chunk ${speakerChunkIndexRef.current} compression not beneficial, using original`)
                }
              }
              
              // Local storage for reliability (existing behavior)
              await addChunk(
                currentMeetingIdRef.current, 
                chunkToStore, 
                speakerChunkIndexRef.current, 
                'speaker'
              )
              
              // 🚀 STAGE 1 OPTIMIZATION: Streaming upload for real-time processing
              if (streamingUploader && AUDIO_PROCESSING_CONFIG.UPLOAD.enableStreaming) {
                console.log(`📤 Streaming upload speaker chunk ${speakerChunkIndexRef.current} for real-time processing...`)
                await streamingUploader.addSystemChunk(chunkToStream, speakerChunkIndexRef.current)
              }
              
              const chunkSaveTime = Date.now() - chunkStartTime
              console.log(`✅ OPTIMIZED speaker chunk ${speakerChunkIndexRef.current} saved + streamed: ${chunkSize} bytes in ${chunkSaveTime}ms`)
              
              // 🚀 STAGE 1: Performance monitoring for optimized chunks
              logAudioPerformanceMetrics('chunk_save_speaker', chunkSaveTime, chunkSize)
              
              speakerChunkIndexRef.current++
            } catch (error) {
              console.error('❌ Failed to save speaker chunk:', error)
              // Don't fail recording for speaker issues
            }
          } else {
            console.warn(`⚠️ Empty speaker data: ${chunkSize} bytes, meetingId: ${currentMeetingIdRef.current}`)
          }
        }
      }

      // 🚀 STAGE 1 OPTIMIZATION: Intelligent chunking strategy (45-second chunks)
      const chunkMs = AUDIO_PROCESSING_CONFIG.OPTIMAL_CHUNK_DURATION
      const forceDataMs = AUDIO_PROCESSING_CONFIG.FORCE_DATA_INTERVAL

      // Start recording with backend-aligned chunks for optimal processing
      console.log(`🚀 Starting OPTIMIZED recording with ${chunkMs}ms chunks (${chunkMs/1000}s per chunk)`)
      console.log(`🎯 This aligns with backend CHUNK_DURATION_SECONDS for optimal AI processing`)
      
      // Start performance monitoring
      const recordingStartTime = Date.now()
      logAudioPerformanceMetrics('recording_start', 0)

      // 🚀 STAGE 1 OPTIMIZATION: Initialize streaming uploader for real-time upload
      let streamingUploader: DualStreamingUploader | null = null
      if (AUDIO_PROCESSING_CONFIG.UPLOAD.enableStreaming) {
        console.log('🔄 Initializing streaming uploader for real-time processing...')
        streamingUploader = new DualStreamingUploader(
          meetingId,
          (micProgress, speakerProgress, totalProgress) => {
            // Update upload progress in real-time
            setState(prev => ({
              ...prev,
              uploadProgress: { mic: micProgress, speaker: speakerProgress, total: totalProgress }
            }))
          }
        )
        console.log('✅ Streaming uploader initialized')
      }
      
      micRecorder.start(chunkMs)
      if (speakerRecorder) {
        speakerRecorder.start(chunkMs)
      }
      
      // Force data capture as backup (less frequent due to larger chunks)
      const forceDataInterval = setInterval(() => {
        if (micRecorder.state === 'recording') {
          console.log(`🔄 Forcing mic data capture (${forceDataMs/1000}s interval)...`)
          micRecorder.requestData()
        }
        if (speakerRecorder && speakerRecorder.state === 'recording') {
          console.log(`🔄 Forcing speaker data capture (${forceDataMs/1000}s interval)...`)
          speakerRecorder.requestData()
        }
      }, forceDataMs)
      
      // Store interval for cleanup and recording start time for performance tracking
      ;(micRecorder as any)._forceDataInterval = forceDataInterval
      ;(micRecorder as any)._recordingStartTime = recordingStartTime

      // Update state
      setState({
        isRecording: true,
        micStream,
        speakerStream,
        micRecorder,
        speakerRecorder,
        error: null,
        streamingUploader,
        uploadProgress: { mic: 0, speaker: 0, total: 0 }
      })

      console.log('🎙️ Dual recording started successfully')
      return true

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording'
      setError(errorMessage)
      console.error('❌ Recording start failed:', error)
      return false
    }
  }, [setError])

  const stopRecording = useCallback(async (): Promise<void> => {
    console.log('🛑 Stopping dual recording...')

    try {
      // Get current state to avoid stale closures
      const currentState = state
      
      console.log('🔍 Current recording state:', {
        isRecording: currentState.isRecording,
        hasMicRecorder: !!currentState.micRecorder,
        hasSpeakerRecorder: !!currentState.speakerRecorder,
        hasMicStream: !!currentState.micStream,
        hasSpeakerStream: !!currentState.speakerStream,
        micRecorderState: currentState.micRecorder?.state,
        speakerRecorderState: currentState.speakerRecorder?.state
      })

      const stopPromises: Promise<void>[] = []

      // Stop microphone recorder with proper cleanup
      if (currentState.micRecorder) {
        console.log('🎤 Stopping microphone recorder...')
        
        // Clear force data interval first
        if ((currentState.micRecorder as any)._forceDataInterval) {
          clearInterval((currentState.micRecorder as any)._forceDataInterval)
          console.log('🧹 Cleared mic force data interval')
        }

        if (currentState.micRecorder.state === 'recording') {
          // Request final data
          currentState.micRecorder.requestData()
          
          // Create promise that resolves when recorder stops
          const micStopPromise = new Promise<void>((resolve) => {
            const handleStop = () => {
              console.log('🎤 Microphone recorder stopped')
              currentState.micRecorder?.removeEventListener('stop', handleStop)
              resolve()
            }
            currentState.micRecorder?.addEventListener('stop', handleStop, { once: true })
            
            // Add timeout to prevent hanging
            setTimeout(() => {
              console.warn('⚠️ Microphone recorder stop timeout')
              currentState.micRecorder?.removeEventListener('stop', handleStop)
              resolve()
            }, 5000)
          })
          
          stopPromises.push(micStopPromise)
          currentState.micRecorder.stop()
        }
      }

      // Stop speaker recorder with proper cleanup  
      if (currentState.speakerRecorder) {
        console.log('🔊 Stopping speaker recorder...')
        
        if (currentState.speakerRecorder.state === 'recording') {
          // Request final data
          currentState.speakerRecorder.requestData()
          
          // Create promise that resolves when recorder stops
          const speakerStopPromise = new Promise<void>((resolve) => {
            const handleStop = () => {
              console.log('🔊 Speaker recorder stopped')
              currentState.speakerRecorder?.removeEventListener('stop', handleStop)
              resolve()
            }
            currentState.speakerRecorder?.addEventListener('stop', handleStop, { once: true })
            
            // Add timeout to prevent hanging
            setTimeout(() => {
              console.warn('⚠️ Speaker recorder stop timeout')
              currentState.speakerRecorder?.removeEventListener('stop', handleStop)
              resolve()
            }, 5000)
          })
          
          stopPromises.push(speakerStopPromise)
          currentState.speakerRecorder.stop()
        }
      }

      // Wait for all recorders to stop properly
      if (stopPromises.length > 0) {
        console.log('⏳ Waiting for recorders to stop...')
        await Promise.all(stopPromises)
        console.log('✅ All recorders stopped')
      }

      // 🚀 STAGE 1 OPTIMIZATION: Stop streaming uploader
      if (currentState.streamingUploader) {
        console.log('🛑 Stopping streaming uploader...')
        await currentState.streamingUploader.stop()
        console.log('✅ Streaming uploader stopped')
      }

      // Now safely stop all media streams
      console.log('🔌 Stopping media streams...')
      
      if (currentState.micStream) {
        currentState.micStream.getTracks().forEach((track, index) => {
          console.log(`🎤 Stopping mic track ${index}: ${track.kind}, state: ${track.readyState}`)
          if (track.readyState !== 'ended') {
            track.stop()
            console.log(`✅ Mic track ${index} stopped`)
          }
        })
      }
      
      if (currentState.speakerStream) {
        currentState.speakerStream.getTracks().forEach((track, index) => {
          console.log(`🔊 Stopping speaker track ${index}: ${track.kind}, state: ${track.readyState}`)
          if (track.readyState !== 'ended') {
            track.stop()
            console.log(`✅ Speaker track ${index} stopped`)
          }
        })
      }

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Reset state
      setState({
        isRecording: false,
        micStream: null,
        speakerStream: null,
        micRecorder: null,
        speakerRecorder: null,
        error: null,
        streamingUploader: null,
        uploadProgress: { mic: 0, speaker: 0, total: 0 }
      })

      // Clear meeting reference
      currentMeetingIdRef.current = null

      // Force additional cleanup to ensure microphone is released
      console.log('🧹 Performing additional cleanup to ensure microphone release...')
      
      // Call global mic cleanup if available (from MicrophoneSelector)
      if ((window as any).forceMicCleanup) {
        console.log('🚨 Calling emergency microphone cleanup...')
        try {
          (window as any).forceMicCleanup()
        } catch (e) {
          console.warn('⚠️ Emergency mic cleanup failed:', e)
        }
      }
      
      // Give a moment for all streams to be properly released
      setTimeout(() => {
        console.log('🔍 Final microphone status check completed')
      }, 500)

      // 🚀 STAGE 1: Log recording completion performance
      const totalRecordingTime = Date.now() - (state.micRecorder as any)._recordingStartTime
      const totalChunks = micChunkIndexRef.current + speakerChunkIndexRef.current
      logAudioPerformanceMetrics('recording_complete', totalRecordingTime, totalChunks)
      
      console.log('✅ OPTIMIZED dual recording stopped successfully - microphone should be released')
      console.log(`📊 Recording stats: ${totalRecordingTime}ms duration, ${totalChunks} total chunks saved`)
    } catch (error) {
      console.error('❌ Error stopping recording:', error)
      setError('Failed to stop recording properly')
      
      // Force cleanup even on error
      try {
        setState({
          isRecording: false,
          micStream: null,
          speakerStream: null,
          micRecorder: null,
          speakerRecorder: null,
          error: null,
          streamingUploader: null,
          uploadProgress: { mic: 0, speaker: 0, total: 0 }
        })
        currentMeetingIdRef.current = null
      } catch (e) {
        console.error('❌ Failed to force cleanup:', e)
      }
    }
  }, [state, setError])

  const cleanup = useCallback(() => {
    if (state.isRecording) {
      stopRecording()
    }
  }, [state.isRecording, stopRecording])

  return {
    state,
    startRecording,
    stopRecording,
    cleanup,
    setError
  }
}
