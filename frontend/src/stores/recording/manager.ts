/**
 * Global Recording Manager
 * Main orchestrator that coordinates all recording components
 */

import type { 
	GlobalRecordingState, 
	RecordingOptions, 
	StartRecordingResult, 
	InterruptedRecordingInfo,
	StateListener 
} from './types'
import { RecordingStateManager } from './state'
import { AudioRecordingManager } from './audioRecording'
import { RecordingLifecycleManager } from './lifecycle'

export class GlobalRecordingManager {
	private stateManager: RecordingStateManager
	private audioManager: AudioRecordingManager
	private lifecycleManager: RecordingLifecycleManager

	constructor() {
		// Initialize all components
		this.stateManager = new RecordingStateManager()
		this.audioManager = new AudioRecordingManager()
		this.lifecycleManager = new RecordingLifecycleManager(this.stateManager, this.audioManager)

		// Add global error handler for recording-related errors
		this.setupGlobalErrorHandling()

		// Setup visibility change handler for auto-resume
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				// If recording was interrupted, try to resume automatically
				if (this.isRecordingInterrupted()) {
					console.log('🔄 Auto-resuming interrupted recording after visibility change...')
					this.attemptResumeRecording()
				}
			}
		})

		// Handle window resize events (common cause of stream interruption in Electron)
		window.addEventListener('resize', () => {
			// Small delay to let the resize complete
			setTimeout(() => {
				if (this.isRecordingInterrupted()) {
					console.log('🔄 Auto-resuming interrupted recording after window resize...')
					this.attemptResumeRecording()
				}
			}, 500)
		})
	}

	// Public API Methods - State Access
	getState(): GlobalRecordingState {
		return this.stateManager.getState()
	}

	subscribe(listener: StateListener): () => void {
		return this.stateManager.subscribe(listener)
	}

	// Public API Methods - Recording Control
	async startRecording(options: RecordingOptions): Promise<StartRecordingResult> {
		return this.lifecycleManager.startRecording(options)
	}

	async stopRecording(): Promise<string | null> {
		return this.lifecycleManager.stopRecording()
	}

	async attemptResumeRecording(options?: Partial<RecordingOptions>): Promise<boolean> {
		return this.lifecycleManager.attemptResumeRecording(options)
	}

	forceStopRecording(): void {
		this.lifecycleManager.forceStopRecording()
	}

	// Public API Methods - State Queries
	isCurrentlyRecording(): boolean {
		return this.stateManager.getState().isRecording
	}

	getCurrentMeetingId(): string | null {
		return this.stateManager.getState().meetingId
	}

	getRecordingTime(): number {
		return this.stateManager.getState().recordingTime
	}

	getError(): string | null {
		return this.stateManager.getState().error
	}

	hasMicStream(): boolean {
		return !!this.stateManager.getState().micStream
	}

	// Public API Methods - Interruption Handling
	isRecordingInterrupted(): boolean {
		return this.stateManager.isRecordingInterrupted()
	}

	getInterruptedRecordingInfo(): InterruptedRecordingInfo | null {
		return this.stateManager.getInterruptedRecordingInfo()
	}

	clearInterruptedState(): void {
		this.stateManager.clearInterruptedState()
	}

	// Public API Methods - Persistence
	saveCurrentState(): void {
		this.lifecycleManager.saveCurrentState()
	}

	hasSavedRecordingState(): boolean {
		return this.stateManager.hasSavedRecordingState()
	}

	// Public API Methods - System Audio Control
	resetSystemAudioDisabled(): void {
		this.stateManager.resetSystemAudioDisabled()
	}

	isSystemAudioDisabled(): boolean {
		return this.stateManager.isSystemAudioDisabled()
	}

	// Public API Methods - Error Handling
	setError(error: string | null): void {
		this.stateManager.setError(error)
	}

	clearError(): void {
		this.stateManager.clearError()
	}

	// Public API Methods - Cleanup
	cleanup(): void {
		console.log('🧹 Global Recording Manager: Cleanup called')
		// Don't stop recording on cleanup - that's the whole point!
		// Just clean up listeners
		this.stateManager.cleanup()
	}

	// Setup global error handling for recording operations
	private setupGlobalErrorHandling(): void {
		// Handle unhandled promise rejections related to recording
		window.addEventListener('unhandledrejection', (event) => {
			const error = event.reason
			if (error && typeof error === 'object') {
				const errorMessage = error.message || error.toString()
				const isRecordingError = errorMessage.includes('recording') ||
										errorMessage.includes('microphone') ||
										errorMessage.includes('audio') ||
										errorMessage.includes('MediaRecorder') ||
										errorMessage.includes('getUserMedia') ||
										errorMessage.includes('getDisplayMedia')

				if (isRecordingError) {
					console.error('🚨 Unhandled recording error:', error)
					event.preventDefault() // Prevent app crash
					
					// Set error state but don't crash
					this.stateManager.setError(`Recording error: ${errorMessage}`)
					
					// If actively recording, attempt graceful recovery
					if (this.isCurrentlyRecording()) {
						console.log('🔄 Attempting graceful recovery from recording error...')
						setTimeout(() => {
							this.forceStopRecording()
						}, 1000)
					}
				}
			}
		})

		// Handle general errors that might affect recording
		window.addEventListener('error', (event) => {
			const error = event.error
			if (error && typeof error === 'object') {
				const errorMessage = error.message || error.toString()
				const isRecordingError = errorMessage.includes('recording') ||
										errorMessage.includes('microphone') ||
										errorMessage.includes('audio')

				if (isRecordingError) {
					console.error('🚨 Recording-related error:', error)
					this.stateManager.setError(`Recording error: ${errorMessage}`)
				}
			}
		})
	}
}
