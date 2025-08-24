import { useEffect, useState } from 'react'
import { db } from './db'
import { syncMeeting, updateMeetingTags } from './offline'
import { updateMeeting } from './api'
import TagsManager from './TagsManager'

export default function MeetingView({ meetingId }: { meetingId: string }) {
	const [meeting, setMeeting] = useState<any>(null)
	const [note, setNote] = useState<any>(null)
	const [sending, setSending] = useState(false)
    const [tagsInput, setTagsInput] = useState('')
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [totalChunks, setTotalChunks] = useState(0)

	useEffect(() => {
		async function load() {
			setMeeting(await db.meetings.get(meetingId))
			setNote(await db.notes.get(meetingId))
            const m = await db.meetings.get(meetingId)
            setTagsInput((m?.tags || []).join(', '))
            
            // Load chunk information for progress tracking
            if (m?.status === 'local' || m?.status === 'queued') {
                const chunks = await db.chunks.where({ meetingId }).toArray()
                setTotalChunks(chunks.length)
                setUploadProgress(chunks.length)
            }
		}
		load()
		
		// Set up periodic refresh for real-time updates
		const interval = setInterval(load, 2000) // Refresh every 2 seconds
		return () => clearInterval(interval)
	}, [meetingId])

	async function sendNow() {
		setSending(true)
		try {
			await syncMeeting(meetingId)
			setNote(await db.notes.get(meetingId))
			// Refresh meeting to get updated status
			setMeeting(await db.meetings.get(meetingId))
		} catch (err) {
			console.error('Send failed:', err)
			alert(`Failed to send meeting: ${err instanceof Error ? err.message : 'Unknown error'}`)
		} finally {
			setSending(false)
		}
	}

    async function saveTags() {
        const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
        await updateMeetingTags(meetingId, tags)
        setMeeting(await db.meetings.get(meetingId))
    }

    // Filter content based on search
    function filterContent(content: string): string {
        if (!search.trim()) return content
        const searchLower = search.toLowerCase()
        const lines = content.split('\n')
        const filteredLines = lines.filter(line => line.toLowerCase().includes(searchLower))
        return filteredLines.join('\n')
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

				{/* Tags Manager */}
				<div style={{ marginBottom: 16 }}>
					<TagsManager
						meetingId={meetingId}
						currentTags={meeting.tags || []}
						onTagsUpdate={async (tags) => {
							try {
								await updateMeetingTags(meetingId, tags)
								setMeeting(await db.meetings.get(meetingId))
							} catch (err) {
								console.error('Failed to update tags:', err)
							}
						}}
						online={true} // TODO: Pass actual online status
						vpsUp={true} // TODO: Pass actual VPS status
					/>
				</div>
				
				{/* Upload Progress for Local/Queued Meetings */}
				{(meeting.status === 'local' || meeting.status === 'queued') && totalChunks > 0 && (
					<div style={{ 
						marginBottom: 16, 
						padding: '12px 16px', 
						backgroundColor: '#fef3c7', 
						border: '1px solid #f59e0b',
						borderRadius: '8px'
					}}>
						<div style={{ 
							display: 'flex', 
							justifyContent: 'space-between', 
							marginBottom: '8px',
							fontSize: '14px',
							color: '#92400e'
						}}>
							<span>🔄 {meeting.status === 'local' ? 'Processing audio chunks...' : 'AI processing in progress...'}</span>
							<span>{uploadProgress} / {totalChunks} chunks</span>
						</div>
						<div style={{ 
							width: '100%', 
							height: '8px', 
							backgroundColor: '#fed7aa', 
							borderRadius: '4px',
							overflow: 'hidden'
						}}>
							<div style={{ 
								width: `${(uploadProgress / totalChunks) * 100}%`, 
								height: '100%', 
								backgroundColor: '#f59e0b',
								transition: 'width 0.3s ease'
							}}></div>
						</div>
					</div>
				)}

				{/* Tab Navigation */}
				<div style={{ 
					display: 'flex', 
					borderBottom: '1px solid #e2e8f0',
					marginBottom: 16
				}}>
					<button
						onClick={() => setActiveTab('summary')}
						style={{
							padding: '12px 24px',
							border: 'none',
							backgroundColor: 'transparent',
							borderBottom: activeTab === 'summary' ? '2px solid #3b82f6' : '2px solid transparent',
							color: activeTab === 'summary' ? '#3b82f6' : '#64748b',
							fontWeight: activeTab === 'summary' ? '600' : '400',
							cursor: 'pointer',
							fontSize: '16px'
						}}
					>
						📝 Summary
					</button>
					<button
						onClick={() => setActiveTab('transcript')}
						style={{
							padding: '12px 24px',
							border: 'none',
							backgroundColor: 'transparent',
							borderBottom: activeTab === 'transcript' ? '2px solid #3b82f6' : '2px solid transparent',
							color: activeTab === 'transcript' ? '#3b82f6' : '#64748b',
							fontWeight: activeTab === 'transcript' ? '600' : '400',
							cursor: 'pointer',
							fontSize: '16px'
						}}
					>
						🎧 Transcript
					</button>
				</div>

				{/* Tab Content */}
				{activeTab === 'summary' && (
					<div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
							<input 
								placeholder="Search in summary" 
								value={search} 
								onChange={e => setSearch(e.target.value)} 
								style={{
									flex: 1,
									padding: '8px 12px',
									border: '1px solid #e2e8f0',
									borderRadius: '6px'
								}}
							/>
							{search.trim() && note?.summary && (
								<div style={{ 
									fontSize: '14px', 
									color: '#64748b',
									backgroundColor: '#f1f5f9',
									padding: '4px 8px',
									borderRadius: '4px'
								}}>
									{filterContent(note.summary).split('\n').length} matching lines
								</div>
							)}
						</div>
						<div style={{ 
							background: 'white', 
							border: '1px solid #e2e8f0', 
							borderRadius: 8, 
							padding: 16, 
							minHeight: 300 
						}}>
							{note?.summary ? (
								<div style={{ 
									whiteSpace: 'pre-wrap',
									lineHeight: '1.6',
									fontSize: '15px'
								}}>
									{filterContent(note.summary)}
								</div>
							) : (
								<div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '40px 20px' }}>
									{meeting.status === 'sent' ? 
										'✅ Meeting processed but summary not found. Try refreshing or re-sending.' :
										meeting.status === 'queued' ? 
										'⏳ Meeting queued for AI processing. Please wait...' :
										'🤖 No summary yet. Click "Send/Resend" to process this meeting with AI and generate summary and transcript.'
									}
								</div>
							)}
						</div>
					</div>
				)}

				{activeTab === 'transcript' && (
					<div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
							<input 
								placeholder="Search in transcript" 
								value={search} 
								onChange={e => setSearch(e.target.value)} 
								style={{
									flex: 1,
									padding: '8px 12px',
									border: '1px solid #e2e8f0',
									borderRadius: '6px'
								}}
							/>
							{search.trim() && note?.transcript && (
								<div style={{ 
									fontSize: '14px', 
									color: '#64748b',
									backgroundColor: '#f1f5f9',
									padding: '4px 8px',
									borderRadius: '4px'
								}}>
									{filterContent(note.transcript).split('\n').length} matching lines
								</div>
							)}
						</div>
						<div style={{ 
							background: 'white', 
							border: '1px solid #e2e8f0', 
							borderRadius: 8, 
							padding: 16, 
							minHeight: 300 
						}}>
							{note?.transcript ? (
								<div style={{ 
									whiteSpace: 'pre-wrap',
									lineHeight: '1.6',
									fontSize: '14px',
									fontFamily: 'monospace',
									color: '#1e293b'
								}}>
									{filterContent(note.transcript)}
								</div>
							) : (
								<div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '40px 20px' }}>
									{meeting.status === 'sent' ? 
										'Meeting processed but transcript not found. Try refreshing or re-sending.' :
										meeting.status === 'queued' ? 
										'Meeting queued for AI processing. Please wait...' :
										'No transcript yet. Click "Send/Resend" to process this meeting with AI.'
									}
								</div>
							)}
						</div>
					</div>
				)}
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


