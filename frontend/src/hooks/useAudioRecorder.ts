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

      // Get microphone stream
      const micConstraints: MediaStreamConstraints = {
        audio: {
          deviceId: options.micDeviceId && options.micDeviceId !== 'default' 
            ? { exact: options.micDeviceId } 
            : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 2
        }
      }

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
        if (event.data && event.data.size > 0 && currentMeetingIdRef.current) {
          try {
            await addChunk(
              currentMeetingIdRef.current, 
              event.data, 
              micChunkIndexRef.current++, 
              'microphone'
            )
            console.log(`✅ Mic chunk saved (${event.data.size} bytes)`)
          } catch (error) {
            console.error('❌ Failed to save mic chunk:', error)
          }
        }
      }

      // Create speaker recorder if we have speaker stream
      let speakerRecorder: MediaRecorder | null = null
      if (speakerStream) {
        speakerRecorder = new MediaRecorder(speakerStream, recordingOptions)
        speakerRecorder.ondataavailable = async (event) => {
          if (event.data && event.data.size > 0 && currentMeetingIdRef.current) {
            try {
              await addChunk(
                currentMeetingIdRef.current, 
                event.data, 
                speakerChunkIndexRef.current++, 
                'speaker'
              )
              console.log(`✅ Speaker chunk saved (${event.data.size} bytes)`)
            } catch (error) {
              console.error('❌ Failed to save speaker chunk:', error)
            }
          }
        }
      }

      // Get chunk interval from config
      const chunkMs = config.audioChunkMs || 30000

      // Start recording
      micRecorder.start(chunkMs)
      speakerRecorder?.start(chunkMs)

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
      // Request final data from recorders (only if they're recording)
      if (state.micRecorder && state.micRecorder.state === 'recording') {
        state.micRecorder.requestData()
      }
      if (state.speakerRecorder && state.speakerRecorder.state === 'recording') {
        state.speakerRecorder.requestData()
      }

      // Stop recorders (only if they're not already inactive)
      if (state.micRecorder && state.micRecorder.state !== 'inactive') {
        state.micRecorder.stop()
      }
      if (state.speakerRecorder && state.speakerRecorder.state !== 'inactive') {
        state.speakerRecorder.stop()
      }

      // Stop streams
      state.micStream?.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop()
        }
      })
      state.speakerStream?.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop()
        }
      })

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

      console.log('✅ Dual recording stopped successfully')
    } catch (error) {
      console.error('❌ Error stopping recording:', error)
      setError('Failed to stop recording properly')
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
