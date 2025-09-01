// Global recording manager to persist recording state across navigation
import { addChunk, db } from '../services'
import { startMeeting } from '../services/api/meetings'

export interface GlobalRecordingState {
	isRecording: boolean
	meetingId: string | null
	recordingTime: number
	chunkIndex: number
	recordingInterval: number | null
	startTime: number | null
	// Audio recording state
	micStream: MediaStream | null
	speakerStream: MediaStream | null
	micRecorder: MediaRecorder | null
	speakerRecorder: MediaRecorder | null
	micChunkIndex: number
	speakerChunkIndex: number
	forceDataInterval: number | null
	error: string | null
	language: 'tr' | 'en' | 'auto'
}

export interface RecordingOptions {
	micDeviceId?: string
	speakerDeviceId?: string
	language: 'tr' | 'en' | 'auto'
	showFloatingWidget?: boolean
	scope?: 'personal' | 'workspace'
}

class GlobalRecordingManager {
	private state: GlobalRecordingState = {
		isRecording: false,
		meetingId: null,
		recordingTime: 0,
		chunkIndex: 0,
		recordingInterval: null,
		startTime: null,
		// Audio recording state
		micStream: null,
		speakerStream: null,
		micRecorder: null,
		speakerRecorder: null,
		micChunkIndex: 0,
		speakerChunkIndex: 0,
		forceDataInterval: null,
		error: null,
		language: 'auto'
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
				startTime: this.state.startTime,
				micChunkIndex: this.state.micChunkIndex,
				speakerChunkIndex: this.state.speakerChunkIndex,
				language: this.state.language
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
				
				// Update state but don't restore media streams/recorders (they need to be recreated)
				this.state.isRecording = persistentState.isRecording
				this.state.meetingId = persistentState.meetingId
				this.state.recordingTime = persistentState.recordingTime
				this.state.chunkIndex = persistentState.chunkIndex
				this.state.startTime = persistentState.startTime
				this.state.micChunkIndex = persistentState.micChunkIndex || 0
				this.state.speakerChunkIndex = persistentState.speakerChunkIndex || 0
				this.state.language = persistentState.language || 'auto'
				
				// Notify listeners of restored state
				this.notifyListeners()
				
				// If we restored a recording state, warn about potential interruption
				if (this.state.isRecording) {
					console.warn('🎙️ WARNING: Recording state restored but media streams need to be recreated!')
					console.warn('Recording may have been interrupted by navigation or page refresh.')
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
			meetingId: state.meetingId ? state.meetingId.slice(0, 8) + '...' : 'none',
			recordingTime: state.recordingTime,
			listenerCount: this.listeners.size
		})
		this.listeners.forEach(listener => listener(state))
	}

	// Start recording with full audio handling and immediate meeting creation
	async startRecording(options: RecordingOptions): Promise<{ success: boolean; meetingId?: string }> {
		console.log('🎙️ Global Recording Manager: Starting recording with options:', options)
		
		try {
			// Clear any previous saved recording state when starting new recording
			this.clearSavedState()
			
			// Clear error state
			this.state.error = null
			
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
					options.scope || 'personal'
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
			
			// 🚨 CRITICAL: Store meeting locally in database for immediate access
			// This prevents "Meeting Not Found" errors when navigating to the meeting
			const localMeeting = {
				id: meetingId.trim(), // Ensure no whitespace
				title: meetingTitle,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				tags: [],
				status: 'local' as const,
				language: options.language,
				duration: 0,
				workspace_id: options.scope === 'workspace' ? undefined : undefined, // Will be set by backend
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
				this.state.error = 'Warning: Meeting created but not stored locally'
			}
			
			// Reset chunk indices
			this.state.micChunkIndex = 0
			this.state.speakerChunkIndex = 0
			
			// Start audio recording
			const audioStarted = await this.startAudioRecording(options)
			if (!audioStarted) {
				return { success: false }
			}
			
			// Set recording state
			this.state.isRecording = true
			this.state.meetingId = meetingId
			this.state.recordingTime = 0
			this.state.chunkIndex = 0
			this.state.startTime = Date.now()
			this.state.language = options.language
			
			// Start recording timer
			this.state.recordingInterval = window.setInterval(() => {
				this.state.recordingTime += 1
				// Notify listeners every second for real-time timer updates
				this.notifyListeners()
				// Save state every 10 seconds
				if (this.state.recordingTime % 10 === 0) {
					this.saveState()
				}
			}, 1000)
			
			// Save initial state
			this.saveState()
			this.notifyListeners()
			
			console.log('🎙️ Global Recording Manager: Recording started successfully')
			return { success: true, meetingId }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to start recording'
			this.state.error = errorMessage
			console.error('❌ Global Recording Manager: Failed to start recording:', error)
			this.notifyListeners()
			return { success: false }
		}
	}

	// Stop recording with full audio cleanup
	async stopRecording(): Promise<string | null> {
		console.log('🛑 Global Recording Manager: Stopping recording...')
		
		try {
			// Stop audio recording
			await this.stopAudioRecording()
			
			// Clear timers
			if (this.state.recordingInterval) {
				clearInterval(this.state.recordingInterval)
				console.log('🧹 Global Recording Manager: Cleared recording timer')
			}
			if (this.state.forceDataInterval) {
				clearInterval(this.state.forceDataInterval)
				console.log('🧹 Global Recording Manager: Cleared force data interval')
			}
			
			const meetingId = this.state.meetingId
			
			// Clear saved state
			this.clearSavedState()
			
			// Reset state
			this.state.isRecording = false
			this.state.meetingId = null
			this.state.recordingTime = 0
			this.state.chunkIndex = 0
			this.state.recordingInterval = null
			this.state.startTime = null
			this.state.micStream = null
			this.state.speakerStream = null
			this.state.micRecorder = null
			this.state.speakerRecorder = null
			this.state.micChunkIndex = 0
			this.state.speakerChunkIndex = 0
			this.state.forceDataInterval = null
			this.state.error = null
			
			console.log('⏹️ Global Recording Manager: State reset, returning meetingId:', meetingId)
			this.notifyListeners()
			return meetingId
		} catch (error) {
			console.error('❌ Error stopping recording:', error)
			this.state.error = 'Failed to stop recording properly'
			this.notifyListeners()
			return this.state.meetingId
		}
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

	// Check if recording was interrupted (restored from localStorage without active streams)
	isRecordingInterrupted(): boolean {
		return this.state.isRecording && !this.state.micRecorder && !this.state.speakerRecorder
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
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.recordingInterval = null
		this.state.startTime = null
		this.state.micStream = null
		this.state.speakerStream = null
		this.state.micRecorder = null
		this.state.speakerRecorder = null
		this.state.micChunkIndex = 0
		this.state.speakerChunkIndex = 0
		this.state.forceDataInterval = null
		this.state.error = null
		this.notifyListeners()
	}

	// Attempt to resume interrupted recording
	async attemptResumeRecording(options?: Partial<RecordingOptions>): Promise<boolean> {
		if (!this.isRecordingInterrupted()) {
			console.log('🎙️ No interrupted recording to resume')
			return false
		}

		try {
			console.log('🎙️ Attempting to resume interrupted recording...')
			
			// Use default options if not provided
			const resumeOptions: RecordingOptions = {
				language: this.state.language,
				...options
			}
			
			// Start audio recording again (but don't create new meeting - use existing one)
			const audioStarted = await this.startAudioRecording(resumeOptions)
			if (!audioStarted) {
				return false
			}
			
			// Adjust start time to account for elapsed time
			this.state.startTime = Date.now() - (this.state.recordingTime * 1000)
			
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
			this.state.error = 'Failed to resume recording'
			this.notifyListeners()
			return false
		}
	}
	
	// Start audio recording with dual-channel capture
	private async startAudioRecording(options: RecordingOptions): Promise<boolean> {
		try {
			console.log('🎙️ Starting audio recording with options:', options)
			
			// Get microphone stream with proper device constraints
			const micConstraints: MediaStreamConstraints = {
				audio: {
					deviceId: options.micDeviceId 
						? { exact: options.micDeviceId } 
						: undefined,
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
					sampleRate: 44100,
					channelCount: 2
				}
			}
			
			console.log('🎤 Using microphone constraints:', {
				deviceId: options.micDeviceId,
				hasConstraint: !!options.micDeviceId
			})
			
			this.state.micStream = await navigator.mediaDevices.getUserMedia(micConstraints)
			console.log('✅ Microphone stream obtained')
			
			// Get speaker/system audio stream using multiple methods
			await this.setupSpeakerRecording(options)
			
			// Recording options
			const recordingOptions: MediaRecorderOptions = {
				mimeType: 'audio/webm;codecs=opus',
				bitsPerSecond: 128000
			}
			
			// Create microphone recorder
			this.state.micRecorder = new MediaRecorder(this.state.micStream, recordingOptions)
			this.setupMicRecorderEvents()
			
			// Create speaker recorder if we have speaker stream
			if (this.state.speakerStream) {
				this.state.speakerRecorder = new MediaRecorder(this.state.speakerStream, recordingOptions)
				this.setupSpeakerRecorderEvents()
			}
			
			// Use short chunks for reliability
			const chunkMs = 1000  // 1 second chunks
			
			// Start recording with short intervals for reliable data capture
			console.log(`🎙️ Starting recording with ${chunkMs}ms chunks`)
			this.state.micRecorder.start(chunkMs)
			if (this.state.speakerRecorder) {
				this.state.speakerRecorder.start(chunkMs)
			}
			
			// Force data capture every 5 seconds as backup
			this.state.forceDataInterval = window.setInterval(() => {
				if (this.state.micRecorder && this.state.micRecorder.state === 'recording') {
					console.log('🔄 Forcing mic data capture...')
					this.state.micRecorder.requestData()
				}
				if (this.state.speakerRecorder && this.state.speakerRecorder.state === 'recording') {
					console.log('🔄 Forcing speaker data capture...')
					this.state.speakerRecorder.requestData()
				}
			}, 5000)
			
			console.log('🎙️ Dual recording started successfully')
			return true
			
		} catch (error) {
			console.error('❌ Audio recording start failed:', error)
			this.state.error = error instanceof Error ? error.message : 'Failed to start audio recording'
			return false
		}
	}
	
	// Setup speaker/system audio recording with multiple fallback methods
	private async setupSpeakerRecording(options: RecordingOptions): Promise<void> {
		let speakerStream: MediaStream | null = null
		
		// Method 1: Try Electron-specific system audio capture (automatic)
		if ((window as any).desktopCapture) {
			try {
				console.log('🔊 Attempting automatic system audio capture via Electron...')
				speakerStream = await (window as any).desktopCapture.captureSystemAudio()
				if (speakerStream) {
					console.log('✅ Automatic system audio capture successful!')
				}
			} catch (err) {
				console.warn('⚠️ Automatic system audio capture failed:', err)
			}
		}
		
		// Method 2: Try desktop capturer for system audio (Electron-specific, automatic)
		if (!speakerStream && (window as any).desktopCapture) {
			try {
				console.log('🔊 Trying desktop capturer for system audio...')
				speakerStream = await (window as any).desktopCapture.captureDesktopAudio()
				if (speakerStream) {
					console.log('✅ Desktop capturer system audio successful!')
				}
			} catch (err) {
				console.warn('⚠️ Desktop capturer system audio failed:', err)
			}
		}
		
		// Method 3: Try Electron loopback device detection (automatic)
		if (!speakerStream && (window as any).desktopCapture) {
			try {
				console.log('🔊 Trying Electron loopback device detection...')
				speakerStream = await (window as any).desktopCapture.captureLoopbackAudio()
				if (speakerStream) {
					console.log('✅ Electron loopback device detection successful!')
				}
			} catch (err) {
				console.warn('⚠️ Electron loopback device detection failed:', err)
			}
		}
		
		// Method 4: Try automatic loopback device detection
		if (!speakerStream) {
			try {
				console.log('🔊 Attempting automatic loopback device detection...')
				const devices = await navigator.mediaDevices.enumerateDevices()
				
				// Look for system audio loopback devices
				const loopbackDevice = devices.find(device => 
					device.kind === 'audioinput' && (
						device.label.toLowerCase().includes('stereo mix') ||
						device.label.toLowerCase().includes('what u hear') ||
						device.label.toLowerCase().includes('loopback') ||
						device.label.toLowerCase().includes('system audio') ||
						device.label.toLowerCase().includes('monitor') ||
						device.label.toLowerCase().includes('desktop audio')
					)
				)
				
				if (loopbackDevice) {
					console.log('🔊 Found loopback device:', loopbackDevice.label)
					speakerStream = await navigator.mediaDevices.getUserMedia({
						audio: {
							deviceId: { exact: loopbackDevice.deviceId },
							echoCancellation: false,
							noiseSuppression: false,
							autoGainControl: false,
							sampleRate: 44100,
							channelCount: 2
						}
					})
					console.log('✅ Loopback device system audio successful!')
				} else {
					console.log('📍 No loopback devices found. Available audio input devices:')
					devices.filter(d => d.kind === 'audioinput').forEach(device => {
						console.log(`  - ${device.label} (${device.deviceId.slice(0, 20)}...)`)
					})
				}
			} catch (err) {
				console.warn('⚠️ Loopback device detection failed:', err)
			}
		}
		
		// Method 5: Last resort - try traditional screen capture (requires user interaction)
		if (!speakerStream) {
			try {
				console.log('🔊 Fallback: Requesting system audio via screen capture...')
				
				const screenStream = await navigator.mediaDevices.getDisplayMedia({
					video: false, // Try audio-only first  
					audio: {
						echoCancellation: false,
						noiseSuppression: false,
						autoGainControl: false,
						sampleRate: 44100,
						channelCount: 2
					} as any
				})
				
				console.log('🖥️ Display media stream obtained, checking for audio tracks...')
				
				// Extract only audio tracks
				const audioTracks = screenStream.getAudioTracks()
				console.log(`🔊 Found ${audioTracks.length} audio tracks in screen capture`)
				
				if (audioTracks.length > 0) {
					speakerStream = new MediaStream(audioTracks)
					console.log('✅ Screen capture system audio successful!')
					console.log('🔊 Audio track details:', audioTracks.map(track => ({
						kind: track.kind,
						label: track.label,
						enabled: track.enabled,
						readyState: track.readyState
					})))
				}
				
				// Stop video tracks if any
				const videoTracks = screenStream.getVideoTracks()
				if (videoTracks.length > 0) {
					console.log(`📹 Stopping ${videoTracks.length} video tracks...`)
					videoTracks.forEach(track => track.stop())
				}
				
			} catch (err) {
				console.warn('⚠️ Screen capture system audio failed:', err)
			}
		}
		
		// Summary of system audio capture attempt
		if (speakerStream) {
			const tracks = speakerStream.getAudioTracks()
			console.log('🎉 System audio capture successful!', {
				trackCount: tracks.length,
				trackLabels: tracks.map(t => t.label),
				trackStates: tracks.map(t => t.readyState)
			})
			this.state.speakerStream = speakerStream
		} else {
			console.warn('❌ All system audio capture methods failed')
			console.warn('💡 System audio will not be recorded')
		}
	}
	
	// Setup microphone recorder event handlers
	private setupMicRecorderEvents(): void {
		if (!this.state.micRecorder) return
		
		this.state.micRecorder.ondataavailable = async (event) => {
			console.log(`🎤 Mic data available: ${event.data?.size || 0} bytes`)
			
			if (event.data && event.data.size > 0 && this.state.meetingId) {
				try {
					console.log(`💾 Saving mic chunk ${this.state.micChunkIndex} with meetingId: ${this.state.meetingId}`)
					await addChunk(
						this.state.meetingId, 
						event.data, 
						this.state.micChunkIndex, 
						'microphone'
					)
					console.log(`✅ Mic chunk ${this.state.micChunkIndex} saved: ${event.data.size} bytes`)
					this.state.micChunkIndex++
				} catch (error) {
					console.error('❌ Failed to save mic chunk:', error)
					this.state.error = `Failed to save audio: ${error}`
					this.notifyListeners()
				}
			} else {
				console.warn(`⚠️ Empty mic data: ${event.data?.size || 0} bytes, meetingId: ${this.state.meetingId}`)
			}
		}
	}
	
	// Setup speaker recorder event handlers
	private setupSpeakerRecorderEvents(): void {
		if (!this.state.speakerRecorder) return
		
		this.state.speakerRecorder.ondataavailable = async (event) => {
			console.log(`🔊 Speaker data available: ${event.data?.size || 0} bytes`)
			
			if (event.data && event.data.size > 0 && this.state.meetingId) {
				try {
					console.log(`💾 Saving speaker chunk ${this.state.speakerChunkIndex} with meetingId: ${this.state.meetingId}`)
					await addChunk(
						this.state.meetingId, 
						event.data, 
						this.state.speakerChunkIndex, 
						'speaker'
					)
					console.log(`✅ Speaker chunk ${this.state.speakerChunkIndex} saved: ${event.data.size} bytes`)
					this.state.speakerChunkIndex++
				} catch (error) {
					console.error('❌ Failed to save speaker chunk:', error)
					// Don't fail recording for speaker issues
				}
			} else {
				console.warn(`⚠️ Empty speaker data: ${event.data?.size || 0} bytes, meetingId: ${this.state.meetingId}`)
			}
		}
	}
	
	// Stop audio recording with proper cleanup
	private async stopAudioRecording(): Promise<void> {
		console.log('🛑 Stopping dual recording...')
		
		try {
			console.log('🔍 Current recording state:', {
				isRecording: this.state.isRecording,
				hasMicRecorder: !!this.state.micRecorder,
				hasSpeakerRecorder: !!this.state.speakerRecorder,
				hasMicStream: !!this.state.micStream,
				hasSpeakerStream: !!this.state.speakerStream,
				micRecorderState: this.state.micRecorder?.state,
				speakerRecorderState: this.state.speakerRecorder?.state
			})
			
			const stopPromises: Promise<void>[] = []
			
			// Clear force data interval first
			if (this.state.forceDataInterval) {
				clearInterval(this.state.forceDataInterval)
				console.log('🧹 Cleared force data interval')
			}
			
			// Stop microphone recorder with proper cleanup
			if (this.state.micRecorder) {
				console.log('🎤 Stopping microphone recorder...')
				
				if (this.state.micRecorder.state === 'recording') {
					// Request final data
					this.state.micRecorder.requestData()
					
					// Create promise that resolves when recorder stops
					const micStopPromise = new Promise<void>((resolve) => {
						const handleStop = () => {
							console.log('🎤 Microphone recorder stopped')
							this.state.micRecorder?.removeEventListener('stop', handleStop)
							resolve()
						}
						this.state.micRecorder?.addEventListener('stop', handleStop, { once: true })
						
						// Add timeout to prevent hanging
						setTimeout(() => {
							console.warn('⚠️ Microphone recorder stop timeout')
							this.state.micRecorder?.removeEventListener('stop', handleStop)
							resolve()
						}, 5000)
					})
					
					stopPromises.push(micStopPromise)
					this.state.micRecorder.stop()
				}
			}
			
			// Stop speaker recorder with proper cleanup  
			if (this.state.speakerRecorder) {
				console.log('🔊 Stopping speaker recorder...')
				
				if (this.state.speakerRecorder.state === 'recording') {
					// Request final data
					this.state.speakerRecorder.requestData()
					
					// Create promise that resolves when recorder stops
					const speakerStopPromise = new Promise<void>((resolve) => {
						const handleStop = () => {
							console.log('🔊 Speaker recorder stopped')
							this.state.speakerRecorder?.removeEventListener('stop', handleStop)
							resolve()
						}
						this.state.speakerRecorder?.addEventListener('stop', handleStop, { once: true })
						
						// Add timeout to prevent hanging
						setTimeout(() => {
							console.warn('⚠️ Speaker recorder stop timeout')
							this.state.speakerRecorder?.removeEventListener('stop', handleStop)
							resolve()
						}, 5000)
					})
					
					stopPromises.push(speakerStopPromise)
					this.state.speakerRecorder.stop()
				}
			}
			
			// Wait for all recorders to stop properly
			if (stopPromises.length > 0) {
				console.log('⏳ Waiting for recorders to stop...')
				await Promise.all(stopPromises)
				console.log('✅ All recorders stopped')
			}
			
			// Aggressive media stream cleanup
			console.log('🔌 Stopping all media streams and tracks...')
			
			// Stop microphone streams aggressively
			if (this.state.micStream) {
				console.log('🎤 Stopping microphone stream tracks...')
				this.state.micStream.getTracks().forEach((track, index) => {
					console.log(`🎤 Stopping mic track ${index}: ${track.kind}, state: ${track.readyState}`)
					try {
						track.stop()
						console.log(`✅ Mic track ${index} stopped`)
					} catch (e) {
						console.warn(`⚠️ Failed to stop mic track ${index}:`, e)
					}
				})
				// Clear the stream reference
				this.state.micStream = null
			}
			
			// Stop speaker streams aggressively
			if (this.state.speakerStream) {
				console.log('🔊 Stopping speaker stream tracks...')
				this.state.speakerStream.getTracks().forEach((track, index) => {
					console.log(`🔊 Stopping speaker track ${index}: ${track.kind}, state: ${track.readyState}`)
					try {
						track.stop()
						console.log(`✅ Speaker track ${index} stopped`)
					} catch (e) {
						console.warn(`⚠️ Failed to stop speaker track ${index}:`, e)
					}
				})
				// Clear the stream reference
				this.state.speakerStream = null
			}
			
			// Clear recorder references immediately
			if (this.state.micRecorder) {
				try {
					this.state.micRecorder.ondataavailable = null
					this.state.micRecorder.onstop = null
					this.state.micRecorder.onerror = null
				} catch (e) {
					console.warn('⚠️ Error clearing mic recorder events:', e)
				}
				this.state.micRecorder = null
			}
			
			if (this.state.speakerRecorder) {
				try {
					this.state.speakerRecorder.ondataavailable = null
					this.state.speakerRecorder.onstop = null
					this.state.speakerRecorder.onerror = null
				} catch (e) {
					console.warn('⚠️ Error clearing speaker recorder events:', e)
				}
				this.state.speakerRecorder = null
			}
			
			// Small delay to ensure cleanup is complete
			await new Promise(resolve => setTimeout(resolve, 100))
			
			// Aggressive cleanup to ensure microphone is fully released
			console.log('🧹 Performing comprehensive cleanup to ensure microphone release...')
			
			// Force garbage collection if available (Electron/Node.js)
			if (typeof global !== 'undefined' && global.gc) {
				try {
					global.gc()
					console.log('🗑️ Forced garbage collection')
				} catch (e) {
					console.warn('⚠️ GC failed:', e)
				}
			}
			
			// Call global mic cleanup if available (from MicrophoneSelector)
			if ((window as any).forceMicCleanup) {
				console.log('🚨 Calling emergency microphone cleanup...')
				try {
					(window as any).forceMicCleanup()
				} catch (e) {
					console.warn('⚠️ Emergency mic cleanup failed:', e)
				}
			}
			
			// Try to clear any lingering stream references
			try {
				// Clear any potential stream references in the global scope
				if ((window as any).currentMicStream) {
					(window as any).currentMicStream = null
				}
				if ((window as any).currentSpeakerStream) {
					(window as any).currentSpeakerStream = null
				}
			} catch (e) {
				console.warn('⚠️ Error clearing global stream references:', e)
			}
			
			// Delay to ensure all cleanup is processed
			setTimeout(() => {
				console.log('🔍 Final microphone status check completed - microphone should be fully released')
				// Notify that cleanup is complete
				if ((window as any).electronAPI && (window as any).electronAPI.microphoneReleased) {
					(window as any).electronAPI.microphoneReleased()
				}
			}, 1000) // Increased delay to ensure complete cleanup
			
			console.log('✅ Dual recording stopped successfully - microphone should be released')
		} catch (error) {
			console.error('❌ Error stopping audio recording:', error)
			throw error
		}
	}
	
	// Get current error state
	getError(): string | null {
		return this.state.error
	}
	
	// Check if microphone is available
	hasMicStream(): boolean {
		return !!this.state.micStream
	}
	
	// Check if speaker is available
	hasSpeakerStream(): boolean {
		return !!this.state.speakerStream
	}
	
	// Set error state
	setError(error: string | null): void {
		this.state.error = error
		this.notifyListeners()
	}
	
	// Force stop recording (for emergencies and microphone release issues)
	forceStopRecording(): void {
		console.warn('🚨 EMERGENCY: Force stopping recording and releasing microphone...')
		
		// Aggressively stop all media streams and tracks
		if (this.state.micStream) {
			console.log('🚨 Force stopping microphone stream...')
			this.state.micStream.getTracks().forEach((track, index) => {
				try {
					console.log(`🚨 Force stopping mic track ${index}`)
					track.stop()
				} catch (e) {
					console.error(`Failed to stop mic track ${index}:`, e)
				}
			})
			this.state.micStream = null
		}
		if (this.state.speakerStream) {
			console.log('🚨 Force stopping speaker stream...')
			this.state.speakerStream.getTracks().forEach((track, index) => {
				try {
					console.log(`🚨 Force stopping speaker track ${index}`)
					track.stop()
				} catch (e) {
					console.error(`Failed to stop speaker track ${index}:`, e)
				}
			})
			this.state.speakerStream = null
		}
		
		// Force stop recorders
		if (this.state.micRecorder) {
			try {
				if (this.state.micRecorder.state === 'recording') {
					this.state.micRecorder.stop()
				}
				this.state.micRecorder.ondataavailable = null
				this.state.micRecorder = null
			} catch (e) {
				console.error('Failed to stop mic recorder:', e)
				this.state.micRecorder = null
			}
		}
		if (this.state.speakerRecorder) {
			try {
				if (this.state.speakerRecorder.state === 'recording') {
					this.state.speakerRecorder.stop()
				}
				this.state.speakerRecorder.ondataavailable = null
				this.state.speakerRecorder = null
			} catch (e) {
				console.error('Failed to stop speaker recorder:', e)
				this.state.speakerRecorder = null
			}
		}
		
		// Clear all intervals
		if (this.state.recordingInterval) {
			clearInterval(this.state.recordingInterval)
		}
		if (this.state.forceDataInterval) {
			clearInterval(this.state.forceDataInterval)
		}
		
		// Emergency cleanup
		if ((window as any).forceMicCleanup) {
			try {
				(window as any).forceMicCleanup()
			} catch (e) {
				console.error('Emergency mic cleanup failed:', e)
			}
		}
		
		// Clear saved state
		this.clearSavedState()
		
		// Reset state completely
		this.state.isRecording = false
		this.state.meetingId = null
		this.state.recordingTime = 0
		this.state.chunkIndex = 0
		this.state.recordingInterval = null
		this.state.startTime = null
		this.state.micStream = null
		this.state.speakerStream = null
		this.state.micRecorder = null
		this.state.speakerRecorder = null
		this.state.micChunkIndex = 0
		this.state.speakerChunkIndex = 0
		this.state.forceDataInterval = null
		this.state.error = null
		
		// Notify Electron immediately
		if (window.electronAPI) {
			window.electronAPI.sendRecordingState(false)
			// Note: microphoneReleased method may not exist on all Electron versions
			if ((window.electronAPI as any).microphoneReleased) {
				(window.electronAPI as any).microphoneReleased()
			}
		}
		
		this.notifyListeners()
		console.log('🚨 Emergency force stop completed - microphone should be released')
		
		// Additional delay for cleanup
		setTimeout(() => {
			console.log('🔍 Emergency cleanup delay completed')
		}, 1000)
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
