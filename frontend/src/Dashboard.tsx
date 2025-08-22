import { useEffect, useMemo, useState } from 'react'
import { listMeetings, syncMeeting, watchOnline } from './offline'
import { getMeetings, getVpsHealth, updateMeeting } from './api'
import { db } from './db'

export default function Dashboard({ onOpen, refreshSignal }: { onOpen: (meetingId: string) => void; refreshSignal?: number }) {
	const [text, setText] = useState('')
	const [tag, setTag] = useState('')
	const [online, setOnline] = useState(true)
	const [meetings, setMeetings] = useState<any[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
    const [vpsUp, setVpsUp] = useState<boolean | null>(null)

	useEffect(() => {
		const stop = watchOnline(setOnline)
		return stop
	}, [])

	useEffect(() => {
		let stopped = false
		async function poll() {
			try {
				const res = await getVpsHealth()
				if (!stopped) setVpsUp(res.status === 'ok')
			} catch {
				if (!stopped) setVpsUp(false)
			}
		}
		poll()
		const id = setInterval(poll, 15000)
		return () => { stopped = true; clearInterval(id) }
	}, [])

	async function refresh() {
		setLoading(true)
		setError(null)
		try {
			if (online) {
				// Always load local meetings first so user sees something immediately
				const localMeetings = await listMeetings({ text, tag })
				setMeetings(localMeetings)
				
				// Try to fetch from backend and merge
				try {
					const backendMeetings = await getMeetings()
					const byId = new Map<string, any>()
					// Start with local meetings to preserve any unsent ones
					for (const m of localMeetings) byId.set(m.id, m)
					// Overlay with backend data
					for (const m of backendMeetings as any[]) {
						const existing = byId.get(m.id)
						// Merge backend data with local data, preferring backend for processed content
						byId.set(m.id, { 
							...existing, 
							...m, 
							// Keep local status if it's more recent or unsent
							status: existing?.status === 'local' ? existing.status : m.status || 'sent',
							// Keep local tags and title if they exist
							tags: existing?.tags || [],
							title: existing?.title || m.title
						})
					}
					setMeetings(Array.from(byId.values()).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)))
				} catch (backendErr) {
					// Backend failed, but we still have local data
					console.warn('Backend fetch failed, using local data:', backendErr)
					setError(`Backend connection failed: ${backendErr instanceof Error ? backendErr.message : 'Unknown error'}. Showing local meetings only.`)
				}
			} else {
				// Use local data when offline
				setMeetings(await listMeetings({ text, tag }))
			}
		} catch (err) {
			console.error('Failed to load meetings:', err)
			setError(`Failed to load meetings: ${err instanceof Error ? err.message : 'Unknown error'}`)
			// Try to load any local data as last resort
			try {
				setMeetings(await listMeetings({ text, tag }))
			} catch (localErr) {
				console.error('Even local data failed:', localErr)
				setMeetings([])
			}
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		refresh()
	}, [text, tag, online])

	// Re-run refresh when parent bumps refreshSignal (e.g., on recording stop)
	useEffect(() => {
		if (typeof refreshSignal !== 'undefined') {
			refresh()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refreshSignal])

	const tags = useMemo(() => {
		const all: Record<string, number> = {}
		meetings.forEach(m => m.tags?.forEach((t: string) => (all[t] = (all[t] || 0) + 1)))
		return Object.entries(all).sort((a, b) => b[1] - a[1])
	}, [meetings])

	async function retry(meetingId: string) {
		try {
			setError(null)
			await syncMeeting(meetingId)
			await refresh()
		} catch (err) {
			console.error('Retry failed:', err)
			setError(`Failed to send meeting: ${err instanceof Error ? err.message : 'Unknown error'}`)
		}
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
				<span title="VPS connectivity" style={{ marginLeft: 8 }}>
					{vpsUp === null ? '⏳ Checking VPS' : vpsUp ? '🟢 VPS' : '🔴 VPS'}
				</span>
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
								<InlineEditableTitle id={m.id} title={m.title || 'Untitled Meeting'} onSaved={refresh} />
							</div>
							<div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
								📅 {new Date(m.created_at || m.createdAt).toLocaleString()}
								{m.duration && ` • ⏱️ ${Math.round(m.duration / 60)} min`}
							</div>
							{m.summary ? (
								<div style={{ 
									fontSize: 14, 
									opacity: 0.9, 
									backgroundColor: '#f0f9ff',
									padding: 8,
									borderRadius: 4,
									marginTop: 8,
									border: '1px solid #0ea5e9'
								}}>
									<strong>Summary:</strong> {m.summary.slice(0, 200)}...
								</div>
							) : (
								<div style={{ 
									fontSize: 14, 
									opacity: 0.7, 
									backgroundColor: '#fef3c7',
									padding: 8,
									borderRadius: 4,
									marginTop: 8,
									border: '1px solid #f59e0b'
								}}>
									{m.status === 'local' ? '📝 Ready to send to AI for processing' : 
									 m.status === 'queued' ? '⏳ Queued for AI processing' : 
									 '🤖 Send to generate AI summary and transcript'}
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

function InlineEditableTitle({ id, title, onSaved }: { id: string; title: string; onSaved: () => void }) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(title)
    useEffect(() => setValue(title), [title])
    async function save() {
        const trimmed = value.trim()
        if (trimmed && trimmed !== title) {
            try { await updateMeeting(id, trimmed) } catch {}
        }
        setEditing(false)
        onSaved()
    }
    if (editing) {
        return (
            <input 
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={e => { if (e.key === 'Enter') save() }}
                autoFocus
                style={{ fontSize: 18, fontWeight: 600, width: '100%', padding: 4 }}
            />
        )
    }
    return <span onClick={() => setEditing(true)} style={{ cursor: 'text' }}>{title}</span>
}


