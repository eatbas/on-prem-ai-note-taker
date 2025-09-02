/**
 * Recording Lifecycle Management
 * Handles recording start, stop, resume operations
 */

import { startMeeting } from '../../services/api/meetings'
import { db } from '../../services'
import type { RecordingOptions, StartRecordingResult, GlobalRecordingState } from './types'
import { RecordingStateManager } from './state'
import { AudioRecordingManager } from './audioRecording'

export class RecordingLifecycleManager {
	constructor(
		private stateManager: RecordingStateManager,
		private audioManager: AudioRecordingManager
	) {}

	// Start recording with full audio handling and immediate meeting creation
	async startRecording(options: RecordingOptions): Promise<StartRecordingResult> {
		console.log('🎙️ Recording Lifecycle: Starting recording with options:', options)
		
		try {
			// Clear any previous saved recording state when starting new recording
			this.stateManager.clearSavedState()
			
			// Clear error state
			this.stateManager.clearError()
			
			// Create meeting immediately
			const meetingId = await this.createMeeting(options)
			
			// Reset chunk index
			const state = this.stateManager.getState()
			this.stateManager.updateState({ micChunkIndex: 0 })
			
			// Create data handler for mixed audio chunks (optimized for Whisper)
			const chunkIndex = { value: 0 }
			const onDataAvailable = AudioRecordingManager.createDataAvailableHandler(
				meetingId,
				chunkIndex,
				(error) => this.stateManager.setError(error)
			)
			
			// Start audio recording
			const currentState = this.stateManager.getState()
			const audioStarted = await this.audioManager.startAudioRecording(
				options, 
				currentState, 
				onDataAvailable,
				(updates) => this.stateManager.updateState(updates)
			)
			
			if (!audioStarted) {
				const error = this.stateManager.getState().error || 'Failed to start audio recording'
				return { success: false, error }
			}
			
			// Update state with recording info
			this.stateManager.updateState({
				isRecording: true,
				meetingId: meetingId,
				recordingTime: 0,
				chunkIndex: 0,
				startTime: Date.now(),
				language: options.language
			})
			
			// Start recording timer
			this.startRecordingTimer()
			
			// Save initial state
			this.stateManager.saveState()
			
			console.log('🎙️ Recording Lifecycle: Recording started successfully')
			return { success: true, meetingId }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to start recording'
			this.stateManager.setError(errorMessage)
			console.error('❌ Recording Lifecycle: Failed to start recording:', error)
			return { success: false, error: errorMessage }
		}
	}

	// Stop recording with full audio cleanup
	async stopRecording(): Promise<string | null> {
		console.log('🛑 Recording Lifecycle: Stopping recording...')
		
		try {
			const state = this.stateManager.getState()
			const meetingId = state.meetingId
			
			// Optimistically update UI to reflect stopping immediately
			if (state.isRecording) {
				this.stateManager.updateState({ isRecording: false })
			}
			
			// Stop audio recording
			await this.audioManager.stopAudioRecording(state)
			
			// Clear timers
			this.clearRecordingTimer()
			
			// Clear saved state and reset
			this.stateManager.clearSavedState()
			this.stateManager.resetState()
			
			console.log('⏹️ Recording Lifecycle: State reset, returning meetingId:', meetingId)
			return meetingId
		} catch (error) {
			console.error('❌ Error stopping recording:', error)
			// Ensure state is consistent even on errors
			this.stateManager.setError('Failed to stop recording properly')
			this.stateManager.updateState({ isRecording: false })
			return this.stateManager.getState().meetingId
		}
	}

	// Attempt to resume interrupted recording
	async attemptResumeRecording(options?: Partial<RecordingOptions>): Promise<boolean> {
		const state = this.stateManager.getState()
		
		if (!this.stateManager.isRecordingInterrupted()) {
			console.log('🎙️ No interrupted recording to resume')
			return false
		}

		try {
			console.log('🎙️ Attempting to resume interrupted recording...')
			
			// Use default options if not provided
			const resumeOptions: RecordingOptions = {
				language: state.language,
				...options
			}
			
			// Create data handler for audio chunks
			const micChunkIndex = { value: state.micChunkIndex }
			const onDataAvailable = AudioRecordingManager.createDataAvailableHandler(
				state.meetingId!,
				micChunkIndex,
				(error) => this.stateManager.setError(error)
			)
			
			// Start audio recording again (but don't create new meeting - use existing one)
			const audioStarted = await this.audioManager.startAudioRecording(
				resumeOptions,
				state,
				onDataAvailable,
				(updates) => this.stateManager.updateState(updates)
			)
			
			if (!audioStarted) {
				return false
			}
			
			// Adjust start time to account for elapsed time
			const adjustedStartTime = Date.now() - (state.recordingTime * 1000)
			this.stateManager.updateState({ startTime: adjustedStartTime })
			
			// Restart recording timer
			this.startRecordingTimer()

			console.log('🎙️ Successfully resumed interrupted recording')
			return true

		} catch (error) {
			console.error('🎙️ Failed to resume interrupted recording:', error)
			this.stateManager.setError('Failed to resume recording')
			return false
		}
	}

