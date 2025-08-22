import { useEffect, useRef, useState } from 'react'
import { addChunk, createMeeting } from './offline'

export default function Recorder({ onCreated }: { onCreated: (meetingId: string) => void }) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const [recording, setRecording] = useState(false)
	const [meetingId, setMeetingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const chunkIndexRef = useRef(0)

	useEffect(() => {
		return () => {
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
				mediaRecorderRef.current.stop()
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
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
			const meeting = await createMeeting('New meeting')
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
		} catch (err) {
			console.error('Failed to start recording:', err)
			setError(err instanceof Error ? err.message : 'Failed to start recording')
		}
	}

	function stop() {
		if (mediaRecorderRef.current) {
			mediaRecorderRef.current.stop()
			// Stop all tracks to release microphone
			mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
		}
		setRecording(false)
	}

	return (
		<div>
			<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
				<button onClick={start} disabled={recording}>Start Recording</button>
				<button onClick={stop} disabled={!recording}>Stop</button>
			</div>
			{error && (
				<div style={{ color: 'red', marginTop: 8 }}>
					⚠️ {error}
				</div>
			)}
		</div>
	)
}


