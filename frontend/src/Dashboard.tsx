import { useEffect, useMemo, useState } from 'react'
import { listMeetings, syncMeeting, watchOnline } from './offline'
import { getMeetings } from './api'
import { db } from './db'

export default function Dashboard({ onOpen }: { onOpen: (meetingId: string) => void }) {
	const [text, setText] = useState('')
	const [tag, setTag] = useState('')
	const [online, setOnline] = useState(true)
	const [meetings, setMeetings] = useState<any[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const stop = watchOnline(setOnline)
		return stop
	}, [])

	async function refresh() {
		setLoading(true)
		setError(null)
		try {
			if (online) {
				// Fetch from backend when online
				const backendMeetings = await getMeetings()
				setMeetings(backendMeetings)
			} else {
				// Use local data when offline
				setMeetings(await listMeetings({ text, tag }))
			}
		} catch (err) {
			console.error('Failed to fetch meetings:', err)
			setError(err instanceof Error ? err.message : 'Failed to fetch meetings')
			// Fallback to local data
			setMeetings(await listMeetings({ text, tag }))
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		refresh()
	}, [text, tag, online])

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
			<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
				<input 
					placeholder="Search title, summary, transcript" 
					value={text} 
					onChange={e => setText(e.target.value)}
					style={{ flex: 1, padding: 8 }}
				/>
				<select value={tag} onChange={e => setTag(e.target.value)} style={{ padding: 8 }}>
					<option value="">All tags</option>
					{tags.map(([t]) => (
						<option key={t} value={t}>{t}</option>
					))}
				</select>
				<span style={{ marginLeft: 'auto' }}>{online ? '🟢 Online' : '🔴 Offline'}</span>
				<button onClick={() => refresh()}>🔄 Refresh</button>
				<button onClick={clearAll}>Reset Local Data</button>
			</div>
			
			{error && (
				<div style={{ 
					padding: 12, 
					backgroundColor: '#fee', 
					border: '1px solid #fcc',
					borderRadius: 4,
					marginBottom: 16 
				}}>
					⚠️ {error}
				</div>
			)}
			
			{loading && (
				<div style={{ textAlign: 'center', padding: 20 }}>
					Loading meetings...
				</div>
			)}
			
			{!loading && meetings.length === 0 && (
				<div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>
					No meetings found. Start recording to create your first meeting!
				</div>
			)}
			
			<ul style={{ listStyle: 'none', padding: 0 }}>
				{meetings.map(m => (
					<li key={m.id} style={{ 
						display: 'flex', 
						gap: 12, 
						padding: 16, 
						borderBottom: '1px solid #eee',
						backgroundColor: '#fafafa',
						marginBottom: 8,
						borderRadius: 4
					}}>
						<div style={{ flex: 1 }}>
							<div style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
								{m.title || 'Untitled Meeting'}
							</div>
							<div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
								📅 {new Date(m.created_at || m.createdAt).toLocaleString()}
								{m.duration && ` • ⏱️ ${Math.round(m.duration / 60)} min`}
							</div>
							{m.summary && (
								<div style={{ 
									fontSize: 14, 
									opacity: 0.9, 
									backgroundColor: '#f0f0f0',
									padding: 8,
									borderRadius: 4,
									marginTop: 8
								}}>
									<strong>Summary:</strong> {m.summary.slice(0, 200)}...
								</div>
							)}
						</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
							<button onClick={() => onOpen(m.id)} style={{ padding: '8px 16px' }}>
								📄 Open
							</button>
							{m.status !== 'sent' && (
								<button onClick={() => retry(m.id)} disabled={!online} style={{ padding: '8px 16px' }}>
									📤 Send
								</button>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	)
}


