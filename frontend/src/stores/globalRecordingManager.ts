// Global recording manager to persist recording state across navigation
import { addChunk } from '../services'

interface GlobalRecordingState {
	isRecording: boolean
	meetingId: string | null
	mediaRecorder: MediaRecorder | null
	recordingTime: number
	chunkIndex: number
	recordingInterval: number | null
	startTime: number | null
	dataRequestInterval?: number | null
}

class GlobalRecordingManager {
	private state: GlobalRecordingState = {
		isRecording: false,
		meetingId: null,
		mediaRecorder: null,
		recordingTime: 0,
		chunkIndex: 0,
		recordingInterval: null,
		startTime: null,
		dataRequestInterval: null
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
		
		// Clear any previous saved recording state when starting new recording
		this.clearSavedState()
		
		this.state.isRecording = true
		this.state.meetingId = meetingId
		this.state.mediaRecorder = mediaRecorder
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.startTime = Date.now()

		// Set up data handler
		mediaRecorder.ondataavailable = async (e: BlobEvent) => {
			console.log('🎵 MediaRecorder ondataavailable event fired:', {
				hasData: !!e.data,
				dataSize: e.data?.size || 0,
				currentChunkIndex: this.state.chunkIndex,
				meetingId: meetingId.slice(0, 8) + '...'
			})
			
			if (e.data && e.data.size > 0) {
				try {
					// For now, use 'mixed' audioType for backward compatibility
					// This will be updated when dual recording is fully implemented
					await addChunk(meetingId, e.data, this.state.chunkIndex++, 'mixed')
					console.log(`📁 Global Recording Manager: Successfully saved chunk ${this.state.chunkIndex - 1} (${e.data.size} bytes)`)
					// Save state after each chunk
					this.saveState()
				} catch (error) {
					console.error(`❌ Failed to save chunk ${this.state.chunkIndex}:`, error)
				}
			} else {
				console.warn('⚠️ ondataavailable fired but no valid data:', {
					hasData: !!e.data,
					dataSize: e.data?.size || 0
				})
			}
		}

		// Start recording timer
		this.state.recordingInterval = window.setInterval(() => {
			this.state.recordingTime += 1
			console.log('⏱️ Global Recording Manager: Timer tick - recording time:', this.state.recordingTime)
			// Notify listeners every second for real-time timer updates
			this.notifyListeners()
			// Save state every 10 seconds
			if (this.state.recordingTime % 10 === 0) {
				this.saveState()
			}
		}, 1000)

		// Safety: periodically force data flush in case timeslice is ignored by platform
		try {
			const fallbackMs = 10000
			this.state.dataRequestInterval = window.setInterval(() => {
				try {
					if (this.state.mediaRecorder && this.state.mediaRecorder.state === 'recording') {
						this.state.mediaRecorder.requestData()
					}
				} catch {}
			}, fallbackMs)
		} catch {}

		// Save initial state
		this.saveState()
		this.notifyListeners()
	}

	// Stop recording
	stopRecording(): string | null {
		console.log('⏹️ Global Recording Manager: Stopping recording')
		
		if (this.state.mediaRecorder && this.state.mediaRecorder.state !== 'inactive') {
			const recorder = this.state.mediaRecorder
			const stream = recorder.stream
			// Ensure the final dataavailable fires before releasing tracks
			try { recorder.requestData() } catch {}
			// Release tracks only after recorder has fully stopped
			recorder.addEventListener('stop', () => {
				try { stream.getTracks().forEach(track => track.stop()) } catch {}
			}, { once: true })
			recorder.stop()
		}

		if (this.state.recordingInterval) {
			clearInterval(this.state.recordingInterval)
		}
		if (this.state.dataRequestInterval) {
			clearInterval(this.state.dataRequestInterval)
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
		this.state.dataRequestInterval = null

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

	// Clear interrupted recording state
	clearInterruptedState(): void {
		console.log('🧹 Clearing interrupted recording state')
		this.clearSavedState()
		this.state.isRecording = false
		this.state.meetingId = null
		this.state.mediaRecorder = null
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.recordingInterval = null
		this.state.startTime = null
		this.notifyListeners()
	}

	// Attempt to resume interrupted recording
	async attemptResumeRecording(): Promise<boolean> {
		if (!this.isRecordingInterrupted()) {
			console.log('🎙️ No interrupted recording to resume')
			return false
		}

		try {
			console.log('🎙️ Attempting to resume interrupted recording...')
			
			// Request audio permissions again
			const stream = await navigator.mediaDevices.getUserMedia({ 
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			})

			// Create new MediaRecorder
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus'
			})

			// Set up event handlers
			mediaRecorder.ondataavailable = async (e) => {
				if (e.data && e.data.size > 0 && this.state.meetingId) {
					await addChunk(this.state.meetingId, e.data, this.state.chunkIndex++, 'mixed')
					console.log(`📁 Global Recording Manager: Saved chunk ${this.state.chunkIndex - 1}`)
					this.saveState()
				}
			}

			// Start recording
			mediaRecorder.start(1000) // 1 second chunks
			
			// Update state
			this.state.mediaRecorder = mediaRecorder
			this.state.startTime = Date.now() - (this.state.recordingTime * 1000) // Adjust start time
			
			// Restart recording timer
			if (this.state.recordingInterval) {
				clearInterval(this.state.recordingInterval)
			}
			
			this.state.recordingInterval = window.setInterval(() => {
				this.state.recordingTime += 1
				this.notifyListeners()
				if (this.state.recordingTime % 10 === 0) {
					this.saveState()
				}
			}, 1000)

			console.log('🎙️ Successfully resumed interrupted recording')
			this.notifyListeners()
			return true

		} catch (error) {
			console.error('🎙️ Failed to resume interrupted recording:', error)
			return false
		}
	}

	// Save current recording state when app is closing (without clearing)
	saveCurrentState(): void {
		if (this.state.isRecording && this.state.meetingId) {
			console.log('🎙️ Saving current recording state before app close...')
			this.saveState()
		}
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
}

// Export singleton instance
export const globalRecordingManager = new GlobalRecordingManager()
export type { GlobalRecordingState }
