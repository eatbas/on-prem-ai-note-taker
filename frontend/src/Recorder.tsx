import { useEffect, useRef, useState } from 'react'
import { addChunk, createMeeting, syncMeeting } from './offline'
import { db } from './db'

export default function Recorder({ 
	onCreated, 
	onStopped,
	text,
	setText,
	tag,
	setTag,
	online,
	vpsUp
}: { 
	onCreated: (meetingId: string) => void; 
	onStopped?: (meetingId: string) => void;
	text: string;
	setText: (text: string) => void;
	tag: string;
	setTag: (tag: string) => void;
	online: boolean;
	vpsUp: boolean | null;
}) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const [recording, setRecording] = useState(false)
	const [meetingId, setMeetingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle')
	const [retryCount, setRetryCount] = useState(0)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [totalChunks, setTotalChunks] = useState(0)
	const [showMicModal, setShowMicModal] = useState(false)
	const [systemAudioLevel, setSystemAudioLevel] = useState(0)
	const [microphoneLevel, setMicrophoneLevel] = useState(0)
	const chunkIndexRef = useRef(0)
	const [recordingTime, setRecordingTime] = useState(0)
	const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([])
	const [selectedMic, setSelectedMic] = useState<string>('')
	const [language, setLanguage] = useState<'auto' | 'tr' | 'en'>('tr')
	const [openMiniRecorder, setOpenMiniRecorder] = useState(true)
	const recordingIntervalRef = useRef<number | null>(null)
	const audioContextRef = useRef<AudioContext | null>(null)
	const analyserRef = useRef<AnalyserNode | null>(null)
	const microphoneAnalyserRef = useRef<AnalyserNode | null>(null)
	const animationFrameRef = useRef<number | null>(null)

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
			window.electronAPI.sendRecordingState(recording)
		}
	}, [recording])

	// Send recording data updates to standalone window
	useEffect(() => {
		if (window.electronAPI && recording) {
			// Send recording state to main process for standalone window
			window.electronAPI.sendRecordingState(recording)
			
			// Send detailed recording data updates
			const updateInterval = setInterval(() => {
				if (window.electronAPI && recording) {
					window.electronAPI.sendRecordingDataUpdate({
						recording: true,
						recordingTime,
						systemAudioLevel,
						microphoneLevel
					})
				}
			}, 100) // Update 10 times per second
			
			return () => clearInterval(updateInterval)
		}
	}, [recording, recordingTime, systemAudioLevel, microphoneLevel])

	// Listen for stop recording command from standalone window
	useEffect(() => {
		if (window.electronAPI) {
			const handleStopRecording = () => {
				if (recording) {
					stop()
				}
			}
			
			window.electronAPI.onTrayAction((action) => {
				if (action === 'stop-recording') {
					handleStopRecording()
				}
			})
			
			return () => {
				window.electronAPI.removeTrayActionListener()
			}
		}
	}, [recording])

	// Listen for recording data requests from main process
	useEffect(() => {
		if (window.electronAPI) {
			window.electronAPI.onRequestRecordingData(() => {
				if (recording) {
					window.electronAPI.sendRecordingDataResponse({
						recording: true,
						recordingTime,
						systemAudioLevel,
						microphoneLevel
					})
				}
			})
		}
	}, [recording, recordingTime, systemAudioLevel, microphoneLevel])

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
			
			// More aggressive filtering to remove duplicates and show only real devices
			const cleanDevices = audioInputs.filter(device => {
				const label = device.label.toLowerCase()
				
				// Remove devices with problematic prefixes
				if (label.includes('default -') || label.includes('communications -')) {
					return false
				}
				
				// Keep only Intel microphone and clean AirPods
				const isIntelMic = label.includes('intel') || label.includes('array')
				const isCleanAirPods = label.includes('airpods') && !label.includes('default') && !label.includes('communications')
				
				return isIntelMic || isCleanAirPods
			})
			
			setAvailableMics(cleanDevices)
			
			// Set default microphone if available
			if (cleanDevices.length > 0 && !selectedMic) {
				setSelectedMic(cleanDevices[0].deviceId)
			}
			
			console.log('Clean microphones:', cleanDevices.map(mic => ({
				label: mic.label,
				deviceId: mic.deviceId.slice(0, 20) + '...',
				kind: mic.kind
			})))
			
		} catch (err) {
			console.error('Failed to refresh microphones:', err)
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

	useEffect(() => {
		return () => {
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
				mediaRecorderRef.current.stop()
			}
			if (recordingIntervalRef.current) {
				clearInterval(recordingIntervalRef.current)
			}
		}
	}, [])

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
			setRecordingTime(0)

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
						const sources = await (window as any).desktopCapture.getSources(['audio'])
						console.log('Available audio sources:', sources)
						
						// Capture from ALL audio sources, not just the first one
						for (const source of sources) {
							try {
								const audioStream = await navigator.mediaDevices.getUserMedia({
									audio: {
										mandatory: {
											chromeMediaSource: 'desktop',
											chromeMediaSourceId: source.id
										}
									} as any
								})
								systemAudioStreams.push(audioStream)
								console.log(`Successfully captured audio from: ${source.name || source.id}`)
							} catch (err) {
								console.log(`Failed to capture audio from source ${source.name || source.id}:`, err)
							}
						}
						
						if (systemAudioStreams.length > 0) {
							console.log(`Successfully captured audio from ${systemAudioStreams.length} system audio sources`)
						} else {
							console.log('No system audio sources could be captured')
						}
					} catch (err) {
						console.log('System audio capture not available, continuing with microphone only:', err)
					}
				}

				// Get microphone stream - use selected mic or first available
				const micToUse = selectedMic || (availableMics.length > 0 ? availableMics[0].deviceId : undefined)
				micStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId: micToUse ? { exact: micToUse } : undefined
					}
				})

				// Combine ALL streams: microphone + all system audio sources
				const allTracks: MediaStreamTrack[] = []
				
				// Add microphone tracks
				allTracks.push(...micStream.getAudioTracks())
				
				// Add ALL system audio tracks
				systemAudioStreams.forEach(stream => {
					allTracks.push(...stream.getAudioTracks())
				})
				
				// Create combined stream with all audio sources
				combinedStream = new MediaStream(allTracks)
				
				console.log(`Combined stream created with ${allTracks.length} audio tracks:`)
				console.log(`- Microphone tracks: ${micStream.getAudioTracks().length}`)
				console.log(`- System audio tracks: ${systemAudioStreams.reduce((total, stream) => total + stream.getAudioTracks().length, 0)}`)

			} catch (err) {
				console.error('Failed to get audio streams:', err)
				throw new Error('Failed to access audio devices')
			}

			const rec = new MediaRecorder(combinedStream, { mimeType: 'audio/webm' })
			// Default meeting title with start date/time for uniqueness
			const now = new Date()
			const human = now.toLocaleString()
			const meeting = await createMeeting(`Meeting ${human}`, [], language)
			const createdId = meeting.id
			setMeetingId(createdId)
			onCreated(createdId)
			chunkIndexRef.current = 0

			rec.ondataavailable = async (e: BlobEvent) => {
				if (e.data && e.data.size > 0) {
					await addChunk(createdId, e.data, chunkIndexRef.current++)
					// Update upload progress
					setTotalChunks(chunkIndexRef.current)
					setUploadProgress(chunkIndexRef.current)
				}
			}

			rec.start(5000) // 5s chunks
			mediaRecorderRef.current = rec
			setRecording(true)
			setShowMicModal(false)

			// Notify Electron process that recording has started
			if (window.electronAPI) {
				window.electronAPI.sendRecordingState(true)
				// Conditionally show mini recorder window based on checkbox
				window.electronAPI.setMiniRecorderVisible(openMiniRecorder)
				window.electronAPI.sendRecordingDataUpdate({
					recording: true,
					recordingTime: 0,
					systemAudioLevel: 0,
					microphoneLevel: 0
				})
			}

			// Start audio level monitoring with ALL system audio streams
			startAudioLevelMonitoring(systemAudioStreams, micStream)

			// Start recording timer
			recordingIntervalRef.current = window.setInterval(() => {
				setRecordingTime(prev => prev + 1)
			}, 1000)

		} catch (err) {
			console.error('Failed to start recording:', err)
			setError(err instanceof Error ? err.message : 'Failed to start recording')
		}
	}

	function stop() {
		if (mediaRecorderRef.current) {
			mediaRecorderRef.current.stop()
			// Stop all tracks to release audio devices
			mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
		}
		
		// Stop recording timer
		if (recordingIntervalRef.current) {
			clearInterval(recordingIntervalRef.current)
			recordingIntervalRef.current = null
		}
		
		// Stop audio level monitoring
		stopAudioLevelMonitoring()
		
		// Notify Electron process that recording has stopped
		if (window.electronAPI) {
			window.electronAPI.sendRecordingState(false)
			window.electronAPI.sendRecordingDataUpdate({
				recording: false,
				recordingTime: 0,
				systemAudioLevel: 0,
				microphoneLevel: 0
			})
		}
		
		setRecording(false)
		// Ask for meeting name and persist duration locally
		if (meetingId) {
			const title = (window.prompt('Name this meeting', 'New meeting') || '').trim()
			if (title) {
				// Update meeting title and duration locally
				// @ts-ignore - duration is optional
				db.meetings.update(meetingId, { title, updatedAt: Date.now(), duration: recordingTime })
			}
			
			// Automatically sync the meeting after recording ends
			setTimeout(async () => {
				try {
					console.log('Auto-syncing meeting after recording ended...')
					setSyncStatus('syncing')
					await syncMeeting(meetingId)
					console.log('Meeting auto-synced successfully!')
					setSyncStatus('success')
					setRetryCount(0) // Reset retry count on success
					// Reset success status after 3 seconds
					setTimeout(() => setSyncStatus('idle'), 3000)
				} catch (error) {
					console.error('Auto-sync failed:', error)
					setSyncStatus('failed')
					
					// Auto-retry with exponential backoff (max 3 retries)
					if (retryCount < 3) {
						const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // 1s, 2s, 4s, 8s, 10s max
						console.log(`Auto-retry in ${delay/1000} seconds... (attempt ${retryCount + 1}/3)`)
						setTimeout(() => {
							setRetryCount(prev => prev + 1)
							setSyncStatus('syncing')
							// Recursive retry
							retrySync(meetingId, retryCount + 1)
						}, delay)
					} else {
						console.log('Max retries reached, giving up auto-sync')
						// Reset retry count and failed status after 5 seconds
						setTimeout(() => {
							setSyncStatus('idle')
							setRetryCount(0)
						}, 5000)
					}
				}
			}, 1000) // Small delay to ensure all data is saved
			
			if (onStopped) onStopped(meetingId)
		}
		setRecordingTime(0)
	}

	// Helper function for retrying sync with exponential backoff
	async function retrySync(meetingId: string, attempt: number) {
		try {
			await syncMeeting(meetingId)
			console.log(`Meeting auto-synced successfully on retry attempt ${attempt}!`)
			setSyncStatus('success')
			setRetryCount(0) // Reset retry count on success
			// Reset success status after 3 seconds
			setTimeout(() => setSyncStatus('idle'), 3000)
		} catch (error) {
			console.error(`Auto-sync retry attempt ${attempt} failed:`, error)
			setSyncStatus('failed')
			
			// Continue retry chain if we haven't reached max attempts
			if (attempt < 3) {
				const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
				console.log(`Auto-retry in ${delay/1000} seconds... (attempt ${attempt + 1}/3)`)
				setTimeout(() => {
					setRetryCount(prev => prev + 1)
					setSyncStatus('syncing')
					retrySync(meetingId, attempt + 1)
				}, delay)
			} else {
				console.log('Max retries reached, giving up auto-sync')
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

	return (
		<div style={{ 
			display: 'flex', 
			flexDirection: 'column', 
			alignItems: 'center',
			justifyContent: 'center',
			textAlign: 'center',
			minHeight: '200px'
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
				{/* Left Side - Microphone Selection */}
				<div style={{ 
					display: 'flex', 
					flexDirection: 'column', 
					alignItems: 'center',
					flex: 1
				}}>
					{/* Microphone Visual */}
					<div style={{ 
						marginBottom: 24, 
						display: 'flex', 
						flexDirection: 'column', 
						alignItems: 'center' 
					}}>
						<div style={{ 
							fontSize: '48px', 
							marginBottom: 12,
							opacity: recording ? 1 : 0.7,
							transform: recording ? 'scale(1.1)' : 'scale(1)',
							transition: 'all 0.3s ease',
							filter: recording ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 'none'
						}}>
							🎤
						</div>
						
						{/* Microphone Selection */}
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
							<label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', fontSize: '14px' }}>
								Select Microphone:
							</label>
							<select 
								value={selectedMic} 
								onChange={(e) => setSelectedMic(e.target.value)}
								disabled={recording}
								style={{ 
									padding: '8px 12px', 
									borderRadius: '6px', 
									border: '1px solid #d1d5db',
									backgroundColor: 'white',
									fontSize: '14px',
									minWidth: '200px'
								}}
							>
								{availableMics.map(mic => {
									// Show the real device name exactly as it comes from the system
									return (
										<option key={mic.deviceId} value={mic.deviceId}>
											{mic.label}
										</option>
									)
								})}
							</select>
							{/* Show current microphone info */}
							{selectedMic && (
								<div style={{ 
									marginTop: '8px', 
									fontSize: '12px', 
									color: '#6b7280',
									textAlign: 'center'
								}}>
									🎤 Using: {availableMics.find(mic => mic.deviceId === selectedMic)?.label || 'Selected microphone'}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Recording Controls */}
			<div style={{ 
				display: 'flex', 
				gap: 16, 
				marginBottom: 32, 
				justifyContent: 'center',
				alignItems: 'center' 
			}}>
				<button 
					onClick={start} 
					disabled={recording}
					style={{
						padding: '16px 32px',
						backgroundColor: recording ? '#9ca3af' : '#3b82f6',
						color: 'white',
						border: 'none',
						borderRadius: '12px',
						fontSize: '18px',
						fontWeight: 'bold',
						cursor: recording ? 'not-allowed' : 'pointer',
						transition: 'all 0.2s ease',
						boxShadow: recording ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
						transform: recording ? 'scale(0.95)' : 'scale(1)',
						opacity: recording ? 0.6 : 1
					}}
				>
					🎙️ Start Recording
				</button>
				<button 
					onClick={stop} 
					disabled={!recording}
					style={{
						padding: '16px 32px',
						backgroundColor: !recording ? '#9ca3af' : '#ef4444',
						color: 'white',
						border: 'none',
						borderRadius: '12px',
						fontSize: '18px',
						fontWeight: 'bold',
						cursor: !recording ? 'not-allowed' : 'pointer',
						transition: 'all 0.2s ease',
						boxShadow: !recording ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
						transform: !recording ? 'scale(0.95)' : 'scale(1)',
						opacity: !recording ? 0.6 : 1
					}}
				>
					⏹️ Stop Recording
				</button>
			</div>

			{/* Recording Status */}
			{recording && (
				<div style={{ 
					marginBottom: 16, 
					padding: '12px 16px', 
					backgroundColor: '#dcfce7', 
					border: '1px solid #22c55e',
					borderRadius: '8px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '12px'
				}}>
					<div style={{ 
						width: '12px', 
						height: '12px', 
						backgroundColor: '#ef4444', 
						borderRadius: '50%',
						animation: 'pulse 1.5s infinite'
					}}></div>
					<span style={{ fontWeight: 'bold', color: '#166534' }}>
						Recording... {formatTime(recordingTime)}
					</span>
				</div>
			)}

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
								marginBottom: '8px'
							}}>
								<label style={{ 
									fontWeight: '500',
									color: '#374151'
								}}>
									Microphone:
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
							<select 
								value={selectedMic} 
								onChange={(e) => setSelectedMic(e.target.value)}
								style={{ 
									width: '100%',
									padding: '12px',
									border: '1px solid #d1d5db',
									borderRadius: '6px',
									fontSize: '14px'
								}}
							>
								{availableMics.map(mic => {
									// Show the real device name exactly as it comes from the system
									return (
										<option key={mic.deviceId} value={mic.deviceId}>
											{mic.label}
										</option>
									)
								})}
							</select>
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
									{ value: 'en', label: 'English' },
									{ value: 'auto', label: 'Auto' }
								].map((option) => (
									<button
										key={option.value}
										onClick={() => setLanguage(option.value as 'auto' | 'tr' | 'en')}
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
						
						{/* Mini Recorder Checkbox */}
						<div style={{ marginBottom: '20px' }}>
							<label style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								cursor: 'pointer',
								fontSize: '14px',
								color: '#374151'
							}}>
								<input
									type="checkbox"
									checked={openMiniRecorder}
									onChange={(e) => setOpenMiniRecorder(e.target.checked)}
									style={{
										width: '16px',
										height: '16px',
										cursor: 'pointer'
									}}
								/>
								<span>📱 Open mini recorder (floating window)</span>
							</label>
							<p style={{
								margin: '4px 0 0 24px',
								fontSize: '12px',
								color: '#6b7280',
								fontStyle: 'italic'
							}}>
								Shows a compact recording window with timer and controls
							</p>
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
						{syncStatus === 'success' && '✅ Meeting processed successfully!'}
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
	)
}