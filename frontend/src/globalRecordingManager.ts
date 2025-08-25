// Global recording manager to persist recording state across navigation
import { addChunk } from './offline'

interface GlobalRecordingState {
	isRecording: boolean
	meetingId: string | null
	mediaRecorder: MediaRecorder | null
	recordingTime: number
	chunkIndex: number
	recordingInterval: number | null
	startTime: number | null
}

class GlobalRecordingManager {
	private state: GlobalRecordingState = {
		isRecording: false,
		meetingId: null,
		mediaRecorder: null,
		recordingTime: 0,
		chunkIndex: 0,
		recordingInterval: null,
		startTime: null
	}

	private listeners: Set<(state: GlobalRecordingState) => void> = new Set()

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
	}

	private saveState() {
		if (this.state.isRecording && this.state.meetingId) {
			const persistentState = {
				isRecording: this.state.isRecording,
				meetingId: this.state.meetingId,
				recordingTime: this.state.recordingTime,
				chunkIndex: this.state.chunkIndex,
				startTime: this.state.startTime
			}
			localStorage.setItem('globalRecordingState', JSON.stringify(persistentState))
			console.log('📱 Saved recording state to localStorage:', persistentState)
		}
	}

	private restoreState() {
		try {
			const saved = localStorage.getItem('globalRecordingState')
			if (saved) {
				const persistentState = JSON.parse(saved)
				console.log('📱 Restored recording state from localStorage:', persistentState)
				
				// Update state but don't restore MediaRecorder (that needs to be recreated)
				this.state.isRecording = persistentState.isRecording
				this.state.meetingId = persistentState.meetingId
				this.state.recordingTime = persistentState.recordingTime
				this.state.chunkIndex = persistentState.chunkIndex
				this.state.startTime = persistentState.startTime
				
				// Notify listeners of restored state
				this.notifyListeners()
				
				// If we restored a recording state, warn user
				if (this.state.isRecording) {
					console.warn('🎙️ WARNING: Recording state restored but MediaRecorder needs to be recreated!')
					console.warn('Recording may have been interrupted by page refresh.')
				}
			}
		} catch (err) {
			console.error('Failed to restore recording state:', err)
		}
	}

	private clearSavedState() {
		localStorage.removeItem('globalRecordingState')
		console.log('🧹 Cleared saved recording state')
	}

	// Get current recording state
	getState(): GlobalRecordingState {
		return { ...this.state }
	}

	// Subscribe to state changes
	subscribe(listener: (state: GlobalRecordingState) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	// Notify all listeners of state changes
	private notifyListeners() {
		const state = this.getState()
		console.log('🔔 Global Recording Manager: Notifying listeners of state change:', {
			isRecording: state.isRecording,
			meetingId: state.meetingId?.slice(0, 8) + '...',
			recordingTime: state.recordingTime,
			listenerCount: this.listeners.size
		})
		this.listeners.forEach(listener => listener(state))
	}

	// Start recording with MediaRecorder instance
	startRecording(meetingId: string, mediaRecorder: MediaRecorder) {
		console.log('🎙️ Global Recording Manager: Starting recording for meeting:', meetingId)
		
		this.state.isRecording = true
		this.state.meetingId = meetingId
		this.state.mediaRecorder = mediaRecorder
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.startTime = Date.now()

		// Set up data handler
		mediaRecorder.ondataavailable = async (e: BlobEvent) => {
			if (e.data && e.data.size > 0) {
				await addChunk(meetingId, e.data, this.state.chunkIndex++)
				console.log(`📁 Global Recording Manager: Saved chunk ${this.state.chunkIndex - 1}`)
				// Save state after each chunk
				this.saveState()
			}
		}

		// Start recording timer
		this.state.recordingInterval = window.setInterval(() => {
			this.state.recordingTime += 1
			// Only notify listeners every 5 seconds to avoid performance issues
			if (this.state.recordingTime % 5 === 0) {
				this.notifyListeners()
			}
			// Save state every 10 seconds
			if (this.state.recordingTime % 10 === 0) {
				this.saveState()
			}
		}, 1000)

		// Save initial state
		this.saveState()
		this.notifyListeners()
	}

	// Stop recording
	stopRecording(): string | null {
		console.log('⏹️ Global Recording Manager: Stopping recording')
		
		if (this.state.mediaRecorder && this.state.mediaRecorder.state !== 'inactive') {
			this.state.mediaRecorder.stop()
			// Stop all tracks to release audio devices
			this.state.mediaRecorder.stream.getTracks().forEach(track => track.stop())
		}

		if (this.state.recordingInterval) {
			clearInterval(this.state.recordingInterval)
		}

		const meetingId = this.state.meetingId
		
		// Clear saved state
		this.clearSavedState()
		
		// Reset state
		this.state.isRecording = false
		this.state.meetingId = null
		this.state.mediaRecorder = null
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.recordingInterval = null
		this.state.startTime = null

		this.notifyListeners()
		return meetingId
	}

	// Check if currently recording
	isCurrentlyRecording(): boolean {
		return this.state.isRecording
	}

	// Get current meeting ID
	getCurrentMeetingId(): string | null {
		return this.state.meetingId
	}

	// Get recording time
	getRecordingTime(): number {
		return this.state.recordingTime
	}

	// Check if recording was interrupted (restored from localStorage without MediaRecorder)
	isRecordingInterrupted(): boolean {
		return this.state.isRecording && !this.state.mediaRecorder
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

	// Force cleanup (for component unmount)
	cleanup() {
		console.log('🧹 Global Recording Manager: Cleanup called')
		// Don't stop recording on cleanup - that's the whole point!
		// Just clean up listeners
		this.listeners.clear()
	}
}

// Export singleton instance
export const globalRecordingManager = new GlobalRecordingManager()
export type { GlobalRecordingState }
