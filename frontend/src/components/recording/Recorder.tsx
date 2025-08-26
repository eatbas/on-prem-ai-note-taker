import React, { useEffect, useRef, useState } from 'react'
import { addChunk, createMeeting, syncMeeting, autoProcessMeetingRecording, db } from '../../services'
import { globalRecordingManager, GlobalRecordingState } from '../../stores/globalRecordingManager'

// Add CSS animations for the component
const pulseAnimation = `
@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}
`

// Inject the CSS animation
if (typeof document !== 'undefined') {
	const style = document.createElement('style')
	style.textContent = pulseAnimation
	document.head.appendChild(style)
}

export default function Recorder({ 
	onCreated, 
	onStopped,
	text,
	setText,
	tag,
	setTag,
	online,
	vpsUp,
	showStopButton = true
}: { 
	onCreated: (meetingId: string) => void; 
	onStopped?: (meetingId: string) => void;
	text: string;
	setText: (text: string) => void;
	tag: string;
	setTag: (tag: string) => void;
	online: boolean;
	vpsUp: boolean | null;
	showStopButton?: boolean;
}) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle')
	const [retryCount, setRetryCount] = useState(0)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [totalChunks, setTotalChunks] = useState(0)
	const [showMicModal, setShowMicModal] = useState(false)
	const [systemAudioLevel, setSystemAudioLevel] = useState(0)
	const [microphoneLevel, setMicrophoneLevel] = useState(0)
	
	// Use global recording state
	const [globalRecordingState, setGlobalRecordingState] = useState<GlobalRecordingState>(globalRecordingManager.getState())
	const [showInterruptionDialog, setShowInterruptionDialog] = useState(false)
	const [interruptedInfo, setInterruptedInfo] = useState<{ meetingId: string; recordingTime: number } | null>(null)
	
	// Derived state from global manager
	const recording = globalRecordingState.isRecording
	const meetingId = globalRecordingState.meetingId
	const recordingTime = globalRecordingState.recordingTime
	const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([])
	const [selectedMic, setSelectedMic] = useState<string>('')
	const [language, setLanguage] = useState<'tr' | 'en'>('tr')

	// Listen for global event from floating window to open mic selector
	useEffect(() => {
		const handler = () => setShowMicModal(true)
		window.addEventListener('open-mic-selector', handler)
		return () => window.removeEventListener('open-mic-selector', handler)
	}, [])


	const audioContextRef = useRef<AudioContext | null>(null)
	const analyserRef = useRef<AnalyserNode | null>(null)
	const microphoneAnalyserRef = useRef<AnalyserNode | null>(null)
	const animationFrameRef = useRef<number | null>(null)

	// Mixing graph refs (to merge mic + system audio into a single track)
	const mixingAudioContextRef = useRef<AudioContext | null>(null)
	const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
	const mixSourceNodesRef = useRef<MediaStreamAudioSourceNode[]>([])
	const mixGainNodesRef = useRef<GainNode[]>([])
	const activeStreamsRef = useRef<MediaStream[]>([])
	
	// Microphone usage monitoring
	const [micUsageLevels, setMicUsageLevels] = useState<Record<string, number>>({})
	const [isMonitoringMics, setIsMonitoringMics] = useState(false)
	const micMonitorContextsRef = useRef<Record<string, AudioContext>>({})
	const micMonitorAnalysersRef = useRef<Record<string, AnalyserNode>>({})
	const micMonitorStreamsRef = useRef<Record<string, MediaStream>>({})
	const micMonitorAnimationRef = useRef<number | null>(null)

	// Subscribe to global recording manager
	useEffect(() => {
		const unsubscribe = globalRecordingManager.subscribe((state) => {
			setGlobalRecordingState(state)
		})
		
		// Initialize with current state
		setGlobalRecordingState(globalRecordingManager.getState())
		
		// Check for interrupted recording on component mount
		if (globalRecordingManager.isRecordingInterrupted()) {
			const info = globalRecordingManager.getInterruptedRecordingInfo()
			if (info) {
				setInterruptedInfo(info)
				setShowInterruptionDialog(true)
				console.warn('🎙️ Recording interrupted by page refresh:', info)
			}
		}
		
		return unsubscribe
	}, [])

	// Handle interruption dialog actions
	const handleResumeRecording = async () => {
		if (interruptedInfo) {
			console.log('🎙️ User chose to resume interrupted recording')
			// Attempt to resume recording
			const success = await globalRecordingManager.attemptResumeRecording()
			if (success) {
				setShowInterruptionDialog(false)
				setInterruptedInfo(null)
				// Notify parent component that recording has resumed
				if (onCreated && interruptedInfo.meetingId) {
					onCreated(interruptedInfo.meetingId)
				}
			} else {
				// If resume failed, show error and offer to clear state
				alert('Failed to resume recording. The recording state will be cleared.')
				handleClearInterruptedState()
			}
		}
	}

	const handleClearInterruptedState = () => {
		console.log('🎙️ User chose to clear interrupted recording state')
		globalRecordingManager.clearInterruptedState()
		setShowInterruptionDialog(false)
		setInterruptedInfo(null)
	}

	// Electron API integration
	useEffect(() => {
		// Listen for tray actions from main process
		if (window.electronAPI) {
			window.electronAPI.onTrayAction((action) => {
				if (action === 'start-recording' && !recording) {
					start()
				} else if (action === 'stop-recording' && recording) {
					stop()
				}
			})
			
			// Cleanup listener on unmount
			return () => {
				window.electronAPI.removeTrayActionListener()
			}
		}
	}, [recording])

	// Update Electron tray when recording state changes
	useEffect(() => {
		if (window.electronAPI) {
			console.log('🎙️ Sending recording state to Electron:', recording)
			window.electronAPI.sendRecordingState(recording)
		}
		// Ensure audio monitoring stops promptly when recording flag turns off
		if (!recording) {
			stopAudioLevelMonitoring()
			stopMixingAndStreams()
		}
	}, [recording])

	// Simplified - no more complex recording data handling needed

	// Function to refresh microphone list
	const refreshMicrophones = async () => {
		try {
			// Request microphone permission first to get proper device labels
			await navigator.mediaDevices.getUserMedia({ audio: true })
			
			// Try a different approach - get devices after requesting audio
			const devices = await navigator.mediaDevices.enumerateDevices()
			const audioInputs = devices.filter(device => device.kind === 'audioinput')
			
			console.log('All audio input devices found:', audioInputs.map(device => ({
				label: device.label,
				deviceId: device.deviceId.slice(0, 20) + '...',
				kind: device.kind
			})))
			
			// Show all real devices (not brand-limited). Hide only the Communications duplicates.
			// Deduplicate by label+groupId to avoid multiple entries of the same physical mic.
			const dedupMap = new Map<string, MediaDeviceInfo>()
			for (const device of audioInputs) {
				const labelLower = device.label.toLowerCase()
				// Skip the special "Communications" alias often shown on Windows
				if (labelLower.startsWith('communications')) continue
				const key = `${device.label}|${device.groupId || ''}`
				if (!dedupMap.has(key)) dedupMap.set(key, device)
			}
			const cleanDevices = Array.from(dedupMap.values())
			// Sort: default first if present, then by label
			cleanDevices.sort((a, b) => {
				const aDef = /default/i.test(a.label) ? -1 : 0
				const bDef = /default/i.test(b.label) ? -1 : 0
				if (aDef !== bDef) return aDef - bDef
				return a.label.localeCompare(b.label)
			})
			
			setAvailableMics(cleanDevices)
			
			// Set default microphone if available (prefer device labeled as Default)
			if (cleanDevices.length > 0 && !selectedMic) {
				const preferred = cleanDevices.find(d => /default/i.test(d.label)) || cleanDevices[0]
				setSelectedMic(preferred.deviceId)
			}
			
			console.log('Clean microphones:', cleanDevices.map(mic => ({
				label: mic.label,
				deviceId: mic.deviceId.slice(0, 20) + '...',
				kind: mic.kind
			})))
			
			// Start monitoring microphone usage levels if modal is open
			if (showMicModal) {
				startMicrophoneUsageMonitoring(cleanDevices)
			}
			
		} catch (err) {
			console.error('Failed to refresh microphones:', err)
		}
	}

	// Start monitoring microphone usage levels
	const startMicrophoneUsageMonitoring = async (mics: MediaDeviceInfo[]) => {
		if (isMonitoringMics) return
		
		setIsMonitoringMics(true)
		console.log('Starting microphone usage monitoring for', mics.length, 'microphones')
		
		try {
			// Stop any existing monitoring first
			stopMicrophoneUsageMonitoring()
			
			// Try to get audio streams for each microphone to monitor their levels
			for (const mic of mics) {
				try {
					const stream = await navigator.mediaDevices.getUserMedia({
						audio: {
							deviceId: { exact: mic.deviceId },
							echoCancellation: false,
							noiseSuppression: false,
							autoGainControl: false
						}
					})
					
					const audioContext = new AudioContext()
					const analyser = audioContext.createAnalyser()
					const source = audioContext.createMediaStreamSource(stream)
					
					analyser.fftSize = 256
					analyser.smoothingTimeConstant = 0.3
					analyser.minDecibels = -90
					analyser.maxDecibels = -10
					
					source.connect(analyser)
					
					// Store references for cleanup
					micMonitorContextsRef.current[mic.deviceId] = audioContext
					micMonitorAnalysersRef.current[mic.deviceId] = analyser
					micMonitorStreamsRef.current[mic.deviceId] = stream
					
					console.log(`Started monitoring mic: ${mic.label}`)
				} catch (err) {
					console.warn(`Failed to monitor mic ${mic.label}:`, err)
				}
			}
			
			// Start the monitoring loop
			updateMicrophoneUsageLevels()
			
		} catch (err) {
			console.error('Failed to start microphone usage monitoring:', err)
			setIsMonitoringMics(false)
		}
	}

	// Stop monitoring microphone usage levels
	const stopMicrophoneUsageMonitoring = () => {
		if (!isMonitoringMics) return
		
		console.log('Stopping microphone usage monitoring')
		
		// Cancel animation frame
		if (micMonitorAnimationRef.current) {
			cancelAnimationFrame(micMonitorAnimationRef.current)
			micMonitorAnimationRef.current = null
		}
		
		// Clean up all audio contexts and streams
		Object.values(micMonitorContextsRef.current).forEach(context => {
			try {
				context.close()
			} catch (err) {
				console.warn('Error closing audio context:', err)
			}
		})
		
		Object.values(micMonitorStreamsRef.current).forEach(stream => {
			try {
				stream.getTracks().forEach(track => track.stop())
			} catch (err) {
				console.warn('Error stopping stream:', err)
			}
		})
		
		// Clear references
		micMonitorContextsRef.current = {}
		micMonitorAnalysersRef.current = {}
		micMonitorStreamsRef.current = {}
		
		// Reset state
		setMicUsageLevels({})
		setIsMonitoringMics(false)
	}

	// Update microphone usage levels
	const updateMicrophoneUsageLevels = () => {
		const newLevels: Record<string, number> = {}
		
		Object.entries(micMonitorAnalysersRef.current).forEach(([deviceId, analyser]) => {
			try {
				const dataArray = new Uint8Array(analyser.frequencyBinCount)
				analyser.getByteFrequencyData(dataArray)
				
				// Calculate RMS (Root Mean Square) for better level representation
				const sum = dataArray.reduce((acc, value) => acc + value * value, 0)
				const rms = Math.sqrt(sum / dataArray.length)
				const normalizedLevel = rms / 255
				
				newLevels[deviceId] = normalizedLevel
			} catch (err) {
				console.warn(`Error reading mic level for device ${deviceId}:`, err)
				newLevels[deviceId] = 0
			}
		})
		
		setMicUsageLevels(newLevels)
		
		// Continue monitoring if still active
		if (isMonitoringMics) {
			micMonitorAnimationRef.current = requestAnimationFrame(updateMicrophoneUsageLevels)
		}
	}

	useEffect(() => {
		// Load available microphones
		refreshMicrophones()
		
		// Listen for device changes
		navigator.mediaDevices.addEventListener('devicechange', refreshMicrophones)
		
		return () => {
			navigator.mediaDevices.removeEventListener('devicechange', refreshMicrophones)
		}
	}, [selectedMic])

	// Start/stop microphone monitoring when modal opens/closes
	useEffect(() => {
		if (showMicModal && availableMics.length > 0 && !recording) {
			// Only start mic monitoring if not recording (to avoid conflicts)
			startMicrophoneUsageMonitoring(availableMics)
		} else if (!showMicModal || recording) {
			stopMicrophoneUsageMonitoring()
		}
	}, [showMicModal, availableMics, recording])

	// Cleanup microphone monitoring on unmount
	useEffect(() => {
		return () => {
			stopMicrophoneUsageMonitoring()
		}
	}, [])

	// Cleanup - Don't stop recording on unmount, let it persist globally
	useEffect(() => {
		return () => {
			// Only clean up microphone monitoring, not recording
			const currentState = globalRecordingManager.getState()
			console.log('📦 Recorder component unmounting - recording will persist globally. Current state:', {
				isRecording: currentState.isRecording,
				meetingId: currentState.meetingId,
				recordingTime: currentState.recordingTime
			})
			
			// Stop microphone usage monitoring to free up resources
			if (isMonitoringMics) {
				stopMicrophoneUsageMonitoring()
			}
			// Also stop any audio level monitoring/mixing graphs that might still be active
			stopAudioLevelMonitoring()
			stopMixingAndStreams()
		}
	}, [isMonitoringMics])

	async function start() {
		try {
			// Check if media devices are supported
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('Media devices not supported in this browser')
			}

			// Check if we're running on a secure context: HTTPS, localhost, local LAN, or Electron custom scheme
			const isElectronApp = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')
			const isCustomAppScheme = location.protocol === 'app:'
			const isHttps = location.protocol === 'https:'
			const isLocalhost = location.hostname === 'localhost'
			const isLan = location.hostname.startsWith('192.168.')
			if (!(isHttps || isLocalhost || isLan || isCustomAppScheme || isElectronApp)) {
				throw new Error('Microphone access requires HTTPS or localhost. Current protocol: ' + location.protocol)
			}

			setError(null)
			setShowMicModal(true)
		} catch (err) {
			console.error('Failed to start recording:', err)
			setError(err instanceof Error ? err.message : 'Failed to start recording')
		}
	}

	async function startRecordingWithSelectedMic() {
		try {
			setError(null)

			// Automatically select the first available microphone if none is selected
			if (!selectedMic && availableMics.length > 0) {
				setSelectedMic(availableMics[0].deviceId)
			}

			// Create a combined stream with both system audio and microphone
			let combinedStream: MediaStream
			let systemAudioStreams: MediaStream[] = []
			let micStream: MediaStream

			try {
				// Get ALL available system audio sources (desktop capture)
				if (typeof window !== 'undefined' && (window as any).desktopCapture) {
					try {
						const sources = await (window as any).desktopCapture.getSources(['screen', 'window'])
						console.log('Available desktop sources for audio capture:', sources)
						
						// Capture from ALL screen/window sources, not just the first one
						for (const source of sources) {
							try {
								// In Chromium/Electron, requesting audio-only desktop can fail unless a desktop video track is also requested.
								const desktopStream = await (navigator.mediaDevices as any).getUserMedia({
									video: {
										mandatory: {
											chromeMediaSource: 'desktop',
											chromeMediaSourceId: source.id
										}
									},
									audio: {
										mandatory: {
											chromeMediaSource: 'desktop'
										}
									}
								})
								// Extract only audio tracks; stop the video track to conserve resources
								const audioOnly = new MediaStream(desktopStream.getAudioTracks())
								desktopStream.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop())
								systemAudioStreams.push(audioOnly)
								console.log(`Successfully captured audio from: ${source.name || source.id}`)
							} catch (err) {
								console.log(`Failed to capture audio from source ${source.name || source.id}:`, err)
							}
						}
						
						if (systemAudioStreams.length > 0) {
							console.log(`Successfully captured audio from ${systemAudioStreams.length} system audio sources`)
						} else {
							console.log('No system audio sources could be captured via desktopCapturer')
						}
					} catch (err) {
						console.log('System audio capture not available, continuing with microphone only:', err)
					}
				}

				// Browser fallback (and additional attempt in Electron): try getDisplayMedia with audio
				if (systemAudioStreams.length === 0 && (navigator.mediaDevices as any).getDisplayMedia) {
					try {
						const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true })
						if (displayStream && displayStream.getAudioTracks().length > 0) {
							const audioOnly = new MediaStream(displayStream.getAudioTracks())
							systemAudioStreams.push(audioOnly)
							console.log('Captured system audio via getDisplayMedia fallback')
						}
					} catch (err) {
						console.log('getDisplayMedia system audio capture failed or was denied by the user:', err)
					}
				}

				// Get microphone stream - use selected mic or first available
				const micToUse = selectedMic || (availableMics.length > 0 ? availableMics[0].deviceId : undefined)
				micStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						// If the selected device is the special 'default' id, let the browser pick
						deviceId: micToUse && micToUse !== 'default' ? { exact: micToUse } : undefined
					}
				})

				// Build a WebAudio mixing graph to merge all sources into a single track
				// Cleanup any previous mixing session
				if (mixingAudioContextRef.current) {
					try { mixingAudioContextRef.current.close() } catch {}
				}
				mixSourceNodesRef.current = []
				mixGainNodesRef.current = []
				activeStreamsRef.current = []
				
				const ctx = new AudioContext()
				mixingAudioContextRef.current = ctx
				const dest = ctx.createMediaStreamDestination()
				mixDestinationRef.current = dest
				
				// Helper to add a stream into the mix
				const addStreamToMix = (stream: MediaStream, gainValue: number) => {
					try {
						const source = ctx.createMediaStreamSource(stream)
						const gain = ctx.createGain()
						gain.gain.value = gainValue
						source.connect(gain)
						gain.connect(dest)
						mixSourceNodesRef.current.push(source)
						mixGainNodesRef.current.push(gain)
						activeStreamsRef.current.push(stream)
					} catch (e) {
						console.warn('Failed to add stream to mix:', e)
					}
				}
				
				// Add mic with normal gain
				addStreamToMix(micStream, 1.0)
				// Add each system audio stream (slightly reduced to avoid clipping)
				systemAudioStreams.forEach(s => addStreamToMix(s, 0.9))
				
				combinedStream = dest.stream
				
				console.log(`Mixing graph created. Sources ->  mic: ${micStream.getAudioTracks().length}, system: ${systemAudioStreams.reduce((total, s) => total + s.getAudioTracks().length, 0)}`)

			} catch (err) {
				console.error('Failed to get audio streams:', err)
				throw new Error('Failed to access audio devices')
			}

			// Prefer higher-quality Opus in WebM with an explicit bitrate
			const rec = new MediaRecorder(combinedStream, { 
				mimeType: 'audio/webm;codecs=opus',
				bitsPerSecond: 128000 // 128 kbps for clearer speech
			})
			// Default meeting title with start date/time for uniqueness
			const now = new Date()
			const human = now.toLocaleString()
			const meeting = await createMeeting(`Meeting ${human}`, [], language)
			const createdId = meeting.id
			
			// Call onCreated callback
			onCreated(createdId)

			// Use env-driven chunk size (default 30s) for better context
			const chunkMs = Number((import.meta as any).env?.VITE_AUDIO_CHUNK_MS ?? 30000)
			rec.start(isNaN(chunkMs) ? 30000 : chunkMs)
			mediaRecorderRef.current = rec
			
			// Use global recording manager instead of local state
			globalRecordingManager.startRecording(createdId, rec)
			
			setShowMicModal(false)

			// Notify Electron process that recording has started
			if (window.electronAPI) {
				window.electronAPI.sendRecordingState(true)
				// Respect user preference for showing floating widget
				const showFloating = (document.getElementById('pref-show-floating') as HTMLInputElement | null)?.checked ?? true
				window.electronAPI.sendRecordingStarted({ meetingId: createdId, recordingTime: 0, showFloating })
			}

			// Start audio level monitoring with ALL system audio streams
			startAudioLevelMonitoring(systemAudioStreams, micStream)
			
			// Also update the microphone usage monitoring to show the recording mic is active
			if (selectedMic) {
				// Force update the mic usage levels to show activity
				setTimeout(() => {
					console.log('🎤 Updating mic usage monitoring for recording microphone')
					setMicUsageLevels(prev => ({
						...prev,
						[selectedMic]: microphoneLevel > 0 ? microphoneLevel : 0.1 // Show at least some activity during recording
					}))
				}, 1000)
			}

		} catch (err) {
			console.error('Failed to start recording:', err)
			setError(err instanceof Error ? err.message : 'Failed to start recording')
		}
	}

	function stop() {
		// Use global recording manager to stop recording
		const stoppedMeetingId = globalRecordingManager.stopRecording()
		
		// Stop audio level monitoring
		stopAudioLevelMonitoring()
		// Stop mixing graph and any active streams
		stopMixingAndStreams()
		
		// Notify Electron process that recording has stopped
		if (window.electronAPI) {
			window.electronAPI.sendRecordingState(false)
		}
		
		// IMMEDIATELY call onStopped callback to update App-level state
		// This ensures the recording state is properly cleared
		if (onStopped && stoppedMeetingId) {
			console.log('🔄 Calling onStopped callback immediately to update App state')
			onStopped(stoppedMeetingId)
		}
		
		// Ask for meeting name and persist duration locally
		if (stoppedMeetingId) {
			const title = (window.prompt('Name this meeting', 'New meeting') || '').trim()
			if (title) {
				// Update meeting title and duration locally
				// @ts-ignore - duration is optional
				db.meetings.update(stoppedMeetingId, { title, updatedAt: Date.now(), duration: recordingTime })
			}
			
			// Automatically process the meeting after recording ends
			setTimeout(async () => {
				try {
					console.log('Auto-processing meeting after recording ended...')
					setSyncStatus('syncing')
					await autoProcessMeetingRecording(stoppedMeetingId, title)
					console.log('Meeting auto-processed successfully!')
					setSyncStatus('success')
					setRetryCount(0) // Reset retry count on success
					// Reset success status after 3 seconds
					setTimeout(() => setSyncStatus('idle'), 3000)
					
					// Now call onStopped to refresh dashboard with complete meeting data
					if (onStopped) {
						console.log('🔄 Calling onStopped callback after successful meeting processing')
						onStopped(stoppedMeetingId)
					}
				} catch (error) {
					console.error('Auto-processing failed:', error)
					setSyncStatus('failed')
					
					// Auto-retry with exponential backoff (max 3 retries)
					if (retryCount < 3) {
						const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // 1s, 2s, 4s, 8s, 10s max
						console.log(`Auto-retry in ${delay/1000} seconds... (attempt ${retryCount + 1}/3)`)
						setTimeout(() => {
							setRetryCount(prev => prev + 1)
							setSyncStatus('syncing')
							// Recursive retry
							retryAutoProcess(stoppedMeetingId, title, retryCount + 1)
						}, delay)
					} else {
						console.log('Max retries reached, giving up auto-processing')
						// Reset retry count and failed status after 5 seconds
						setTimeout(() => {
							setSyncStatus('idle')
							setRetryCount(0)
						}, 5000)
					}
				}
			}, 1000) // Small delay to ensure all data is saved
		}
	}

	// Helper function for retrying auto-processing with exponential backoff
	async function retryAutoProcess(meetingId: string, title: string, attempt: number) {
		try {
			await autoProcessMeetingRecording(meetingId, title)
			console.log(`Meeting auto-processed successfully on retry attempt ${attempt}!`)
			setSyncStatus('success')
			setRetryCount(0) // Reset retry count on success
			// Reset success status after 3 seconds
			setTimeout(() => setSyncStatus('idle'), 3000)
		} catch (error) {
			console.error(`Auto-processing retry attempt ${attempt} failed:`, error)
			setSyncStatus('failed')
			
			// Continue retry chain if we haven't reached max attempts
			if (attempt < 3) {
				const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
				console.log(`Auto-retry in ${delay/1000} seconds... (attempt ${attempt + 1}/3)`)
				setTimeout(() => {
					setRetryCount(prev => prev + 1)
					setSyncStatus('syncing')
					// Recursive retry
					retryAutoProcess(meetingId, title, attempt + 1)
				}, delay)
			} else {
				console.log('Max retries reached, giving up auto-processing')
				// Reset retry count and failed status after 5 seconds
				setTimeout(() => {
					setSyncStatus('idle')
					setRetryCount(0)
				}, 5000)
			}
		}
	}

	// Format time for display (MM:SS)
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	// Store multiple system audio analyzers
	const systemAnalyzersRef = useRef<AnalyserNode[]>([])

	// Audio level monitoring functions
	function startAudioLevelMonitoring(systemStreams: MediaStream[], micStream: MediaStream) {
		if (audioContextRef.current) {
			audioContextRef.current.close()
		}
		
		// Clear previous system analyzers
		systemAnalyzersRef.current = []
		
		audioContextRef.current = new AudioContext()
		
		// Monitor system audio levels from ALL sources
		if (systemStreams.length > 0 && audioContextRef.current) {
			console.log(`Setting up audio monitoring for ${systemStreams.length} system audio sources`)
			
			systemStreams.forEach((stream, index) => {
				const systemSource = audioContextRef.current!.createMediaStreamSource(stream)
				const analyser = audioContextRef.current!.createAnalyser()
				analyser.fftSize = 256
				analyser.smoothingTimeConstant = 0.3
				analyser.minDecibels = -90
				analyser.maxDecibels = -10
				systemSource.connect(analyser)
				systemAnalyzersRef.current.push(analyser)
				console.log(`System audio source ${index + 1} analyzer created`)
			})
		}
		
		// Monitor microphone levels
		if (audioContextRef.current) {
			const micSource = audioContextRef.current.createMediaStreamSource(micStream)
			microphoneAnalyserRef.current = audioContextRef.current.createAnalyser()
			microphoneAnalyserRef.current.fftSize = 256
			microphoneAnalyserRef.current.smoothingTimeConstant = 0.3
			microphoneAnalyserRef.current.minDecibels = -90
			microphoneAnalyserRef.current.maxDecibels = -10
			micSource.connect(microphoneAnalyserRef.current)
			console.log('Microphone analyzer created')
		}
		
		// Start monitoring loop
		function updateAudioLevels() {
			// Aggregate system audio levels from ALL analyzers
			if (systemAnalyzersRef.current.length > 0) {
				let maxSystemLevel = 0
				let totalSystemLevel = 0
				let activeStreams = 0
				
				systemAnalyzersRef.current.forEach((analyser, index) => {
					const systemData = new Uint8Array(analyser.frequencyBinCount)
					analyser.getByteFrequencyData(systemData)
					// Calculate RMS (Root Mean Square) for better level representation
					const systemSum = systemData.reduce((sum, value) => sum + value * value, 0)
					const systemRms = Math.sqrt(systemSum / systemData.length)
					const normalizedLevel = systemRms / 255
					
					// Track the maximum level across all sources (for responsive UI)
					maxSystemLevel = Math.max(maxSystemLevel, normalizedLevel)
					
					// Also track total for averaging
					totalSystemLevel += normalizedLevel
					if (normalizedLevel > 0.01) activeStreams++
					
					// Debug logging for each stream
					if (normalizedLevel > 0.1) {
						console.log(`System Audio Source ${index + 1} Level:`, normalizedLevel.toFixed(3))
					}
				})
				
				// Use the maximum level across all sources to show activity on any source
				setSystemAudioLevel(maxSystemLevel)
				
				// Enhanced debug logging
				if (maxSystemLevel > 0.1) {
					console.log(`Combined System Audio - Max: ${maxSystemLevel.toFixed(3)}, Active sources: ${activeStreams}/${systemAnalyzersRef.current.length}`)
				}
			}
			
			if (microphoneAnalyserRef.current) {
				const micData = new Uint8Array(microphoneAnalyserRef.current.frequencyBinCount)
				microphoneAnalyserRef.current.getByteFrequencyData(micData)
				// Calculate RMS (Root Mean Square) for better level representation
				const micSum = micData.reduce((sum, value) => sum + value * value, 0)
				const micRms = Math.sqrt(micSum / micData.length)
				const normalizedMicLevel = micRms / 255
				setMicrophoneLevel(normalizedMicLevel)
				
				// Debug logging
				if (normalizedMicLevel > 0.1) {
					console.log('Microphone Level:', normalizedMicLevel.toFixed(3))
				}
			}
			
			animationFrameRef.current = requestAnimationFrame(updateAudioLevels)
		}
		
		updateAudioLevels()
	}

	function stopAudioLevelMonitoring() {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}
		
		if (audioContextRef.current) {
			audioContextRef.current.close()
			audioContextRef.current = null
		}
		
		// Clear all system audio analyzers
		systemAnalyzersRef.current = []
		analyserRef.current = null
		microphoneAnalyserRef.current = null
		setSystemAudioLevel(0)
		setMicrophoneLevel(0)
	}

	// Cleanup mixing graph and tracks
	function stopMixingAndStreams() {
		try {
			mixGainNodesRef.current.forEach(g => g.disconnect())
			mixSourceNodesRef.current.forEach(s => s.disconnect())
		} catch {}
		mixGainNodesRef.current = []
		mixSourceNodesRef.current = []
		try {
			activeStreamsRef.current.forEach(stream => {
				stream.getTracks().forEach(track => {
					try { track.stop() } catch {}
				})
			})
		} catch {}
		activeStreamsRef.current = []
		if (mixDestinationRef.current) {
			try { mixDestinationRef.current.disconnect() } catch {}
			mixDestinationRef.current = null
		}
		if (mixingAudioContextRef.current) {
			try { mixingAudioContextRef.current.close() } catch {}
			mixingAudioContextRef.current = null
		}
	}

	// Component to show microphone usage indicator
	const MicrophoneUsageIndicator = ({ deviceId, size = 'small' }: { deviceId: string; size?: 'small' | 'large' }) => {
		const level = micUsageLevels[deviceId] || 0
		const isActive = level > 0.02 // Consider active if above 2% threshold
		const barHeight = size === 'large' ? 20 : 16
		const barWidth = size === 'large' ? 100 : 60
		
		return (
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				fontSize: size === 'large' ? '14px' : '12px'
			}}>
				<div style={{
					display: 'flex',
					alignItems: 'center',
					gap: '4px'
				}}>
					<div style={{ 
						fontSize: size === 'large' ? '16px' : '12px',
						color: isActive ? '#22c55e' : '#9ca3af'
					}}>
						{isActive ? '🎤' : '🔇'}
					</div>
					<div style={{
						width: barWidth,
						height: barHeight,
						backgroundColor: '#f3f4f6',
						borderRadius: '4px',
						border: '1px solid #e5e7eb',
						position: 'relative',
						overflow: 'hidden'
					}}>
						{/* Background bars for visual segments */}
						{[...Array(5)].map((_, i) => (
							<div
								key={i}
								style={{
									position: 'absolute',
									left: `${i * 20}%`,
									top: 0,
									width: '18%',
									height: '100%',
									borderRight: i < 4 ? '1px solid #e5e7eb' : 'none'
								}}
							/>
						))}
						
						{/* Active level indicator */}
						<div
							style={{
								position: 'absolute',
								left: 0,
								top: 0,
								height: '100%',
								width: `${Math.min(level * 100, 100)}%`,
								background: level > 0.7 ? 
									'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)' :
									level > 0.3 ? 
									'linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)' :
									'#22c55e',
								transition: 'width 0.1s ease-out',
								borderRadius: '3px'
							}}
						/>
					</div>
					{size === 'large' && (
						<span style={{
							fontSize: '11px',
							color: isActive ? '#22c55e' : '#9ca3af',
							fontWeight: isActive ? '600' : '400',
							minWidth: '35px'
						}}>
							{isActive ? `${Math.round(level * 100)}%` : 'Silent'}
						</span>
					)}
				</div>
			</div>
		)
	}

	// Recording Control Buttons Component
	const RecordingButtons = () => (
		<div style={{ 
			display: 'flex', 
			gap: '12px', 
			alignItems: 'center' 
		}}>
			<button 
				onClick={start} 
				disabled={recording}
				style={{
					padding: '8px 16px',
					backgroundColor: recording ? '#9ca3af' : '#3b82f6',
					color: 'white',
					border: 'none',
					borderRadius: '6px',
					fontSize: '14px',
					fontWeight: '600',
					cursor: recording ? 'not-allowed' : 'pointer',
					transition: 'all 0.2s ease',
					boxShadow: recording ? 'none' : '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
					transform: recording ? 'scale(0.95)' : 'scale(1)',
					opacity: recording ? 0.6 : 1,
					display: 'flex',
					alignItems: 'center',
					gap: '6px'
				}}
			>
				🎙️ Start
			</button>
			{showStopButton && (
				<button 
					onClick={stop} 
					disabled={!recording}
					style={{
						padding: '8px 16px',
						backgroundColor: !recording ? '#9ca3af' : '#ef4444',
						color: 'white',
						border: 'none',
						borderRadius: '6px',
						fontSize: '14px',
						fontWeight: '600',
						cursor: !recording ? 'not-allowed' : 'pointer',
						transition: 'all 0.2s ease',
						boxShadow: !recording ? 'none' : '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
						transform: !recording ? 'scale(0.95)' : 'scale(1)',
						opacity: !recording ? 0.6 : 1,
						display: 'flex',
						alignItems: 'center',
						gap: '6px'
					}}
				>
					⏹️ Stop
				</button>
			)}
		</div>
	)

	return (
		<>
			{/* Recording Buttons for Top Bar */}
			<RecordingButtons />
			
			{/* Main Content Area - Only show when not in top bar context */}
			<div style={{ 
				display: 'flex', 
				flexDirection: 'column', 
				alignItems: 'center',
				justifyContent: 'center',
				textAlign: 'center',
				minHeight: '50px'
			}}>
				{/* Main Content Area with Microphone and Status Side by Side */}
				<div style={{
					display: 'flex',
					gap: '48px',
					alignItems: 'flex-start',
					marginBottom: '32px',
					width: '100%',
					maxWidth: '900px'
				}}>
					{/* Left Side - Empty for now */}
					<div style={{ 
						display: 'flex', 
						flexDirection: 'column', 
						alignItems: 'center',
						flex: 1
					}}>
						{/* Content removed as requested */}
					</div>
				</div>

				{/* Recording Status - Removed as requested */}

				{/* Microphone Selection Modal */}
				{showMicModal && (
					<div style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000
					}}>
						<div style={{
							backgroundColor: 'white',
							padding: '24px',
							borderRadius: '12px',
							maxWidth: '400px',
							width: '90%',
							boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: '16px'
							}}>
								<h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
									Select Microphone
								</h3>
								<button
									onClick={() => setShowMicModal(false)}
									style={{
										background: 'none',
										border: 'none',
										fontSize: '20px',
										cursor: 'pointer',
										color: '#6b7280',
										padding: '4px'
									}}
								>
									✕
								</button>
							</div>
							
							<p style={{ 
								margin: '0 0 16px 0', 
								color: '#6b7280', 
								fontSize: '14px' 
							}}>
								Choose your preferred microphone for recording:
							</p>
							
							<div style={{ marginBottom: '20px' }}>
								<div style={{ 
									display: 'flex', 
									justifyContent: 'space-between', 
									alignItems: 'center',
									marginBottom: '12px'
								}}>
									<label style={{ 
										fontWeight: '500',
										color: '#374151'
									}}>
										Choose Microphone:
									</label>
									<button
										onClick={refreshMicrophones}
										style={{
											background: 'none',
											border: '1px solid #d1d5db',
											borderRadius: '4px',
											padding: '4px 8px',
											fontSize: '12px',
											cursor: 'pointer',
											color: '#6b7280'
										}}
										title="Refresh microphone list"
									>
										🔄 Refresh
									</button>
								</div>
								
								{/* Microphone list with usage indicators */}
								<div style={{ 
									display: 'flex',
									flexDirection: 'column',
									gap: '8px',
									marginBottom: '12px'
								}}>
									{availableMics.map(mic => (
										<div
											key={mic.deviceId}
											onClick={() => setSelectedMic(mic.deviceId)}
											style={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												padding: '12px',
												border: selectedMic === mic.deviceId ? '2px solid #3b82f6' : '1px solid #e5e7eb',
												borderRadius: '8px',
												cursor: 'pointer',
												backgroundColor: selectedMic === mic.deviceId ? '#eff6ff' : '#ffffff',
												transition: 'all 0.2s ease',
												gap: '12px'
											}}
										>
											<div style={{
												display: 'flex',
												alignItems: 'center',
												gap: '8px',
												flex: 1
											}}>
												<div style={{
													fontSize: '16px',
													color: selectedMic === mic.deviceId ? '#3b82f6' : '#6b7280'
												}}>
													{selectedMic === mic.deviceId ? '●' : '○'}
												</div>
												<div style={{
													fontSize: '14px',
													fontWeight: selectedMic === mic.deviceId ? '600' : '400',
													color: selectedMic === mic.deviceId ? '#1e293b' : '#374151',
													flex: 1
												}}>
													{mic.label}
												</div>
											</div>
											<div style={{ minWidth: '80px' }}>
												<MicrophoneUsageIndicator deviceId={mic.deviceId} size="small" />
											</div>
										</div>
									))}
								</div>
								
								{/* Status indicator */}
								{isMonitoringMics && (
									<div style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										gap: '6px',
										padding: '8px',
										backgroundColor: '#f0f9ff',
										border: '1px solid #bae6fd',
										borderRadius: '6px',
										fontSize: '12px',
										color: '#0369a1'
									}}>
										<div style={{
											width: '8px',
											height: '8px',
											borderRadius: '50%',
											backgroundColor: '#22c55e',
											animation: 'pulse 2s infinite'
										}} />
										Monitoring microphone activity levels
									</div>
								)}
							</div>
							
							{/* Language Selection */}
							<div style={{ marginBottom: '20px' }}>
								<label style={{
									display: 'block',
									marginBottom: '8px',
									fontWeight: '500',
									color: '#374151'
								}}>
									🌍 Meeting Language:
								</label>
								<div style={{
									display: 'flex',
									gap: '8px',
									justifyContent: 'center'
								}}>
									{[
										{ value: 'tr', label: 'Türkçe' },
										{ value: 'en', label: 'English' }
									].map((option) => (
										<button
											key={option.value}
											onClick={() => setLanguage(option.value as 'tr' | 'en')}
											style={{
												padding: '8px 16px',
												backgroundColor: language === option.value ? '#3b82f6' : '#f3f4f6',
												color: language === option.value ? 'white' : '#374151',
												border: '1px solid #d1d5db',
												borderRadius: '6px',
												fontSize: '14px',
												fontWeight: '500',
												cursor: 'pointer',
												transition: 'all 0.2s ease'
											}}
											onMouseEnter={(e) => {
												if (language !== option.value) {
													e.currentTarget.style.backgroundColor = '#e5e7eb'
												}
											}}
											onMouseLeave={(e) => {
												if (language !== option.value) {
													e.currentTarget.style.backgroundColor = '#f3f4f6'
												}
											}}
										>
											{option.label}
										</button>
									))}
								</div>
								<p style={{
									margin: '4px 0 0 0',
									fontSize: '12px',
									color: '#6b7280',
									fontStyle: 'italic',
									textAlign: 'center'
								}}>
									Select the primary language for this meeting
								</p>
							</div>
							
							{/* Preference: Show Floating Recorder */}
							<label htmlFor="pref-show-floating" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 16px 0', fontSize: '14px', color: '#374151' }}>
								<input id="pref-show-floating" type="checkbox" defaultChecked />
								<span>Show floating recorder while recording</span>
							</label>
							<div style={{
								margin: '8px 0 16px 0',
								padding: '10px 12px',
								border: '1px solid #e5e7eb',
								borderRadius: '8px',
								backgroundColor: '#f8fafc',
								fontSize: '12px',
								color: '#374151'
							}}>
								<strong>Tip:</strong> To record computer audio and other speakers, enable "Share system audio" when the screen/window selection prompt appears. If the option is missing on Windows, enable "Stereo Mix" in Sound settings or use a virtual audio device (e.g., VB-CABLE).
							</div>
							<button
								onClick={startRecordingWithSelectedMic}
								disabled={!selectedMic}
								style={{
									width: '100%',
									padding: '12px 24px',
									backgroundColor: selectedMic ? '#8b5cf6' : '#9ca3af',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									fontSize: '16px',
									fontWeight: '600',
									cursor: selectedMic ? 'pointer' : 'not-allowed',
									transition: 'background-color 0.2s ease'
								}}
								onMouseEnter={(e) => {
									if (selectedMic) {
										e.currentTarget.style.backgroundColor = '#7c3aed'
									}
								}}
								onMouseLeave={(e) => {
									if (selectedMic) {
										e.currentTarget.style.backgroundColor = '#8b5cf6'
									}
								}}
							>
								🎙️ Start Recording
							</button>
						</div>
					</div>
				)}

				{/* Sync Status Indicators */}
				{syncStatus !== 'idle' && (
					<div style={{ 
						marginBottom: 16, 
						padding: '12px 16px', 
						borderRadius: '8px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '12px',
						backgroundColor: syncStatus === 'syncing' ? '#fef3c7' : 
											syncStatus === 'success' ? '#dcfce7' : '#fee2e2',
						border: syncStatus === 'syncing' ? '1px solid #f59e0b' : 
								syncStatus === 'success' ? '1px solid #22c55e' : '1px solid #ef4444'
					}}>
						<div style={{ 
							width: '12px', 
							height: '12px', 
							borderRadius: '50%',
							backgroundColor: syncStatus === 'syncing' ? '#f59e0b' : 
												syncStatus === 'success' ? '#22c55e' : '#ef4444',
							animation: syncStatus === 'syncing' ? 'pulse 1.5s infinite' : 'none'
						}}></div>
						<span style={{ 
							fontWeight: 'bold',
							color: syncStatus === 'syncing' ? '#92400e' : 
								   syncStatus === 'success' ? '#166534' : '#991b1b'
						}}>
							{syncStatus === 'syncing' && `🔄 Processing meeting with AI...${retryCount > 0 ? ` (Retry ${retryCount}/3)` : ''}`}
							{syncStatus === 'success' && '✅ Meeting processed successfully with AI transcription and summary!'}
							{syncStatus === 'failed' && `❌ Auto-processing failed${retryCount > 0 ? ` (Retry ${retryCount}/3)` : ''}. You can manually retry.`}
						</span>
					</div>
				)}

				{/* Upload Progress Bar */}
				{recording && totalChunks > 0 && (
					<div style={{ 
						marginBottom: 16, 
						padding: '12px 16px', 
						backgroundColor: '#f8fafc', 
						border: '1px solid #e2e8f0',
						borderRadius: '8px',
						width: '100%',
						maxWidth: '400px'
					}}>
						<div style={{ 
							display: 'flex', 
							justifyContent: 'space-between', 
							marginBottom: '8px',
							fontSize: '14px',
							color: '#64748b'
						}}>
							<span>📁 Saving audio chunks...</span>
							<span>{uploadProgress} / {totalChunks}</span>
						</div>
						<div style={{ 
							width: '100%', 
							height: '8px', 
							backgroundColor: '#e2e8f0', 
							borderRadius: '4px',
							overflow: 'hidden'
						}}>
							<div style={{ 
								width: `${(uploadProgress / totalChunks) * 100}%`, 
								height: '100%', 
								backgroundColor: '#3b82f6',
								transition: 'width 0.3s ease'
							}}></div>
						</div>
					</div>
				)}
				
				{error && (
					<div style={{ 
						color: 'white', 
						marginTop: 16, 
						padding: '12px 16px',
						backgroundColor: '#ef4444',
						borderRadius: '8px',
						border: '1px solid #dc2626'
					}}>
						⚠️ {error}
					</div>
				)}
			</div>

			{/* Interruption Dialog */}
			{showInterruptionDialog && interruptedInfo && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1001
				}}>
					<div style={{
						backgroundColor: 'white',
						padding: '24px',
						borderRadius: '12px',
						maxWidth: '400px',
						width: '90%',
						textAlign: 'center'
					}}>
						<h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
							⚠️ Recording Interrupted
						</h3>
						<p style={{ margin: '16px 0 24px 0', color: '#374151', fontSize: '14px' }}>
							Your recording was interrupted by a page refresh.
							Would you like to resume from where you left off?
						</p>
						<div style={{ display: 'flex', gap: '12px' }}>
							<button
								onClick={handleResumeRecording}
								style={{
									padding: '8px 16px',
									backgroundColor: '#3b82f6',
									color: 'white',
									border: 'none',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: '600',
									cursor: 'pointer',
									transition: 'all 0.2s ease'
								}}
							>
								Resume Recording
							</button>
							<button
								onClick={handleClearInterruptedState}
								style={{
									padding: '8px 16px',
									backgroundColor: '#ef4444',
									color: 'white',
									border: 'none',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: '600',
									cursor: 'pointer',
									transition: 'all 0.2s ease'
								}}
							>
								Clear State
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}