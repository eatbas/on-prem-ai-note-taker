import { useRef, useState, useCallback } from 'react'
import { addChunk } from '../services'
import config from '../utils/envLoader'

export interface AudioRecorderState {
  isRecording: boolean
  micStream: MediaStream | null
  speakerStream: MediaStream | null
  micRecorder: MediaRecorder | null
  speakerRecorder: MediaRecorder | null
  error: string | null
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
    error: null
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

      // Get microphone stream with proper device constraints
      const micConstraints: MediaStreamConstraints = {
        audio: {
          deviceId: options.micDeviceId 
            ? { exact: options.micDeviceId } 
            : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 2
        }
      }

      console.log('🎤 Using microphone constraints:', {
        deviceId: options.micDeviceId,
        hasConstraint: !!options.micDeviceId
      })

      const micStream = await navigator.mediaDevices.getUserMedia(micConstraints)
      console.log('✅ Microphone stream obtained')

      // Get speaker/system audio stream
      let speakerStream: MediaStream | null = null
      try {
        // Try to get system audio via screen capture with audio
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100,
            channelCount: 2
          } as any
        })
        
        // Extract only audio tracks
        const audioTracks = screenStream.getAudioTracks()
        if (audioTracks.length > 0) {
          speakerStream = new MediaStream(audioTracks)
          console.log('✅ Speaker/system audio stream obtained')
        } else {
          console.warn('⚠️ No audio tracks in screen capture')
        }
        
        // Stop video tracks if any
        screenStream.getVideoTracks().forEach(track => track.stop())
      } catch (err) {
        console.warn('⚠️ Could not capture system audio:', err)
      }

      // Recording options
      const recordingOptions: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 128000
      }

      // Create microphone recorder
      const micRecorder = new MediaRecorder(micStream, recordingOptions)
      micRecorder.ondataavailable = async (event) => {
        console.log(`🎤 Mic data available: ${event.data?.size || 0} bytes`)
        
        if (event.data && event.data.size > 0 && currentMeetingIdRef.current) {
          try {
            console.log(`💾 Saving mic chunk ${micChunkIndexRef.current} with meetingId: ${currentMeetingIdRef.current}`)
            await addChunk(
              currentMeetingIdRef.current, 
              event.data, 
              micChunkIndexRef.current, 
              'microphone'
            )
            console.log(`✅ Mic chunk ${micChunkIndexRef.current} saved: ${event.data.size} bytes`)
            micChunkIndexRef.current++
          } catch (error) {
            console.error('❌ Failed to save mic chunk:', error)
            setError(`Failed to save audio: ${error}`)
          }
        } else {
          console.warn(`⚠️ Empty mic data: ${event.data?.size || 0} bytes, meetingId: ${currentMeetingIdRef.current}`)
        }
      }

      // Create speaker recorder if we have speaker stream
      let speakerRecorder: MediaRecorder | null = null
      if (speakerStream) {
        speakerRecorder = new MediaRecorder(speakerStream, recordingOptions)
        speakerRecorder.ondataavailable = async (event) => {
          console.log(`🔊 Speaker data available: ${event.data?.size || 0} bytes`)
          
          if (event.data && event.data.size > 0 && currentMeetingIdRef.current) {
            try {
              console.log(`💾 Saving speaker chunk ${speakerChunkIndexRef.current} with meetingId: ${currentMeetingIdRef.current}`)
              await addChunk(
                currentMeetingIdRef.current, 
                event.data, 
                speakerChunkIndexRef.current, 
                'speaker'
              )
              console.log(`✅ Speaker chunk ${speakerChunkIndexRef.current} saved: ${event.data.size} bytes`)
              speakerChunkIndexRef.current++
            } catch (error) {
              console.error('❌ Failed to save speaker chunk:', error)
              // Don't fail recording for speaker issues
            }
          } else {
            console.warn(`⚠️ Empty speaker data: ${event.data?.size || 0} bytes, meetingId: ${currentMeetingIdRef.current}`)
          }
        }
      }

      // Use short chunks like AudioTest for reliability
      const chunkMs = 1000  // 1 second chunks like AudioTest

      // Start recording with short intervals for reliable data capture
      console.log(`🎙️ Starting recording with ${chunkMs}ms chunks`)
      micRecorder.start(chunkMs)
      if (speakerRecorder) {
        speakerRecorder.start(chunkMs)
      }
      
      // Force data capture every 5 seconds as backup (like AudioTest frequency)
      const forceDataInterval = setInterval(() => {
        if (micRecorder.state === 'recording') {
          console.log('🔄 Forcing mic data capture...')
          micRecorder.requestData()
        }
        if (speakerRecorder && speakerRecorder.state === 'recording') {
          console.log('🔄 Forcing speaker data capture...')
          speakerRecorder.requestData()
        }
      }, 5000)
      
      // Store interval for cleanup
      ;(micRecorder as any)._forceDataInterval = forceDataInterval

      // Update state
      setState({
        isRecording: true,
        micStream,
        speakerStream,
        micRecorder,
        speakerRecorder,
        error: null
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
        error: null
      })

      // Clear meeting reference
      currentMeetingIdRef.current = null

      console.log('✅ Dual recording stopped successfully - microphone should be released')
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
          error: null
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
