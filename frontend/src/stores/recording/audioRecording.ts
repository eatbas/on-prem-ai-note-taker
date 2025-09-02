/**
 * Audio Recording Management
 * Orchestrates audio capture and cleanup operations
 */

import { addChunk } from '../../services'
import type { RecordingOptions, GlobalRecordingState } from './types'
import { AudioCaptureManager } from './audioCapture'
import { AudioCleanupManager } from './audioCleanup'

import { TauriAudioCaptureManager } from '../../services/tauriAudio'
import { isTauri } from '../../lib/tauri'

export class AudioRecordingManager {
	private captureManager = new AudioCaptureManager()
	private tauriCaptureManager = new TauriAudioCaptureManager()
	private cleanupManager = new AudioCleanupManager()
	private audioContext: AudioContext | null = null

	// Start mixed audio recording (optimized for Whisper transcription)
	async startAudioRecording(
		options: RecordingOptions,
		state: GlobalRecordingState,
		onDataAvailable: (event: BlobEvent) => Promise<void>,
		setState: (updates: Partial<GlobalRecordingState>) => void
	): Promise<boolean> {
		try {
			console.log('🎙️ Starting audio recording with options:', options)

			// Safety check: If system audio is disabled, log it clearly
			if (localStorage.getItem('systemAudioDisabled') === 'true') {
				console.log('ℹ️ System audio is disabled - will use microphone only')
			}

			// Proactively release monitoring streams from MicrophoneSelector to avoid device busy errors
			await this.preStartCleanup()

					// Check if we have working microphone devices first
		let systemStream: MediaStream | null = null
		let micStream: MediaStream | null = null
		let useTauri = false

		// This is a desktop-only app, so use Tauri native capture
		console.log('🦀 Using Tauri native capture for desktop app...')
		useTauri = true
		
		// Fallback to web-based capture only if Tauri fails
		if (!useTauri) {
			// Try web-based audio capture for non-Tauri environments
			try {
				console.log('🌐 Attempting web-based audio capture...')

				// Try to get microphone stream
				try {
					micStream = await this.captureManager.captureMicrophone(options)
					console.log('✅ Web microphone capture successful')
				} catch (micErr) {
					console.warn('⚠️ Web microphone capture failed:', micErr)
					// Create empty stream as fallback
					micStream = new MediaStream()
				}

				// Try to get system audio stream if not disabled
				if (localStorage.getItem('systemAudioDisabled') !== 'true') {
					try {
						systemStream = await this.captureManager.captureSystemAudio()
						if (systemStream) {
							console.log('✅ Web system audio capture successful')
						}
					} catch (sysErr) {
						console.warn('⚠️ Web system audio capture failed:', sysErr)
					}
				}

				// Check if we have at least a working microphone
				if (micStream && micStream.getAudioTracks().length > 0) {
					console.log('🌐 Using web-based audio capture')
					useTauri = false
				} else {
					console.log('🔧 Web audio failed, trying Tauri native audio capture...')
					useTauri = true
				}
			} catch (webErr) {
				console.warn('⚠️ Web audio capture completely failed:', webErr)
				console.log('🔧 Falling back to Tauri native audio capture...')
				useTauri = true
			}
		}

		if (useTauri) {
			// Tauri-based dual device capture (optimized for Whisper)
			console.log('🦀 Using Tauri native dual device capture')
			
			try {
				// Initialize Tauri audio manager first
				await this.tauriCaptureManager.initialize()
				
				// Try the new dual device capture first
				let success = await this.tauriCaptureManager.startDualDeviceCapture()
				
				if (!success) {
					console.warn('⚠️ Dual device capture failed, trying individual devices...')
					
					// Try individual device capture with better error handling
					let hasMicrophone = false
					let hasSystemAudio = false
					
					try {
						console.log('🎤 Attempting individual microphone capture...')
						hasMicrophone = await this.tauriCaptureManager.startMicrophoneCapture(options.micDeviceId)
						if (hasMicrophone) {
							console.log('✅ Individual microphone capture successful')
						} else {
							console.warn('⚠️ Individual microphone capture failed')
						}
					} catch (error) {
						console.error('❌ Microphone capture error:', error)
					}
					
					try {
						console.log('🔊 Attempting individual system audio capture...')
						hasSystemAudio = await this.tauriCaptureManager.startSystemAudioCapture()
						if (hasSystemAudio) {
							console.log('✅ Individual system audio capture successful')
						} else {
							console.warn('⚠️ Individual system audio capture failed')
						}
					} catch (error) {
						console.error('❌ System audio capture error:', error)
					}
					
					if (!hasSystemAudio && !hasMicrophone) {
						console.error('❌ No audio devices could be started for Tauri capture')
						throw new Error('All Tauri audio capture methods failed')
					}
					
					console.log(`✅ Individual Tauri capture: mic=${hasMicrophone}, system=${hasSystemAudio}`)
				} else {
					console.log('✅ Tauri dual device capture started successfully')
				}
				
				// For Tauri recording, create empty streams for UI compatibility but mark them for monitoring
				micStream = new MediaStream()
				systemStream = new MediaStream()
				
				// Add a custom property to indicate these are Tauri streams for monitoring
				;(micStream as any).__isTauriMicStream = true
				;(systemStream as any).__isTauriSystemStream = true
				
				// Set up Tauri data pulling optimized for Whisper
				let consecutiveEmptyChunks = 0
				const maxEmptyChunks = 5
				
				const tauriDataInterval = window.setInterval(async () => {
					try {
						// Try to get mixed audio first, fallback to legacy method
						let audioData: number[] = []
						try {
							audioData = await this.tauriCaptureManager.getMixedAudioBuffer()
						} catch {
							// Fallback to legacy method
							const legacyData = await this.tauriCaptureManager.getAudioDataChunk(16000) // Whisper-optimized 16kHz
							audioData = Array.from(legacyData) // Convert to number[] if it's Float32Array
						}
						
						if (audioData.length > 0) {
							consecutiveEmptyChunks = 0
							// Convert number[] to Float32Array for WAV conversion
							const float32Data = new Float32Array(audioData)
							// Convert to optimized blob for Whisper
							const wavBlob = this.tauriCaptureManager.audioDataToWav(float32Data, 16000) // 16kHz for Whisper
							await onDataAvailable({ data: wavBlob } as BlobEvent)
							console.log(`🎙️ Tauri mixed audio chunk: ${audioData.length} samples (16kHz)`)
						} else {
							consecutiveEmptyChunks++
							if (consecutiveEmptyChunks >= maxEmptyChunks) {
								console.warn(`⚠️ No audio data for ${consecutiveEmptyChunks} consecutive intervals`)
							}
						}
					} catch (err) {
						console.warn('⚠️ Failed to get Tauri audio data:', err)
					}
				}, 1000)
				
				setState({ 
					micStream, 
					systemStream,
					forceDataInterval: tauriDataInterval,
					usingTauriAudio: true,
					usingDualCapture: true
				})
				
				console.log('✅ Tauri dual device capture initialized (optimized for Whisper)')
				return true
			} catch (error) {
				console.error('❌ Tauri audio setup failed:', error)
				throw error
			}
		} else {
			// Web-based mixed recording (optimized for Whisper)
			console.log('🌐 Using web-based mixed recording for optimal Whisper transcription')
			
			// Ensure we have at least a microphone stream
			if (!micStream || micStream.getAudioTracks().length === 0) {
				throw new Error('No working microphone found for recording')
			}
			
			// Create optimized mixed stream for Whisper
			const { stream: finalStream, audioContext } = this.captureManager.createMixedStream(systemStream, micStream)
			this.audioContext = audioContext

			// Log what we're capturing for debugging
			if (systemStream && systemStream.getAudioTracks().length > 0) {
				console.log('✅ Mixed recording: Microphone + System Audio (optimal for Whisper)')
			} else {
				console.log('⚠️ Microphone-only recording (system audio not available)')
			}

			// Create and setup MediaRecorder with mixed stream
			const recorder = this.captureManager.createMediaRecorder(finalStream, onDataAvailable)

			// Persist media references in global state (include systemStream for UI indicators)
			setState({ 
				micStream: finalStream, 
				micRecorder: recorder, 
				systemStream: systemStream, // Add systemStream so UI can show system audio indicator
				usingTauriAudio: false 
			})

			// Start recording
			console.log('🎙️ Starting mixed audio recording for Whisper')
			recorder.start()

			// Prime the recorder
			setTimeout(() => {
				try {
					if (recorder.state === 'recording') {
						recorder.requestData()
					}
				} catch (e) {
					console.warn('⚠️ Initial recorder.requestData() failed:', e)
				}
			}, 400)

			// Pull data at intervals
			const forceDataInterval = window.setInterval(() => {
				if (recorder.state === 'recording') {
					recorder.requestData()
				}
			}, 1000)
			setState({ forceDataInterval })
		}

			console.log('✅ Audio recording started successfully')
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
		// Handle Tauri-based recording
		if (state.usingTauriAudio) {
			console.log('🛑 Stopping Tauri audio recording...')
			
			// Stop Tauri audio capture with timeout
			try {
				// Try normal stop first with 5 second timeout
				const stopPromise = this.tauriCaptureManager.stopCapture()
				const timeoutPromise = new Promise((_, reject) => 
					setTimeout(() => reject(new Error('Stop timeout')), 5000)
				)
				
				await Promise.race([stopPromise, timeoutPromise])
				console.log('✅ Tauri audio capture stopped successfully')
				
			} catch (e) {
				console.warn('⚠️ Normal stop failed, trying force stop:', e)
				
				// Fallback to force stop
				try {
					await this.tauriCaptureManager.forceStopCapture()
					console.log('✅ Force stop completed')
				} catch (forceError) {
					console.error('❌ Even force stop failed:', forceError)
				}
			}
			
			// Clear the data pulling interval
			if (state.forceDataInterval) {
				clearInterval(state.forceDataInterval)
				console.log('🗑️ Cleared Tauri data interval')
			}
		} else {
			// Handle web-based recording
			console.log('🛑 Stopping web-based audio recording...')
			await this.cleanupManager.stopAudioRecording(state)
		}

		// Close mixed AudioContext if present
		if (this.audioContext) {
			try {
				await this.audioContext.close()
				this.audioContext = null
				console.log('🗑️ Closed AudioContext')
			} catch (e) {
				console.warn('⚠️ Failed closing AudioContext:', e)
			}
		}
		
		console.log('✅ Audio recording stop sequence completed')
	}

	// Force stop recording (for emergencies)
	async forceStopRecording(state: GlobalRecordingState): Promise<void> {
		console.log('🚨 FORCE STOPPING audio recording...')
		
		// Handle Tauri-based recording
		if (state.usingTauriAudio) {
			console.log('🚨 Force stopping Tauri audio recording...')
			
			// Use the force stop method
			try {
				await this.tauriCaptureManager.forceStopCapture()
				console.log('✅ Tauri force stop completed')
			} catch (e) {
				console.error('❌ Tauri force stop failed:', e)
			}
			
			// Clear the data pulling interval
			if (state.forceDataInterval) {
				clearInterval(state.forceDataInterval)
			}
		} else {
			// Handle web-based recording
			console.log('🚨 Force stopping web-based audio recording...')
			this.cleanupManager.forceStopRecording(state)
		}

		// Close AudioContext immediately
		if (this.audioContext) {
			try {
				await this.audioContext.close()
				this.audioContext = null
				console.log('🗑️ Force closed AudioContext')
			} catch (e) {
				console.warn('⚠️ Failed force closing AudioContext:', e)
			}
		}
		
		console.log('🚨 Force stop sequence completed')
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

	// Static helper to create mixed audio data handler (optimized for Whisper)
	static createDataAvailableHandler(
		meetingId: string,
		chunkIndex: { value: number },
		onError: (error: string) => void
	): (event: BlobEvent) => Promise<void> {
		return async (event: BlobEvent) => {
			console.log(`🎙️ Mixed audio data available: ${event.data?.size || 0} bytes`)
			
			if (event.data && event.data.size > 0 && meetingId) {
				try {
					console.log(`💾 Saving mixed audio chunk ${chunkIndex.value} for Whisper processing`)
					await addChunk(
						meetingId, 
						event.data, 
						chunkIndex.value, 
						'mixed'  // Changed to 'mixed' to indicate this contains both mic + system audio
					)
					console.log(`✅ Mixed audio chunk ${chunkIndex.value} saved: ${event.data.size} bytes`)
					chunkIndex.value++
				} catch (error) {
					console.error('❌ Failed to save mixed audio chunk:', error)
					onError(`Failed to save audio: ${error}`)
				}
			} else {
				// Avoid noisy logs; just trace once in a while
				if (chunkIndex.value % 5 === 0) {
					console.log(`⏳ Waiting for mixed audio data... last size=${event.data?.size || 0}`)
				}
			}
		}
	}
}