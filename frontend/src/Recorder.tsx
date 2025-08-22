import { useEffect, useRef, useState } from 'react'
import { addChunk, createMeeting, syncMeeting } from './offline'
import { db } from './db'

export default function Recorder({ onCreated, onStopped }: { onCreated: (meetingId: string) => void; onStopped?: (meetingId: string) => void }) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const [recording, setRecording] = useState(false)
	const [meetingId, setMeetingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle')
	const [retryCount, setRetryCount] = useState(0)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [totalChunks, setTotalChunks] = useState(0)
	const chunkIndexRef = useRef(0)
	const [recordingTime, setRecordingTime] = useState(0)
	const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([])
	const [selectedMic, setSelectedMic] = useState<string>('')
	const recordingIntervalRef = useRef<number | null>(null)

	useEffect(() => {
		// Load available microphones when component mounts
		getAvailableMics()
		
		return () => {
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
				mediaRecorderRef.current.stop()
			}
			if (recordingIntervalRef.current) {
				clearInterval(recordingIntervalRef.current)
			}
		}
	}, [])

	// Get available microphones (filters Windows "Default"/"Communications" duplicates)
	async function getAvailableMics() {
		try {
			// Try to ensure labels are populated (permission prompt); stop tracks immediately
			try {
				const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
				tmp.getTracks().forEach(t => t.stop())
			} catch {
				// ignore if user blocks; we'll still list device ids
			}

			const devices = await navigator.mediaDevices.enumerateDevices()
			let mics = devices.filter(d => d.kind === 'audioinput')
			// Remove Windows virtual entries
			mics = mics.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications')
			// De-dupe by groupId or label
			const seen = new Set<string>()
			mics = mics.filter(d => {
				const key = d.groupId || d.label || d.deviceId
				if (seen.has(key)) return false
				seen.add(key)
				return true
			})
			setAvailableMics(mics)
			// Set default mic to first available
			if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId)
		} catch (err) {
			console.error('Failed to get microphones:', err)
		}
	}

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
			setRecordingTime(0)

			// Create a combined stream with both system audio and microphone
			let combinedStream: MediaStream

			try {
				// First, try to get system audio (desktop capture)
				let systemAudioStream: MediaStream | null = null
				if (typeof window !== 'undefined' && (window as any).desktopCapture) {
					try {
						const sources = await (window as any).desktopCapture.getSources(['audio'])
						if (sources.length > 0) {
							const source = sources[0]
							systemAudioStream = await navigator.mediaDevices.getUserMedia({
								audio: {
									mandatory: {
										chromeMediaSource: 'desktop',
										chromeMediaSourceId: source.id
									}
								} as any
							})
						}
					} catch (err) {
						console.log('System audio capture not available, continuing with microphone only')
					}
				}

				// Get microphone stream
				const micStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId: selectedMic ? { exact: selectedMic } : undefined
					}
				})

				// Combine streams if we have both
				if (systemAudioStream) {
					// Combine system audio and microphone
					const tracks = [...systemAudioStream.getAudioTracks(), ...micStream.getAudioTracks()]
					combinedStream = new MediaStream(tracks)
				} else {
					// Only microphone available
					combinedStream = micStream
				}

			} catch (err) {
				console.error('Failed to get audio streams:', err)
				throw new Error('Failed to access audio devices')
			}

			const rec = new MediaRecorder(combinedStream, { mimeType: 'audio/webm' })
			// Default meeting title with start date/time for uniqueness
			const now = new Date()
			const human = now.toLocaleString()
			const meeting = await createMeeting(`Meeting ${human}`)
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

	// Format recording time as MM:SS
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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

	return (
		<div style={{ 
			display: 'flex', 
			flexDirection: 'column', 
			alignItems: 'center',
			justifyContent: 'center',
			textAlign: 'center',
			minHeight: '200px'
		}}>
			{/* Microphone Visual - Always show */}
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
				{availableMics.length > 1 && (
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
							{availableMics.map(mic => (
								<option key={mic.deviceId} value={mic.deviceId}>
									{mic.label || `Microphone ${mic.deviceId.slice(0, 8)}...`}
								</option>
							))}
						</select>
					</div>
				)}
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

			{/* Recording Controls */}
			<div style={{ 
				display: 'flex', 
				gap: 16, 
				marginBottom: 24, 
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

			{/* Info Text */}
			<div style={{ 
				marginTop: '16px', 
				padding: '12px 16px', 
				backgroundColor: '#f0f9ff', 
				border: '1px solid #0ea5e9',
				borderRadius: '8px',
				fontSize: '14px',
				color: '#0c4a6e'
			}}>
				💡 <strong>Smart Recording:</strong> Automatically captures both system audio (Google Meet, Teams, Zoom) and microphone input for complete meeting coverage. <strong>Meetings are automatically processed with AI after recording ends!</strong>
			</div>
			
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

			{/* CSS for recording indicator animation */}
			<style>{`
				@keyframes pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.5; }
				}
			`}</style>
		</div>
	)
}