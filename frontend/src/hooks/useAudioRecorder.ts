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
            speakerStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { exact: loopbackDevice.deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 44100,
                channelCount: 2
              }
            })
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
          
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: false, // Try audio-only first  
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 44100,
              channelCount: 2
            } as any
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
