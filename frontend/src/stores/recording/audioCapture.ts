/**
 * Audio Capture Logic
 * Handles system audio and microphone capture
 */

import type { RecordingOptions } from './types'

export class AudioCaptureManager {
	// Capture system audio with comprehensive error handling
	async captureSystemAudio(): Promise<MediaStream | null> {
		// Early exit if already disabled to prevent repeated attempts
		if (localStorage.getItem('systemAudioDisabled') === 'true') {
			console.log('🚫 System audio capture disabled - skipping')
			return null
		}
		let systemStream: MediaStream | null = null
		console.log('🔍 Checking desktopCapture API availability:', {
			hasDesktopCapture: !!(window as any).desktopCapture,
			hasCaptureSystemAudio: !!((window as any).desktopCapture?.captureSystemAudio),
			windowKeys: Object.keys(window).filter(k => k.includes('desktop') || k.includes('Capture'))
		})
		
		// This check is now at the top of the function
		
		if (!(window as any).desktopCapture) {
			console.log('❌ desktopCapture API not available - system audio capture skipped')
			return null
		}

		try {
			// 1) Smart Windows loopback device detection (Stereo Mix / VB-Cable / VoiceMeeter / Loopback)
			try {
				const getDevices = async (): Promise<MediaDeviceInfo[]> => {
					try {
						return await navigator.mediaDevices.enumerateDevices()
					} catch (e) {
						console.warn('⚠️ enumerateDevices failed:', e)
						return []
					}
				}
				let devices = await getDevices()
				const labelsHidden = devices.every(d => !d.label)
				if (labelsHidden) {
					console.log('🔐 Device labels hidden; briefly requesting mic permission to reveal labels...')
					try {
						const temp = await navigator.mediaDevices.getUserMedia({ audio: true })
						temp.getTracks().forEach(t => t.stop())
						await new Promise(resolve => setTimeout(resolve, 50))
					} catch (permErr) {
						console.warn('⚠️ Could not get permission to reveal device labels:', permErr)
					}
					devices = await getDevices()
				}
				const loopbackKeywords = [
					'stereo mix', 'what u hear', 'loopback', 'wave out', 'speakers (loopback)',
					'vb-audio cable', 'voice meeter', 'voicemeeter', 'cable output', 'virtual audio'
				]
				const maybeLoopback = devices.find(d => (
					d.kind === 'audioinput' && d.label && loopbackKeywords.some(k => d.label.toLowerCase().includes(k))
				))
				if (maybeLoopback?.deviceId) {
					console.log('🎧 Found loopback input device for system audio:', maybeLoopback.label)
					try {
						const stream = await navigator.mediaDevices.getUserMedia({
							audio: {
								deviceId: { exact: maybeLoopback.deviceId },
								echoCancellation: false,
								noiseSuppression: false,
								autoGainControl: false,
								sampleRate: 44100,
								channelCount: 2
							}
						})
						const audioTracks = stream.getAudioTracks()
						if (audioTracks.length > 0) {
							console.log('✅ System audio capture via loopback device successful:', audioTracks.map(t => t.label))
							return stream
						}
						console.warn('⚠️ Loopback device stream has no audio tracks, falling back...')
					} catch (loopErr) {
						console.warn('⚠️ Loopback device capture failed, will try other methods:', loopErr)
					}
				}
			} catch (loopDetectError) {
				console.warn('⚠️ Loopback device detection failed, continuing with standard methods:', loopDetectError)
			}

			console.log('🔊 Attempting system audio capture (desktop)...')
			
			// Add timeout to prevent hanging
			const capturePromise = (window as any).desktopCapture.captureSystemAudio()
			const timeoutPromise = new Promise((_, reject) => 
				setTimeout(() => reject(new Error('System audio capture timeout')), 5000)
			)
			
			systemStream = await Promise.race([capturePromise, timeoutPromise]) as MediaStream
			
			console.log('🎵 System audio stream result:', {
				hasStream: !!systemStream,
				audioTracks: systemStream?.getAudioTracks()?.length || 0,
				trackLabels: systemStream?.getAudioTracks()?.map(t => t.label) || []
			})
		} catch (err) {
			console.log('⚠️ System audio capture failed:', err)
			
			// Disable system audio capture for various error types to prevent crashes
			const errorMessage = err instanceof Error ? err.message : String(err)
			const shouldDisable = errorMessage.includes('IPC') || 
								errorMessage.includes('bad_message') ||
								errorMessage.includes('Not supported') ||
								errorMessage.includes('timeout') ||
								errorMessage.includes('DOMException') ||
								errorMessage.includes('getDisplayMedia') ||
								errorMessage.includes('desktopCapturer')
			
			if (shouldDisable) {
				console.log('🚫 Disabling system audio capture due to error to prevent crashes:', errorMessage)
				localStorage.setItem('systemAudioDisabled', 'true')
				// Clear any interval that might be retrying
				this.clearRetryAttempts()
			}
		}

		return systemStream
	}

	// Capture microphone with specified constraints
	async captureMicrophone(options: RecordingOptions): Promise<MediaStream> {
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
		
		const micStream = await navigator.mediaDevices.getUserMedia(micConstraints)
		console.log('✅ Microphone stream ready')
		return micStream
	}

	// Create final mixed stream from system and microphone audio
	createMixedStream(systemStream: MediaStream | null, micStream: MediaStream): { stream: MediaStream; audioContext: AudioContext | null } {
		let finalStream: MediaStream | null = null

		if (systemStream && systemStream.getAudioTracks().length > 0) {
			try {
				console.log('🎚️ Mixing mic + system audio into one stream...')
				const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
					sampleRate: 44100
				}) as AudioContext
				
				const destination = audioContext.createMediaStreamDestination()
				const micSource = audioContext.createMediaStreamSource(micStream)
				micSource.connect(destination)
				const sysSource = audioContext.createMediaStreamSource(systemStream)
				sysSource.connect(destination)
				finalStream = destination.stream
				
				console.log('✅ Mixed stream created with both mic and system audio')
				return { stream: finalStream, audioContext }
			} catch (mixErr) {
				console.warn('⚠️ Audio mixing failed; falling back to mic-only:', mixErr)
				// Clean up system stream if mixing fails
				systemStream.getTracks().forEach(track => track.stop())
				finalStream = micStream
			}
		} else {
			console.log('ℹ️ No system audio available, using mic-only recording')
			finalStream = micStream
		}
		
		// Ensure we always have a valid stream
		if (!finalStream || finalStream.getAudioTracks().length === 0) {
			console.error('❌ No valid audio stream available, falling back to mic-only')
			finalStream = micStream
		}

		return { stream: finalStream, audioContext: null }
	}

	// Create MediaRecorder with proper event handlers
	createMediaRecorder(stream: MediaStream, onDataAvailable: (event: BlobEvent) => Promise<void>): MediaRecorder {
		const recordingOptions: MediaRecorderOptions = {
			mimeType: 'audio/webm;codecs=opus',
			bitsPerSecond: 128000
		}
		
		const recorder = new MediaRecorder(stream, recordingOptions)
		
		// Setup event handler with error handling
		recorder.ondataavailable = async (event: BlobEvent) => {
			try {
				await onDataAvailable(event)
			} catch (error) {
				console.error('❌ Error in data available handler:', error)
			}
		}
		
		// Add error handler
		recorder.onerror = (event: any) => {
			console.error('❌ MediaRecorder error:', event.error)
		}
		
		return recorder
	}

	// Clear any retry attempts
	private clearRetryAttempts(): void {
		// This can be extended later if we add retry logic
		console.log('🧹 Clearing retry attempts...')
	}
}
