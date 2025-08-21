import { useEffect, useRef, useState } from 'react'
import { addChunk, createMeeting } from './offline'

export default function Recorder({ onCreated }: { onCreated: (meetingId: string) => void }) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const [recording, setRecording] = useState(false)
	const [meetingId, setMeetingId] = useState<string | null>(null)
	const chunkIndexRef = useRef(0)

	useEffect(() => {
		return () => {
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
				mediaRecorderRef.current.stop()
			}
		}
	}, [])

	async function start() {
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
	}

	function stop() {
		mediaRecorderRef.current?.stop()
		setRecording(false)
	}

	return (
		<div style={{ display: 'flex', gap: 8 }}>
			<button onClick={start} disabled={recording}>Start Recording</button>
			<button onClick={stop} disabled={!recording}>Stop</button>
		</div>
	)
}


