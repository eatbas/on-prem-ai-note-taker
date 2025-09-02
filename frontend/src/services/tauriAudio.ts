import { invoke } from '@tauri-apps/api/core'

export interface AudioDevice {
  id: string
  name: string
  is_system: boolean
  channels: number
  sample_rate: number
}

export interface AudioSource {
  id: string
  name: string
  device_type: 'SystemAudio' | 'Microphone' | 'LineIn' | 'Virtual'
  channels: number
  sample_rate: number
  is_active: boolean
}

export interface AudioConfig {
  sample_rate: number
  channels: number
  buffer_size: number
}

export class TauriAudioCaptureManager {
  private isRecording = false
  private pollingInterval: number | null = null
  private activeDevices: string[] = []
  private activeSources: string[] = []
  private isInitialized = false
  private usingMultiAudio = false

  /**
   * Initialize the audio manager and check available devices
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      const devices = await this.getAudioDevices()
      console.log('🎵 Tauri Audio Manager initialized with', devices.length, 'devices')
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize Tauri Audio Manager:', error)
      throw error
    }
  }

  /**
   * Get all available audio devices (microphones and system audio) - Legacy method
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      const devices = await invoke<AudioDevice[]>('get_audio_devices')
      console.log('🎵 Available audio devices:', devices)
      
      // Filter and categorize devices
      const micDevices = devices.filter(d => !d.is_system)
      const systemDevices = devices.filter(d => d.is_system)
      
      console.log('🎤 Microphone devices:', micDevices.length)
      console.log('🔊 System audio devices:', systemDevices.length)
      
      return devices
    } catch (error) {
      console.error('Failed to get audio devices:', error)
      return []
    }
  }

  /**
   * Discover all available audio sources using the new multi-audio system
   */
  async discoverAudioSources(): Promise<AudioSource[]> {
    try {
      console.log('🔍 Discovering audio sources with native Tauri...')
      const sources = await invoke<AudioSource[]>('discover_audio_sources')
      console.log('✅ Discovered', sources.length, 'audio sources')
      
      // Log each source for debugging
      sources.forEach(source => {
        const icon = source.device_type === 'SystemAudio' ? '🔊' : 
                    source.device_type === 'Microphone' ? '🎤' : '🎛️'
        const status = source.is_active ? '✅ ACTIVE' : '❌ INACTIVE'
        console.log(`  - ${icon} ${source.name} (${source.device_type}) - ${source.sample_rate}Hz - ${status}`)
      })
      
      return sources
    } catch (error) {
      console.error('Failed to discover audio sources:', error)
      throw error
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
   * Start system audio capture with intelligent device selection
   */
  async startSystemAudioCapture(): Promise<boolean> {
    try {
      await this.initialize()
      
      const devices = await this.getAudioDevices()
      const systemDevices = devices.filter(device => device.is_system)
      
      if (systemDevices.length === 0) {
        console.error('No system audio devices found')
        return false
      }

      // Try devices in order of preference based on platform
      const preferredOrder = this.getSystemAudioPreferenceOrder()
      
      for (const preferredId of preferredOrder) {
        const device = systemDevices.find(d => d.id === preferredId)
        if (device) {
          console.log('🔊 Attempting system audio capture with:', device.name)
          const success = await this.startAudioCapture(device.id)
          if (success) {
            console.log('✅ System audio capture started with:', device.name)
            return true
          } else {
            console.warn('⚠️ Failed to start capture with:', device.name)
          }
        }
      }
      
      // Fallback: try any system device
      for (const device of systemDevices) {
        if (!preferredOrder.includes(device.id)) {
          console.log('🔊 Fallback attempt with:', device.name)
          const success = await this.startAudioCapture(device.id)
          if (success) {
            console.log('✅ System audio capture started (fallback) with:', device.name)
            return true
          }
        }
      }
      
      console.error('❌ Failed to start system audio capture with any device')
      return false
    } catch (error) {
      console.error('System audio capture failed:', error)
      return false
    }
  }
  
  /**
   * Get platform-specific system audio device preference order
   */
  private getSystemAudioPreferenceOrder(): string[] {
    const platform = navigator.platform.toLowerCase()
    
    if (platform.includes('win')) {
      return [
        'system_windows_wasapi',
        'system_windows_stereomix'
      ]
    } else if (platform.includes('mac')) {
      return [
        'system_macos_screencapturekit',
        'system_macos_blackhole'
      ]
    } else {
      return [
        'system_linux_pulse_monitor',
        'system_linux_alsa_loopback'
      ]
    }
  }

  /**
   * Start microphone capture with better device selection
   */
  async startMicrophoneCapture(deviceId?: string): Promise<boolean> {
    try {
      await this.initialize()
      
      const devices = await this.getAudioDevices()
      const micDevices = devices.filter(device => !device.is_system)
      
      if (micDevices.length === 0) {
        console.error('No microphone devices found')
        return false
      }
      
      let targetDevice: AudioDevice | undefined
      
      if (deviceId) {
        // Try to find the specific device requested
        targetDevice = devices.find(device => device.id === deviceId)
        if (!targetDevice) {
          console.warn(`Requested device ${deviceId} not found, using default`);
        }
      }
      
      console.log('🎤 Available microphone devices:')
      micDevices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.name} (${device.id})`)
      })
      
      // Try devices in order of preference
      let devicesToTry: AudioDevice[] = []
      
      if (targetDevice) {
        devicesToTry.push(targetDevice)
      }
      
      // Add all other microphones as fallbacks
      micDevices.forEach(device => {
        if (!devicesToTry.find(d => d.id === device.id)) {
          devicesToTry.push(device)
        }
      })
      
      // Try each device until one works
      for (const device of devicesToTry) {
        console.log('🎤 Trying microphone:', device.name)
        
        try {
          const success = await this.startAudioCapture(device.id)
          if (success) {
            console.log('✅ Microphone capture started with:', device.name)
            return true
          } else {
            console.warn('⚠️ Failed to start microphone with:', device.name, '- trying next device')
          }
        } catch (error) {
          console.warn('⚠️ Error with microphone:', device.name, '-', error, '- trying next device')
        }
      }
      
      console.error('❌ All microphone devices failed to start')
      return false
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
      console.log('🛑 Stopping all audio capture...')
      console.log('🔍 Current state before stop:', {
        isRecording: this.isRecording,
        usingMultiAudio: this.usingMultiAudio,
        activeSources: this.activeSources,
        activeDevices: this.activeDevices
      })
      
      if (this.usingMultiAudio) {
        console.log('🛑 Calling stop_multi_recording...')
        await invoke('stop_multi_recording')
        console.log('✅ stop_multi_recording completed')
        this.activeSources = []
        this.usingMultiAudio = false
      } else {
        console.log('🛑 Calling stop_audio_capture...')
        await invoke('stop_audio_capture')
        console.log('✅ stop_audio_capture completed')
        this.activeDevices = []
      }
      
      this.isRecording = false
      this.stopStatusPolling()
      
      console.log('✅ Audio capture stopped successfully')
      console.log('🔍 Final state after stop:', {
        isRecording: this.isRecording,
        usingMultiAudio: this.usingMultiAudio,
        activeSources: this.activeSources,
        activeDevices: this.activeDevices
      })
      
    } catch (error) {
      console.error('❌ Failed to stop capture:', error)
      
      // Force cleanup on error
      this.isRecording = false
      this.usingMultiAudio = false
      this.activeSources = []
      this.activeDevices = []
      this.stopStatusPolling()
      
      console.log('🚨 Force cleaned up state after error')
    }
  }

  /**
   * Start dual device capture (microphone + system audio) using native Tauri
   */
  async startDualDeviceCapture(): Promise<boolean> {
    try {
      console.log('🎙️ Starting dual device capture with native Tauri...')
      
      // Discover available audio sources
      const sources = await this.discoverAudioSources()
      
      // Find available sources
      const microphoneSources = sources.filter(s => s.device_type === 'Microphone')
      const systemAudioSource = sources.find(s => s.device_type === 'SystemAudio' && s.is_active)
      
      console.log('🎤 Available microphone sources:')
      microphoneSources.forEach((source, index) => {
        const status = source.is_active ? '✅ ACTIVE' : '❌ INACTIVE'
        console.log(`  ${index + 1}. ${source.name} - ${status}`)
      })
      
      if (microphoneSources.length === 0) {
        console.error('❌ No microphone sources found at all')
        return false
      }
      
      // Try microphones in order of preference (active first, then any available)
      const microphonesToTry = [
        ...microphoneSources.filter(s => s.is_active),
        ...microphoneSources.filter(s => !s.is_active)
      ]
      
      let successfulMicrophone: AudioSource | null = null
      
      // Try each microphone until one works
      for (const micSource of microphonesToTry) {
        console.log('🎤 Trying microphone source:', micSource.name)
        
        const sourceIds = [micSource.id]
        if (systemAudioSource) {
          sourceIds.push(systemAudioSource.id)
          console.log('  + Including system audio source:', systemAudioSource.name)
        }
        
        try {
          // Start multi-source recording
          await invoke('start_multi_recording', { sourceIds })
          
          // If we get here, it worked
          successfulMicrophone = micSource
          console.log('✅ Multi-source recording started successfully with:', micSource.name)
          break
          
        } catch (error) {
          console.warn('⚠️ Failed to start with microphone:', micSource.name, '-', error)
          console.log('  Trying next microphone...')
        }
      }
      
      if (!successfulMicrophone) {
        console.error('❌ All microphone sources failed to start')
        return false
      }
      
      // Record the final successful configuration
      const finalSourceIds = [successfulMicrophone.id]
      if (systemAudioSource) {
        finalSourceIds.push(systemAudioSource.id)
      }
      
      this.isRecording = true
      this.usingMultiAudio = true
      this.activeSources = finalSourceIds
      
      // Start polling for recording status
      this.startStatusPolling()
      
      console.log(`✅ Dual device capture started with ${finalSourceIds.length} sources`)
      return true
      
    } catch (error) {
      console.error('❌ Failed to start dual device capture:', error)
      return false
    }
  }

  /**
   * Get mixed audio buffer from all active sources
   */
  async getMixedAudioBuffer(): Promise<number[]> {
    try {
      if (!this.usingMultiAudio) {
        throw new Error('Multi-audio recording not active')
      }
      
      const buffer = await invoke<number[]>('get_mixed_audio_buffer')
      return buffer
    } catch (error) {
      console.error('Failed to get mixed audio buffer:', error)
      return []
    }
  }

  /**
   * Get audio buffer from a specific source
   */
  async getSourceAudioBuffer(sourceId: string): Promise<number[]> {
    try {
      const buffer = await invoke<number[]>('get_source_audio_buffer', { sourceId })
      return buffer
    } catch (error) {
      console.error('Failed to get source audio buffer:', error)
      return []
    }
  }

  /**
   * Get real-time audio levels for microphone
   */
  async getMicrophoneLevel(): Promise<number> {
    try {
      if (!this.usingMultiAudio) {
        return 0
      }
      const level = await invoke<number>('get_microphone_level')
      return Math.max(0, Math.min(1, level)) // Clamp between 0-1
    } catch (error) {
      // console.warn('Failed to get microphone level:', error)
      return 0
    }
  }

  /**
   * Get real-time audio levels for system audio
   */
  async getSystemAudioLevel(): Promise<number> {
    try {
      if (!this.usingMultiAudio) {
        return 0
      }
      const level = await invoke<number>('get_system_audio_level')
      return Math.max(0, Math.min(1, level)) // Clamp between 0-1
    } catch (error) {
      // console.warn('Failed to get system audio level:', error)
      return 0
    }
  }

  /**
   * Force stop all audio capture (emergency method)
   */
  async forceStopCapture(): Promise<void> {
    console.log('🚨 FORCE STOPPING all audio capture...')
    
    try {
      // Try all possible stop commands
      const stopPromises = []
      
      if (this.usingMultiAudio) {
        console.log('🚨 Force calling stop_multi_recording...')
        stopPromises.push(invoke('stop_multi_recording').catch(e => console.warn('Force stop_multi_recording failed:', e)))
      }
      
      if (this.activeDevices.length > 0) {
        console.log('🚨 Force calling stop_audio_capture...')
        stopPromises.push(invoke('stop_audio_capture').catch(e => console.warn('Force stop_audio_capture failed:', e)))
      }
      
      // Also try the generic stop command
      console.log('🚨 Force calling generic stop commands...')
      stopPromises.push(invoke('stop_recording').catch(e => console.warn('Force stop_recording failed:', e)))
      
      // Wait for all stop attempts (max 3 seconds)
      await Promise.race([
        Promise.allSettled(stopPromises),
        new Promise(resolve => setTimeout(resolve, 3000))
      ])
      
    } catch (error) {
      console.error('🚨 Force stop encountered errors:', error)
    }
    
    // Always clean up state regardless of Tauri response
    this.isRecording = false
    this.usingMultiAudio = false
    this.activeSources = []
    this.activeDevices = []
    this.stopStatusPolling()
    
    console.log('🚨 Force stop completed - state cleaned up')
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