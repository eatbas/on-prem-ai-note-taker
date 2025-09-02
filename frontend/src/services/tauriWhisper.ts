/**
 * Local Tauri Whisper Service
 * 
 * This service uses the Tauri Whisper commands directly instead of the remote VPS API.
 * Provides offline-first transcription and summarization using local AI models.
 */

import { invoke } from '@tauri-apps/api/core'

export interface TauriTranscriptionResult {
  transcript: string
  language: string
  confidence: number
  duration?: number
}

export interface TauriSummaryResult {
  summary: string
  keyPoints: string[]
  speakers?: SpeakerInfo[]
}

export interface SpeakerInfo {
  id: string
  name: string
  segments: Array<{
    start: number
    end: number
    text: string
  }>
}

export interface LocalProcessingResult {
  transcript: {
    text: string
    language: string
    confidence: number
  }
  summary: string
  speakers?: SpeakerInfo[]
  processing_time_ms: number
}

export class TauriWhisperService {
  private static instance: TauriWhisperService
  private isInitialized = false

  static getInstance(): TauriWhisperService {
    if (!this.instance) {
      this.instance = new TauriWhisperService()
    }
    return this.instance
  }

  /**
   * Initialize the Whisper service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Tauri Whisper service already initialized')
      return
    }

    try {
      console.log('🤖 Initializing local Tauri Whisper service...')
      
      // First check if we're in a Tauri environment
      if (typeof window === 'undefined' || !(window as any).__TAURI__) {
        console.warn('⚠️ Tauri Whisper service not available - not running in Tauri environment')
        throw new Error('Not running in Tauri environment')
      }

      await invoke('initialize_whisper')
      console.log('✅ Tauri Whisper service initialized successfully')
      this.isInitialized = true
    } catch (error) {
      console.warn('⚠️ Failed to initialize Tauri Whisper service:', error)
      // Don't log full error details for expected failures in web environment
      if (error instanceof Error && error.message.includes('Tauri environment')) {
        throw error
      }
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw new Error(`Failed to initialize Whisper: ${error}`)
    }
  }

  /**
   * Convert audio file to float32 array for Whisper processing
   */
  private async audioFileToFloat32Array(file: File): Promise<{ audioData: Float32Array, sampleRate: number }> {
    console.log('🎵 Converting audio file to Float32Array...')
    
    return new Promise((resolve, reject) => {
      const audioContext = new AudioContext()
      const fileReader = new FileReader()

      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          
          // Get first channel (mono)
          const audioData = audioBuffer.getChannelData(0)
          const sampleRate = audioBuffer.sampleRate
          
          console.log(`✅ Audio converted: ${audioData.length} samples at ${sampleRate}Hz`)
          resolve({ audioData, sampleRate })
        } catch (error) {
          console.error('❌ Audio conversion failed:', error)
          reject(error)
        }
      }

      fileReader.onerror = () => {
        reject(new Error('Failed to read audio file'))
      }

      fileReader.readAsArrayBuffer(file)
    })
  }

  /**
   * Transcribe audio file using local Tauri Whisper
   */
  async transcribeAudio(file: File, language?: string): Promise<TauriTranscriptionResult> {
    await this.initialize()

    try {
      console.log(`🎤 Transcribing audio file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      
      // Convert audio file to format Whisper expects
      const { audioData, sampleRate } = await this.audioFileToFloat32Array(file)
      
      // Convert Float32Array to regular array for Tauri
      const audioArray = Array.from(audioData)
      
      // Call Tauri Whisper transcription
      const transcript = await invoke('transcribe_audio_with_language', {
        audioData: audioArray,
        sampleRate,
        language: language || 'auto'
      }) as string

      console.log('✅ Local transcription completed')
      
      return {
        transcript,
        language: language || 'auto',
        confidence: 0.85, // Placeholder - Tauri doesn't return confidence yet
        duration: audioData.length / sampleRate
      }
    } catch (error) {
      console.error('❌ Local transcription failed:', error)
      throw new Error(`Transcription failed: ${error}`)
    }
  }

  /**
   * Get formatted transcript with speaker diarization
   */
  async getFormattedTranscript(file: File, language?: string): Promise<any> {
    await this.initialize()

    try {
      console.log('🎯 Getting formatted transcript with speaker diarization...')
      
      const { audioData, sampleRate } = await this.audioFileToFloat32Array(file)
      const audioArray = Array.from(audioData)
      
      const result = await invoke('get_formatted_transcript_for_ai', {
        audioData: audioArray,
        sampleRate,
        language: language || 'auto'
      })
      
      console.log('✅ Formatted transcript with speakers completed')
      return result
    } catch (error) {
      console.error('❌ Formatted transcript failed:', error)
      throw new Error(`Formatted transcript failed: ${error}`)
    }
  }

  /**
   * Complete transcription and summarization pipeline (local)
   */
  async transcribeAndSummarize(file: File, options?: { language?: string }): Promise<LocalProcessingResult> {
    const startTime = Date.now()
    
    try {
      console.log('🚀 Starting local transcription and summarization pipeline...')
      
      // Step 1: Transcribe with speaker diarization
      const transcriptionResult = await this.getFormattedTranscript(file, options?.language)
      
      // Step 2: Generate a basic summary (could be enhanced with local AI)
      const summary = this.generateBasicSummary(transcriptionResult.formatted_output)
      
      const processingTime = Date.now() - startTime
      
      const result: LocalProcessingResult = {
        transcript: {
          text: transcriptionResult.formatted_output,
          language: transcriptionResult.detected_language || options?.language || 'auto',
          confidence: transcriptionResult.confidence || 0.85
        },
        summary,
        processing_time_ms: processingTime
      }
      
      console.log(`✅ Local processing completed in ${(processingTime / 1000).toFixed(2)}s`)
      return result
      
    } catch (error) {
      console.error('❌ Local processing pipeline failed:', error)
      throw error
    }
  }

  /**
   * Generate a basic summary from transcript
   * TODO: Replace with local AI model (Ollama integration)
   */
  private generateBasicSummary(transcript: string): string {
    if (!transcript || transcript.length < 100) {
      return "Brief meeting - insufficient content for detailed summary."
    }

    const lines = transcript.split('\n').filter(line => line.trim())
    const wordCount = transcript.split(' ').length
    const estimatedDuration = Math.ceil(wordCount / 150) // ~150 words per minute speaking rate
    
    const keyPhrases = [
      'decided', 'agreed', 'action item', 'next steps', 'deadline', 
      'responsible', 'task', 'follow up', 'meeting', 'discussion'
    ]
    
    const importantLines = lines.filter(line => 
      keyPhrases.some(phrase => line.toLowerCase().includes(phrase))
    ).slice(0, 5)
    
    let summary = `📋 Meeting Summary\n\n`
    summary += `📊 Stats: ~${estimatedDuration} minutes, ${lines.length} dialogue segments\n\n`
    
    if (importantLines.length > 0) {
      summary += `🎯 Key Points:\n`
      importantLines.forEach(line => {
        summary += `• ${line.trim()}\n`
      })
    } else {
      summary += `💬 Discussion Topics:\n`
      lines.slice(0, 3).forEach(line => {
        summary += `• ${line.trim().substring(0, 100)}...\n`
      })
    }
    
    summary += `\n💡 Note: This is a basic summary. For AI-powered detailed summaries, consider upgrading to the full AI model.`
    
    return summary
  }

  /**
   * Check if local Whisper is available and ready
   */
  async checkCapabilities(): Promise<any> {
    try {
      const capabilities = await invoke('check_offline_capabilities')
      console.log('🔍 Local Whisper capabilities:', capabilities)
      return capabilities
    } catch (error) {
      console.error('❌ Failed to check capabilities:', error)
      throw error
    }
  }

  /**
   * Get available Whisper models
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      const models = await invoke('get_model_info') as any[]
      console.log('📋 Available Whisper models:', models)
      return models
    } catch (error) {
      console.error('❌ Failed to get models:', error)
      return []
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<Array<[string, string]>> {
    try {
      const languages = await invoke('get_supported_languages') as Array<[string, string]>
      console.log('🌍 Supported languages:', languages)
      return languages
    } catch (error) {
      console.error('❌ Failed to get languages:', error)
      return [['auto', 'Auto-detect'], ['en', 'English'], ['tr', 'Turkish']]
    }
  }

  /**
   * Test local processing with a small audio chunk
   */
  async testLocalProcessing(): Promise<boolean> {
    try {
      console.log('🧪 Testing local Whisper processing...')
      
      // Check if we're in Tauri environment first
      if (typeof window === 'undefined' || !(window as any).__TAURI__) {
        console.log('⚠️ Not running in Tauri environment - local processing not available')
        return false
      }
      
      // First ensure we're initialized
      await this.initialize()
      
      // Create a small test audio array (1 second of silence)
      const testAudio = new Array(16000).fill(0) // 1 second at 16kHz
      
      console.log('🔊 Testing with audio data:', testAudio.length, 'samples')
      
      const result = await invoke('transcribe_audio_data', {
        audioData: testAudio,
        sampleRate: 16000
      }) as string
      
      console.log('✅ Local processing test successful. Result:', result)
      return true
    } catch (error) {
      // Don't log as error if it's just environment issue
      if (error instanceof Error && error.message.includes('Tauri environment')) {
        console.log('ℹ️ Local processing test skipped - not in Tauri environment')
        return false
      }
      
      console.error('❌ Local processing test failed:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // Try to get more specific error information
      try {
        const capabilities = await invoke('check_offline_capabilities')
        console.log('🔍 System capabilities:', capabilities)
      } catch (capError) {
        console.error('❌ Could not check capabilities:', capError)
      }
      
      return false
    }
  }
}

// Export singleton instance
export const tauriWhisperService = TauriWhisperService.getInstance()

// Export convenience functions
export async function transcribeAudioLocally(file: File, language?: string): Promise<TauriTranscriptionResult> {
  return tauriWhisperService.transcribeAudio(file, language)
}

export async function processAudioLocally(file: File, options?: { language?: string }): Promise<LocalProcessingResult> {
  return tauriWhisperService.transcribeAndSummarize(file, options)
}

export async function checkLocalCapabilities(): Promise<any> {
  return tauriWhisperService.checkCapabilities()
}
