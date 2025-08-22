import { useEffect, useRef, useState } from 'react'
import { addChunk, createMeeting } from './offline'
import { db } from './db'

export default function Recorder({ onCreated }: { onCreated: (meetingId: string) => void }) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const [recording, setRecording] = useState(false)
	const [meetingId, setMeetingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
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
			setMeetingId(meeting.id)
			onCreated(meeting.id)
			chunkIndexRef.current = 0

			rec.ondataavailable = async (e: BlobEvent) => {
				if (e.data && e.data.size > 0 && meetingId) {
					await addChunk(meetingId, e.data, chunkIndexRef.current++)
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
		}
		setRecordingTime(0)
	}

	// Format recording time as MM:SS
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	return (
		<div>
			{/* Microphone Selection (only show if multiple mics available) */}
			{availableMics.length > 1 && (
				<div style={{ marginBottom: 16 }}>
					<label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
						🎤 Microphone:
					</label>
					<select 
						value={selectedMic} 
						onChange={(e) => setSelectedMic(e.target.value)}
						disabled={recording}
						style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
					>
						{availableMics.map(mic => (
							<option key={mic.deviceId} value={mic.deviceId}>
								{mic.label || `Microphone ${mic.deviceId.slice(0, 8)}...`}
							</option>
						))}
					</select>
				</div>
			)}

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
			<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
				<button 
					onClick={start} 
					disabled={recording}
					style={{
						padding: '12px 24px',
						backgroundColor: recording ? '#6b7280' : '#3b82f6',
						color: 'white',
						border: 'none',
						borderRadius: '8px',
						fontSize: '16px',
						fontWeight: 'bold',
						cursor: recording ? 'not-allowed' : 'pointer'
					}}
				>
					🎙️ Start Recording
				</button>
				<button 
					onClick={stop} 
					disabled={!recording}
					style={{
						padding: '12px 24px',
						backgroundColor: !recording ? '#6b7280' : '#ef4444',
						color: 'white',
						border: 'none',
						borderRadius: '8px',
						fontSize: '16px',
						fontWeight: 'bold',
						cursor: !recording ? 'not-allowed' : 'pointer'
					}}
				>
					⏹️ Stop Recording
				</button>
			</div>

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
				💡 <strong>Smart Recording:</strong> Automatically captures both system audio (Google Meet, Teams, Zoom) and microphone input for complete meeting coverage.
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


