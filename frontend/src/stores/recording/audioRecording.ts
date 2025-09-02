/**
 * Audio Recording Management
 * Orchestrates audio capture and cleanup operations
 */

import { addChunk } from '../../services'
import type { RecordingOptions, GlobalRecordingState } from './types'
import { AudioCaptureManager } from './audioCapture'
import { AudioCleanupManager } from './audioCleanup'

export class AudioRecordingManager {
	private captureManager = new AudioCaptureManager()
	private cleanupManager = new AudioCleanupManager()
	private audioContext: AudioContext | null = null

	// Start simplified single-stream audio recording
	async startAudioRecording(
		options: RecordingOptions, 
		state: GlobalRecordingState,
		onDataAvailable: (event: BlobEvent) => Promise<void>,
		setState: (updates: Partial<GlobalRecordingState>) => void
	): Promise<boolean> {
		try {
			console.log('🎙️ Starting simplified audio recording with options:', options)
			
			// Safety check: If system audio is disabled, log it clearly
			if (localStorage.getItem('systemAudioDisabled') === 'true') {
				console.log('ℹ️ System audio is disabled - will use microphone only')
			}

			// Proactively release monitoring streams from MicrophoneSelector to avoid device busy errors
			await this.preStartCleanup()
			
			// Try to capture system (desktop) audio
			const systemStream = await this.captureManager.captureSystemAudio()
			
			// Always capture microphone
			console.log('🎤 Ensuring microphone capture...')
			const micStream = await this.captureManager.captureMicrophone(options)
			
			// Create final mixed stream
			const { stream: finalStream, audioContext } = this.captureManager.createMixedStream(systemStream, micStream)
			this.audioContext = audioContext
			
			// Create and setup MediaRecorder
			const recorder = this.captureManager.createMediaRecorder(finalStream, onDataAvailable)
			
			// Persist media references in global state (getState() returns a copy)
			setState({ micStream: finalStream, micRecorder: recorder })
			
			// Start recording with reasonable chunk size
			const chunkMs = 1000  // 1 second chunks
			console.log(`🎙️ Starting single-stream recording with ${chunkMs}ms chunks`)
			recorder.start(chunkMs)
			
			// Simple backup data capture
			const forceDataInterval = window.setInterval(() => {
				if (recorder.state === 'recording') {
					recorder.requestData()
				}
			}, 5000)
			setState({ forceDataInterval })
			
			console.log('✅ Simplified audio recording started successfully')
			return true
			
		} catch (error) {
			console.error('❌ Failed to start simplified audio recording:', error)
			
			// Emergency cleanup if startup failed
			try {
				if (state.micStream) {
					state.micStream.getTracks().forEach(track => track.stop())
					state.micStream = null
				}
				if (this.audioContext) {
					this.audioContext.close()
					this.audioContext = null
				}
			} catch (cleanupError) {
				console.warn('⚠️ Error during startup cleanup:', cleanupError)
			}
			
			return false
		}
	}

	// Stop audio recording with proper cleanup
	async stopAudioRecording(state: GlobalRecordingState): Promise<void> {
		// First stop the recorder/streams cleanly. Closing the AudioContext before
		// the MediaRecorder stops can cause the 'stop' event to hang in Electron.
		await this.cleanupManager.stopAudioRecording(state)

		// Now close mixed AudioContext if present
		if (this.audioContext) {
			try {
				await this.audioContext.close()
				this.audioContext = null
				console.log('🗑️ Closed AudioContext')
			} catch (e) {
				console.warn('⚠️ Failed closing AudioContext:', e)
			}
		}
	}

	// Force stop recording (for emergencies)
	forceStopRecording(state: GlobalRecordingState): void {
		// Close AudioContext immediately
		if (this.audioContext) {
			try {
				this.audioContext.close()
				this.audioContext = null
			} catch (e) {
				console.warn('⚠️ Failed force closing AudioContext:', e)
			}
		}

		// Delegate to cleanup manager
		this.cleanupManager.forceStopRecording(state)
	}

	// Pre-start cleanup to avoid device conflicts
	private async preStartCleanup(): Promise<void> {
		// Only attempt cleanup if the function exists and not already in progress
		if ((window as any).forceMicCleanup && 
			typeof (window as any).forceMicCleanup === 'function' && 
			!(window as any).micCleanupInProgress) {
			try {
				console.log('🧹 Pre-start: Releasing microphone monitoring streams...')
				;(window as any).micCleanupInProgress = true
				;(window as any).forceMicCleanup()
				await new Promise(resolve => setTimeout(resolve, 100))
				;(window as any).micCleanupInProgress = false
			} catch (cleanupErr) {
				console.warn('⚠️ Pre-start mic cleanup failed:', cleanupErr)
				;(window as any).micCleanupInProgress = false
			}
		} else if ((window as any).micCleanupInProgress) {
			console.log('🔄 Mic cleanup already in progress, waiting...')
			await new Promise(resolve => setTimeout(resolve, 200))
		}
	}

	// Static helper to create data available handler
	static createDataAvailableHandler(
		meetingId: string,
		micChunkIndex: { value: number },
		onError: (error: string) => void
	): (event: BlobEvent) => Promise<void> {
		return async (event: BlobEvent) => {
			console.log(`🎤 Mic data available: ${event.data?.size || 0} bytes`)
			
			if (event.data && event.data.size > 0 && meetingId) {
				try {
					console.log(`💾 Saving mic chunk ${micChunkIndex.value} with meetingId: ${meetingId}`)
					await addChunk(
						meetingId, 
						event.data, 
						micChunkIndex.value, 
						'microphone'
					)
					console.log(`✅ Mic chunk ${micChunkIndex.value} saved: ${event.data.size} bytes`)
					micChunkIndex.value++
				} catch (error) {
					console.error('❌ Failed to save mic chunk:', error)
					onError(`Failed to save audio: ${error}`)
				}
			} else {
				console.warn(`⚠️ Empty mic data: ${event.data?.size || 0} bytes, meetingId: ${meetingId}`)
			}
		}
	}
}