import { useEffect, useState } from 'react'
import { db } from './db'
import { syncMeeting, updateMeetingTags } from './offline'
import { updateMeeting } from './api'

export default function MeetingView({ meetingId }: { meetingId: string }) {
	const [meeting, setMeeting] = useState<any>(null)
	const [note, setNote] = useState<any>(null)
	const [sending, setSending] = useState(false)
    const [tagsInput, setTagsInput] = useState('')
    const [search, setSearch] = useState('')

	useEffect(() => {
		async function load() {
			setMeeting(await db.meetings.get(meetingId))
			setNote(await db.notes.get(meetingId))
            const m = await db.meetings.get(meetingId)
            setTagsInput((m?.tags || []).join(', '))
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

    async function saveTags() {
        const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
        await updateMeetingTags(meetingId, tags)
        setMeeting(await db.meetings.get(meetingId))
    }

	if (!meeting) return <div>Loading…</div>

	return (
		<div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
			<aside style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
				<div style={{ fontWeight: 700, marginBottom: 12 }}>Navigation</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<a href="#/" style={{ textDecoration: 'none' }}>🏠 Home</a>
					<a href="#/" style={{ textDecoration: 'none' }}>🗂️ Meetings</a>
					<a href="#/" style={{ textDecoration: 'none' }}>🔍 Search</a>
				</div>
			</aside>
			<div>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
					<InlineTitle id={meetingId} title={meeting.title} onSaved={async () => setMeeting(await db.meetings.get(meetingId))} />
					<button onClick={sendNow} disabled={sending || meeting.status === 'sent'}>📤 Send/Resend</button>
				</div>
				<div style={{ marginBottom: 12, color: '#64748b' }}>
					📅 {new Date(meeting.createdAt).toLocaleString()} {meeting.duration && `• ⏱️ ${Math.round(meeting.duration/60)} min`}
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
					<section>
						<h3 style={{ marginTop: 0 }}>Summary</h3>
						<input placeholder="Search in note" value={search} onChange={e => setSearch(e.target.value)} />
						<div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, minHeight: 240 }}>
							{note?.summary || 'No summary yet. Send the recording to VPS to generate.'}
						</div>
					</section>
					<section>
						<h3 style={{ marginTop: 0 }}>Transcript</h3>
						<textarea rows={16} style={{ width: '100%' }} value={note?.transcript || ''} readOnly />
					</section>
				</div>
				<div style={{ marginTop: 16 }}>
					<h3>Tags</h3>
					<input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="tag1, tag2" />
					<button onClick={saveTags}>Save Tags</button>
				</div>
			</div>
		</div>
	)
}

function InlineTitle({ id, title, onSaved }: { id: string; title: string; onSaved: () => void }) {
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
                style={{ fontSize: 22, fontWeight: 700, width: '100%', padding: 6 }}
            />
        )
    }
    return <h2 style={{ margin: 0 }} onClick={() => setEditing(true)}>{title}</h2>
}


