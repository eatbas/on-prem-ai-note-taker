import { useEffect, useMemo, useState } from 'react'
import { listMeetings, syncMeeting, watchOnline } from './offline'
import { db } from './db'

export default function Dashboard({ onOpen }: { onOpen: (meetingId: string) => void }) {
	const [text, setText] = useState('')
	const [tag, setTag] = useState('')
	const [online, setOnline] = useState(true)
	const [meetings, setMeetings] = useState<any[]>([])

	useEffect(() => {
		const stop = watchOnline(setOnline)
		return stop
	}, [])

	async function refresh() {
		setMeetings(await listMeetings({ text, tag }))
	}

	useEffect(() => {
		refresh()
	}, [text, tag])

	const tags = useMemo(() => {
		const all: Record<string, number> = {}
		meetings.forEach(m => m.tags?.forEach((t: string) => (all[t] = (all[t] || 0) + 1)))
		return Object.entries(all).sort((a, b) => b[1] - a[1])
	}, [meetings])

	async function retry(meetingId: string) {
		await syncMeeting(meetingId)
		await refresh()
	}

	async function clearAll() {
		await db.delete()
		window.location.reload()
	}

	return (
		<div>
			<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
				<input placeholder="Search title, summary, transcript" value={text} onChange={e => setText(e.target.value)} />
				<select value={tag} onChange={e => setTag(e.target.value)}>
					<option value="">All tags</option>
					{tags.map(([t]) => (
						<option key={t} value={t}>{t}</option>
					))}
				</select>
				<span style={{ marginLeft: 'auto' }}>{online ? 'Online' : 'Offline'}</span>
				<button onClick={clearAll}>Reset Local Data</button>
			</div>
			<ul style={{ marginTop: 16 }}>
				{meetings.map(m => (
					<li key={m.id} style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #eee' }}>
						<div style={{ flex: 1 }}>
							<div style={{ fontWeight: 600 }}>{m.title}</div>
							<div style={{ fontSize: 12, opacity: 0.8 }}>status: {m.status}{m.__hit ? ` • match: ${m.__hit}` : ''}</div>
						</div>
						<div style={{ display: 'flex', gap: 8 }}>
							<button onClick={() => onOpen(m.id)}>Open</button>
							{m.status !== 'sent' && <button onClick={() => retry(m.id)} disabled={!online}>Send</button>}
						</div>
					</li>
				))}
			</ul>
		</div>
	)
}


