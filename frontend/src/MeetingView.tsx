import { useEffect, useState } from 'react'
import { db } from './db'
import { syncMeeting } from './offline'

export default function MeetingView({ meetingId }: { meetingId: string }) {
	const [meeting, setMeeting] = useState<any>(null)
	const [note, setNote] = useState<any>(null)
	const [sending, setSending] = useState(false)

	useEffect(() => {
		async function load() {
			setMeeting(await db.meetings.get(meetingId))
			setNote(await db.notes.get(meetingId))
		}
		load()
	}, [meetingId])

	async function sendNow() {
		setSending(true)
		try {
			await syncMeeting(meetingId)
			setNote(await db.notes.get(meetingId))
		} finally {
			setSending(false)
		}
	}

	if (!meeting) return <div>Loading…</div>

	return (
		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
			<div>
				<h2>{meeting.title}</h2>
				<div style={{ display: 'flex', gap: 8 }}>
					<button onClick={sendNow} disabled={sending || meeting.status === 'sent'}>Send/Resend</button>
				</div>
				<p>Status: {meeting.status}</p>
			</div>
			<div>
				<h3>Summary</h3>
				<textarea rows={15} style={{ width: '100%' }} value={note?.summary || ''} readOnly />
				<h3>Transcript</h3>
				<textarea rows={20} style={{ width: '100%' }} value={note?.transcript || ''} readOnly />
			</div>
		</div>
	)
}


