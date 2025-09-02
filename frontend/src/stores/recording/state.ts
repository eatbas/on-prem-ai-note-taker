/**
 * Recording State Management
 * Handles localStorage persistence and state updates
 */

import type { GlobalRecordingState, StateListener } from './types'

export class RecordingStateManager {
	private state: GlobalRecordingState = {
		isRecording: false,
		meetingId: null,
		recordingTime: 0,
		chunkIndex: 0,
		recordingInterval: null,
		startTime: null,
		// Simplified single-stream audio recording state
		micStream: null,
		micRecorder: null,
		micChunkIndex: 0,
		forceDataInterval: null,
		error: null,
		language: 'auto'
	}

	private listeners: Set<StateListener> = new Set()

	constructor() {
		// Restore state from localStorage on initialization
		this.restoreState()
		
		// Handle page unload
		window.addEventListener('beforeunload', () => {
			if (this.state.isRecording) {
				this.saveState()
			}
		})

		// Handle page visibility change
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				this.restoreState()
			}
		})

		// Handle window resize events (common cause of stream interruption in Electron)
		window.addEventListener('resize', () => {
			// Small delay to let the resize complete
			setTimeout(() => {
				if (this.isRecordingInterrupted()) {
					console.log('🔄 Recording interrupted after window resize')
				}
			}, 500)
		})
	}

	// Get current recording state (immutable copy)
	getState(): GlobalRecordingState {
		return { ...this.state }
	}

	// Update state properties
	updateState(updates: Partial<GlobalRecordingState>): void {
		Object.assign(this.state, updates)
		this.notifyListeners()
	}

	// Set error state
	setError(error: string | null): void {
		this.state.error = error
		this.notifyListeners()
	}

	// Clear error state
	clearError(): void {
		this.state.error = null
		this.notifyListeners()
	}

	// Subscribe to state changes
	subscribe(listener: StateListener): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	// Notify all listeners of state changes
	notifyListeners(): void {
		const state = this.getState()
		console.log('🔔 Recording State: Notifying listeners of state change:', {
			isRecording: state.isRecording,
			meetingId: state.meetingId ? state.meetingId.slice(0, 8) + '...' : 'none',
			recordingTime: state.recordingTime,
			listenerCount: this.listeners.size
		})
		this.listeners.forEach(listener => listener(state))
	}

	// Check if recording was interrupted (restored from localStorage without active streams)
	isRecordingInterrupted(): boolean {
		return this.state.isRecording && !this.state.micRecorder
	}

	// Get interrupted recording info
	getInterruptedRecordingInfo(): { meetingId: string; recordingTime: number } | null {
		if (this.isRecordingInterrupted()) {
			return {
				meetingId: this.state.meetingId!,
				recordingTime: this.state.recordingTime
			}
		}
		return null
	}

	// Save state to localStorage
	saveState(): void {
		if (this.state.isRecording && this.state.meetingId) {
			const persistentState = {
				isRecording: this.state.isRecording,
				meetingId: this.state.meetingId,
				recordingTime: this.state.recordingTime,
				chunkIndex: this.state.chunkIndex,
				startTime: this.state.startTime,
				micChunkIndex: this.state.micChunkIndex,
				language: this.state.language
			}
			localStorage.setItem('globalRecordingState', JSON.stringify(persistentState))
			console.log('📱 Saved recording state to localStorage:', persistentState)
		}
	}

	// Restore state from localStorage
	private restoreState(): void {
		try {
			const saved = localStorage.getItem('globalRecordingState')
			if (saved) {
				const persistentState = JSON.parse(saved)
				console.log('📱 Restored recording state from localStorage:', persistentState)
				
				// Update state but don't restore media streams/recorders (they need to be recreated)
				this.state.isRecording = persistentState.isRecording
				this.state.meetingId = persistentState.meetingId
				this.state.recordingTime = persistentState.recordingTime
				this.state.chunkIndex = persistentState.chunkIndex
				this.state.startTime = persistentState.startTime
				this.state.micChunkIndex = persistentState.micChunkIndex || 0
				this.state.language = persistentState.language || 'auto'
				
				// Notify listeners of restored state
				this.notifyListeners()
				
				// If we restored a recording state, inform about potential interruption
				if (this.state.isRecording) {
					console.log('🔄 Recording state restored - media streams will be recreated automatically')
					console.log('ℹ️ This is normal when resizing the app or navigating between pages')
				}
			}
		} catch (err) {
			console.error('Failed to restore recording state:', err)
		}
	}

	// Clear saved state from localStorage
	clearSavedState(): void {
		localStorage.removeItem('globalRecordingState')
		console.log('🧹 Cleared saved recording state')
	}

	// Check if there's a saved recording state from app closure
	hasSavedRecordingState(): boolean {
		try {
			const saved = localStorage.getItem('globalRecordingState')
			if (saved) {
				const persistentState = JSON.parse(saved)
				return persistentState.isRecording && persistentState.meetingId
			}
		} catch (err) {
			console.error('Failed to check saved recording state:', err)
		}
		return false
	}

	// Reset state completely
	resetState(): void {
		this.state.isRecording = false
		this.state.meetingId = null
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.recordingInterval = null
		this.state.startTime = null
		this.state.micStream = null
		this.state.micRecorder = null
		this.state.micChunkIndex = 0
		this.state.forceDataInterval = null
		this.state.error = null
		this.notifyListeners()
	}

	// Clear interrupted recording state
	clearInterruptedState(): void {
		console.log('🧹 Clearing interrupted recording state')
		this.clearSavedState()
		this.resetState()
	}

	// Force cleanup (for component unmount)
	cleanup(): void {
		console.log('🧹 Recording State Manager: Cleanup called')
		// Just clean up listeners - don't stop recording
		this.listeners.clear()
	}

	// Reset system audio disabled flag (for troubleshooting)
	resetSystemAudioDisabled(): void {
		localStorage.removeItem('systemAudioDisabled')
		console.log('🔄 System audio capture re-enabled')
	}

	// Check if system audio is disabled
	isSystemAudioDisabled(): boolean {
		return localStorage.getItem('systemAudioDisabled') === 'true'
	}
}
