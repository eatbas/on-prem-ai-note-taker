import { invoke } from '../lib/tauri'

export interface AudioDevice {
  id: string
  name: string
  is_system: boolean
  channels: number
  sample_rate: number
}

export interface AudioConfig {
  sample_rate: number
  channels: number
  buffer_size: number
}

export class TauriAudioCaptureManager {
  private isRecording = false
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []

  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      return await invoke('get_audio_devices')
    } catch (error) {
      console.error('Failed to get audio devices:', error)
      return []
    }
  }

  async startSystemAudioCapture(): Promise<MediaStream | null> {
    try {
      // Start system audio capture in Rust backend
      await invoke('start_audio_capture', {
        deviceId: this.getSystemDeviceId()
      })

      // Create a MediaStream from the captured audio
      return await this.createMediaStreamFromTauri()
    } catch (error) {
      console.error('System audio capture failed:', error)
      return null
    }
  }

  async startMicrophoneCapture(options: RecordingOptions): Promise<MediaStream> {
    try {
      const deviceId = options.microphoneDeviceId || 'default'
      await invoke('start_audio_capture', { deviceId })

      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.microphoneDeviceId,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
    } catch (error) {
      console.error('Microphone capture failed:', error)
      throw error
    }
  }

  async stopCapture(): Promise<void> {
    try {
      await invoke('stop_audio_capture')
      this.isRecording = false
    } catch (error) {
      console.error('Failed to stop capture:', error)
    }
  }

  async getCapturedAudioData(): Promise<Float32Array> {
    try {
      const audioData: number[] = await invoke('get_audio_data')
      return new Float32Array(audioData)
    } catch (error) {
      console.error('Failed to get audio data:', error)
      return new Float32Array()
    }
  }

  private getSystemDeviceId(): string {
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('win')) return 'system_windows'
    if (platform.includes('mac')) return 'system_macos'
    return 'system_linux'
  }

  private async createMediaStreamFromTauri(): Promise<MediaStream> {
    // Create a MediaStream from Tauri's native audio capture
    // This bridges the gap between native audio and web APIs
    const audioContext = new AudioContext()
    const stream = audioContext.createMediaStreamDestination().stream

    // Poll for audio data from Tauri and feed it to the stream
    const pollAudio = async () => {
      if (this.isRecording) {
        try {
          const audioData = await this.getCapturedAudioData()
          if (audioData.length > 0) {
            // Convert Float32Array to AudioBuffer
            const buffer = audioContext.createBuffer(1, audioData.length, 44100)
            buffer.copyFromChannel(audioData, 0)

            // Create buffer source and connect to stream
            const source = audioContext.createBufferSource()
            source.buffer = buffer
            source.connect(audioContext.destination)
            source.start()
          }
        } catch (error) {
          console.error('Audio polling error:', error)
        }

        // Continue polling
        setTimeout(pollAudio, 100)
      }
    }

    this.isRecording = true
    pollAudio()

    return stream
  }
}
