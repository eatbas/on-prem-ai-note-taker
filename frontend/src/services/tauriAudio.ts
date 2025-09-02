import { invoke } from '@tauri-apps/api/core'

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
  private pollingInterval: number | null = null

  /**
   * Get all available audio devices (microphones and system audio)
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      const devices = await invoke<AudioDevice[]>('get_audio_devices')
      console.log('🎵 Available audio devices:', devices)
      return devices
    } catch (error) {
      console.error('Failed to get audio devices:', error)
      return []
    }
  }

  /**
   * Start capturing audio from a specific device
   */
  async startAudioCapture(deviceId: string): Promise<boolean> {
    try {
      console.log('🎵 Starting audio capture for device:', deviceId)
      await invoke('start_audio_capture', { deviceId })
      this.isRecording = true
      
      // Start polling for recording status
      this.startStatusPolling()
      
      return true
    } catch (error) {
      console.error('Failed to start audio capture:', error)
      return false
    }
  }

  /**
   * Start system audio capture (the main feature we migrated for!)
   */
  async startSystemAudioCapture(): Promise<boolean> {
    try {
      const devices = await this.getAudioDevices()
      const systemDevice = devices.find(device => device.is_system)
      
      if (!systemDevice) {
        console.error('No system audio device found')
        return false
      }

      console.log('🔊 Starting NATIVE system audio capture:', systemDevice.name)
      return await this.startAudioCapture(systemDevice.id)
    } catch (error) {
      console.error('System audio capture failed:', error)
      return false
    }
  }

  /**
   * Start microphone capture
   */
  async startMicrophoneCapture(deviceId?: string): Promise<boolean> {
    try {
      const devices = await this.getAudioDevices()
      let micDevice = devices.find(device => !device.is_system)
      
      if (deviceId) {
        micDevice = devices.find(device => device.id === deviceId)
      }
      
      if (!micDevice) {
        console.error('No microphone device found')
        return false
      }

      console.log('🎤 Starting microphone capture:', micDevice.name)
      return await this.startAudioCapture(micDevice.id)
    } catch (error) {
      console.error('Microphone capture failed:', error)
      return false
    }
  }

  /**
   * Stop all audio capture
   */
  async stopCapture(): Promise<void> {
    try {
      console.log('🛑 Stopping all audio capture')
      await invoke('stop_audio_capture')
      this.isRecording = false
      this.stopStatusPolling()
    } catch (error) {
      console.error('Failed to stop capture:', error)
    }
  }

  /**
   * Stop capture for a specific device
   */
  async stopDeviceCapture(deviceId: string): Promise<void> {
    try {
      console.log('🛑 Stopping capture for device:', deviceId)
      await invoke('stop_device_capture', { deviceId })
    } catch (error) {
      console.error('Failed to stop device capture:', error)
    }
  }

  /**
   * Check if currently recording
   */
  async isCurrentlyRecording(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_recording')
    } catch (error) {
      console.error('Failed to check recording status:', error)
      return false
    }
  }

  /**
   * Get list of active recording devices
   */
  async getActiveDevices(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_active_audio_devices')
    } catch (error) {
      console.error('Failed to get active devices:', error)
      return []
    }
  }

  /**
   * Get current audio buffer size
   */
  async getBufferSize(): Promise<number> {
    try {
      return await invoke<number>('get_audio_buffer_size')
    } catch (error) {
      console.error('Failed to get buffer size:', error)
      return 0
    }
  }

  /**
   * Get audio data chunk for processing
   */
  async getAudioDataChunk(maxSamples: number = 44100): Promise<Float32Array> {
    try {
      const audioData = await invoke<number[]>('get_audio_data_chunk', { maxSamples })
      return new Float32Array(audioData)
    } catch (error) {
      console.error('Failed to get audio data chunk:', error)
      return new Float32Array()
    }
  }

  /**
   * Get all captured audio data
   */
  async getAllAudioData(): Promise<Float32Array> {
    try {
      const audioData = await invoke<number[]>('get_audio_data')
      return new Float32Array(audioData)
    } catch (error) {
      console.error('Failed to get audio data:', error)
      return new Float32Array()
    }
  }

  /**
   * Convert audio data to WAV blob for saving/processing
   */
  audioDataToWav(audioData: Float32Array, sampleRate: number = 44100): Blob {
    const buffer = new ArrayBuffer(44 + audioData.length * 2)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + audioData.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, audioData.length * 2, true)
    
    // Convert float samples to 16-bit PCM
    let offset = 44
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
    
    return new Blob([buffer], { type: 'audio/wav' })
  }

  /**
   * Start polling for recording status updates
   */
  private startStatusPolling() {
    if (this.pollingInterval) return
    
    this.pollingInterval = window.setInterval(async () => {
      try {
        const isRecording = await this.isCurrentlyRecording()
        if (isRecording !== this.isRecording) {
          this.isRecording = isRecording
          console.log('🎵 Recording status changed:', isRecording)
        }
      } catch (error) {
        console.error('Status polling error:', error)
      }
    }, 1000)
  }

  /**
   * Stop status polling
   */
  private stopStatusPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * Get recording status (local)
   */
  getRecordingStatus(): boolean {
    return this.isRecording
  }
}

// Export singleton instance
export const tauriAudio = new TauriAudioCaptureManager()