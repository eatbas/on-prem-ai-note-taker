/**
 * Audio Cleanup Logic
 * Handles comprehensive cleanup of audio streams and resources
 */

import type { GlobalRecordingState } from './types'

export class AudioCleanupManager {
	private isCleaningUp = false
	
	// Stop audio recording with proper cleanup
	async stopAudioRecording(state: GlobalRecordingState): Promise<void> {
		// Prevent multiple cleanup attempts
		if (this.isCleaningUp) {
			console.log('🔄 Cleanup already in progress, skipping...')
			return
		}
		
		this.isCleaningUp = true
		console.log('🛑 Stopping audio recording...')
		
		try {
			console.log('🔍 Current recording state:', {
				isRecording: state.isRecording,
				hasMicRecorder: !!state.micRecorder,
				hasMicStream: !!state.micStream,
				micRecorderState: state.micRecorder?.state
			})
			
			const stopPromises: Promise<void>[] = []
			
			// Clear force data interval first
			if (state.forceDataInterval) {
				clearInterval(state.forceDataInterval)
				console.log('🧹 Cleared force data interval')
				state.forceDataInterval = null
			}
			
			// Stop microphone recorder with proper cleanup
			if (state.micRecorder) {
				console.log('🎤 Stopping microphone recorder...')
				
				if (state.micRecorder.state === 'recording') {
					// Request final data
					state.micRecorder.requestData()
					
					// Create promise that resolves when recorder stops
					const micStopPromise = this.createRecorderStopPromise(state)
					stopPromises.push(micStopPromise)
					state.micRecorder.stop()
				}
			}
			
			// Wait for all recorders to stop properly
			if (stopPromises.length > 0) {
				console.log('⏳ Waiting for recorders to stop...')
				await Promise.all(stopPromises)
				console.log('✅ All recorders stopped')
			}
			
			// Stop all media streams and tracks
			this.stopAllStreams(state)
			
			// Clear recorder references
			this.clearRecorderReferences(state)
			
			// Comprehensive cleanup
			await this.performComprehensiveCleanup()
			
			console.log('✅ Audio recording stopped successfully - microphone should be released')
		} catch (error) {
			console.error('❌ Error stopping audio recording:', error)
			// Don't throw error to prevent app crash
		} finally {
			this.isCleaningUp = false
		}
	}

	// Create promise that resolves when recorder stops
	private createRecorderStopPromise(state: GlobalRecordingState): Promise<void> {
		return new Promise<void>((resolve) => {
			const recorder = state.micRecorder
			if (!recorder) {
				resolve()
				return
			}
			const handleStop = () => {
				console.log('🎤 Microphone recorder stopped')
				recorder.removeEventListener('stop', handleStop)
				resolve()
			}
			recorder.addEventListener('stop', handleStop, { once: true })
			
			// Add timeout to prevent hanging
			setTimeout(() => {
				if (recorder.state !== 'inactive') {
					console.warn('⚠️ Microphone recorder stop timeout — forcing stop and tracks end')
					try {
						// Stop recorder defensively
						try { recorder.stop() } catch (_) {}
						// Force-stop tracks to unblock recorder if needed
						state.micStream?.getTracks().forEach((track) => {
							if (track.readyState !== 'ended') {
								track.stop()
							}
						})
					} catch (e) {
						console.warn('⚠️ Failed forcing mic track stop after timeout:', e)
					}
				}
				resolve()
			}, 2000)
		})
	}

	// Stop all media streams aggressively
	private stopAllStreams(state: GlobalRecordingState): void {
		console.log('🔌 Stopping all media streams and tracks...')
		
		if (state.micStream) {
			console.log('🎤 Stopping microphone stream tracks...')
			state.micStream.getTracks().forEach((track, index) => {
				console.log(`🎤 Stopping mic track ${index}: ${track.kind}, state: ${track.readyState}`)
				try {
					track.stop()
					console.log(`✅ Mic track ${index} stopped`)
				} catch (e) {
					console.warn(`⚠️ Failed to stop mic track ${index}:`, e)
				}
			})
			state.micStream = null
		}
	}

	// Clear all recorder references
	private clearRecorderReferences(state: GlobalRecordingState): void {
		if (state.micRecorder) {
			try {
				state.micRecorder.ondataavailable = null
				state.micRecorder.onstop = null
				state.micRecorder.onerror = null
			} catch (e) {
				console.warn('⚠️ Error clearing mic recorder events:', e)
			}
			state.micRecorder = null
		}
	}

	// Perform comprehensive cleanup to ensure microphone release
	private async performComprehensiveCleanup(): Promise<void> {
		// Small delay to ensure cleanup is complete
		await new Promise(resolve => setTimeout(resolve, 100))
		
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
		// Add safety check to prevent multiple cleanup calls
		if ((window as any).forceMicCleanup && typeof (window as any).forceMicCleanup === 'function') {
			console.log('🚨 Calling emergency microphone cleanup...')
			try {
				// Prevent multiple cleanup attempts
				if (!(window as any).micCleanupInProgress) {
					(window as any).micCleanupInProgress = true
					;(window as any).forceMicCleanup()
					setTimeout(() => {
						(window as any).micCleanupInProgress = false
					}, 1000)
				} else {
					console.log('🔄 Mic cleanup already in progress, skipping...')
				}
			} catch (e) {
				console.warn('⚠️ Emergency mic cleanup failed:', e)
				;(window as any).micCleanupInProgress = false
			}
		}
		
		// Try to clear any lingering stream references
		try {
			if ((window as any).currentMicStream) {
				(window as any).currentMicStream = null
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
		}, 1000)
	}

	// Force stop recording (for emergencies)
	forceStopRecording(state: GlobalRecordingState): void {
		console.warn('🚨 EMERGENCY: Force stopping recording and releasing microphone...')
		
		// Aggressively stop all media streams and tracks
		if (state.micStream) {
			console.log('🚨 Force stopping microphone stream...')
			state.micStream.getTracks().forEach((track, index) => {
				try {
					console.log(`🚨 Force stopping mic track ${index}`)
					track.stop()
				} catch (e) {
					console.error(`Failed to stop mic track ${index}:`, e)
				}
			})
			state.micStream = null
		}
		
		// Force stop recorders
		if (state.micRecorder) {
			try {
				if (state.micRecorder.state === 'recording') {
					state.micRecorder.stop()
				}
				state.micRecorder.ondataavailable = null
				state.micRecorder = null
			} catch (e) {
				console.error('Failed to stop mic recorder:', e)
				state.micRecorder = null
			}
		}
		
		// Clear all intervals
		if (state.recordingInterval) {
			clearInterval(state.recordingInterval)
			state.recordingInterval = null
		}
		if (state.forceDataInterval) {
			clearInterval(state.forceDataInterval)
			state.forceDataInterval = null
		}
		
		// Emergency cleanup
		if ((window as any).forceMicCleanup) {
			try {
				(window as any).forceMicCleanup()
			} catch (e) {
				console.error('Emergency mic cleanup failed:', e)
			}
		}
		
		console.log('🚨 Emergency force stop completed - microphone should be released')
	}
}