	// Force stop recording (for emergencies)
	async forceStopRecording(): Promise<void> {
		console.warn('🚨 EMERGENCY: Force stopping recording and releasing microphone...')
		
		const state = this.stateManager.getState()
		await this.audioManager.forceStopRecording(state)
		
		// Clear saved state
		this.stateManager.clearSavedState()
		
		// Reset state completely
		this.stateManager.resetState()
		
		// Notify Electron immediately
		if (window.electronAPI) {
			window.electronAPI.sendRecordingState(false)
			if ((window.electronAPI as any).microphoneReleased) {
				(window.electronAPI as any).microphoneReleased()
			}
		}
		
		console.log('🚨 Emergency force stop completed - microphone should be released')
		
		// Additional delay for cleanup
		setTimeout(() => {
			console.log('🔍 Emergency cleanup delay completed')
		}, 1000)
	}

	// Save current recording state when app is closing (without clearing)
	saveCurrentState(): void {
		const state = this.stateManager.getState()
		if (state.isRecording && state.meetingId) {
			console.log('🎙️ Saving current recording state before app close...')
			this.stateManager.saveState()
		}
	}

	// Create meeting and store locally
	private async createMeeting(options: RecordingOptions): Promise<string> {
		// Create meeting immediately with timestamp name using startMeeting API
		const now = new Date()
		const timestamp = now.toLocaleString()
		const meetingTitle = `Meeting ${timestamp}`
		
		console.log('🚀 Starting meeting creation...')
		console.log('📡 API Configuration:', {
			language: options.language,
			scope: options.scope || 'personal',
			title: meetingTitle
		})
		
		let meetingResult
		try {
			meetingResult = await startMeeting(
				meetingTitle, 
				options.language, 
				[], 
				options.scope ?? 'personal'
			)
		} catch (apiError) {
			console.error('❌ Backend API call failed:', apiError)
			throw new Error(`Failed to create meeting on server: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`)
		}
		
		console.log('📝 Meeting creation result:', meetingResult)
		const meetingId = meetingResult.meetingId
		
		// Validate meetingId before proceeding
		if (!meetingId || typeof meetingId !== 'string' || meetingId.trim() === '') {
			console.error('❌ Invalid meetingId received:', meetingId)
			throw new Error('Failed to create meeting: Invalid meeting ID received from server')
		}
		
		console.log('📝 Created meeting with scope:', {
			id: meetingId.slice(0, 8) + '...',
			title: meetingTitle,
			language: options.language,
			scope: options.scope || 'personal'
		})
		
		// Store meeting locally in database for immediate access
		await this.storeMeetingLocally(meetingId, meetingTitle, options)
		
		return meetingId
	}

	// Store meeting locally to prevent "Meeting Not Found" errors
	private async storeMeetingLocally(meetingId: string, title: string, options: RecordingOptions): Promise<void> {
		const localMeeting = {
			id: meetingId.trim(), // Ensure no whitespace
			title: title,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			tags: [],
			status: 'local' as const,
			language: options.language,
			duration: 0,
			workspace_id: typeof options.scope === 'number' ? options.scope : undefined,
			is_personal: options.scope === 'personal'
		}
		
		console.log('💾 Attempting to store meeting locally:', {
			id: localMeeting.id.slice(0, 8) + '...',
			title: localMeeting.title,
			status: localMeeting.status
		})
		
		try {
			await db.meetings.put(localMeeting)
			console.log('✅ Meeting stored locally in database successfully')
		} catch (dbError) {
			console.error('❌ Failed to store meeting in local database:', dbError)
			console.error('Meeting object that failed to store:', localMeeting)
			// Don't throw here - recording can continue even if local storage fails
			this.stateManager.setError('Warning: Meeting created but not stored locally')
		}
	}

	// Start recording timer
	private startRecordingTimer(): void {
		// Clear existing timer if any
		this.clearRecordingTimer()
		
		const state = this.stateManager.getState()
		const recordingInterval = window.setInterval(() => {
			const currentState = this.stateManager.getState()
			const newTime = currentState.recordingTime + 1
			this.stateManager.updateState({ recordingTime: newTime })
			
			// Save state every 10 seconds
			if (newTime % 10 === 0) {
				this.stateManager.saveState()
			}
		}, 1000)
		
		this.stateManager.updateState({ recordingInterval })
	}

	// Clear recording timer
	private clearRecordingTimer(): void {
		const state = this.stateManager.getState()
		if (state.recordingInterval) {
			clearInterval(state.recordingInterval)
			console.log('🧹 Recording Lifecycle: Cleared recording timer')
		}
		if (state.forceDataInterval) {
			clearInterval(state.forceDataInterval)
			console.log('🧹 Recording Lifecycle: Cleared force data interval')
		}
	}
}
