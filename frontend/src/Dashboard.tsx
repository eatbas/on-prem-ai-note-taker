import { useEffect, useMemo, useState } from 'react'
import { listMeetings, syncMeeting, watchOnline } from './offline'
import { getMeetings, getVpsHealth, updateMeeting } from './api'
import { db } from './db'

export default function Dashboard({ 
	onOpen, 
	refreshSignal,
	text,
	setText,
	tag,
	setTag,
	online,
	vpsUp,
	onTagsChange
}: { 
	onOpen: (meetingId: string) => void; 
	refreshSignal?: number;
	text: string;
	setText: (text: string) => void;
	tag: string;
	setTag: (tag: string) => void;
	online: boolean;
	vpsUp: boolean | null;
	onTagsChange?: (tags: [string, number][]) => void;
}) {
	const [meetings, setMeetings] = useState<any[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const meetingsPerPage = 3  // Changed from 5 to 3 so you can see pagination with 4 meetings

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
			// Go to first page when new meetings are added
			setCurrentPage(1)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refreshSignal])

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

	// Get available tags from meetings
	const tags = useMemo(() => {
		const all: Record<string, number> = {}
		meetings.forEach(m => m.tags?.forEach((t: string) => (all[t] = (all[t] || 0) + 1)))
		return Object.entries(all).sort((a, b) => b[1] - a[1])
	}, [meetings])

	// Notify parent component when tags change
	useEffect(() => {
		if (onTagsChange) {
			onTagsChange(tags)
		}
	}, [tags, onTagsChange])

	// Pagination logic
	const totalPages = Math.ceil(meetings.length / meetingsPerPage)
	const startIndex = (currentPage - 1) * meetingsPerPage
	const endIndex = startIndex + meetingsPerPage
	const currentMeetings = meetings.slice(startIndex, endIndex)

	// Auto-adjust page if current page is beyond available pages
	useEffect(() => {
		if (totalPages > 0 && currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [totalPages, currentPage])

	// Reset to first page when search/filter changes
	useEffect(() => {
		setCurrentPage(1)
	}, [text, tag])

	// Add pagination controls at the bottom
	const PaginationControls = () => (
		<div style={{ 
			display: 'flex', 
			justifyContent: 'center', 
			alignItems: 'center', 
			gap: '8px',
			marginTop: '24px',
			padding: '16px',
			backgroundColor: '#f8fafc',
			borderRadius: '8px',
			border: '1px solid #e2e8f0'
		}}>
			<button
				onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
				disabled={currentPage === 1}
				style={{
					padding: '8px 16px',
					border: '1px solid #d1d5db',
					backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
					color: currentPage === 1 ? '#9ca3af' : '#374151',
					borderRadius: '6px',
					cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
					fontSize: '14px'
				}}
			>
				← Previous
			</button>
			
			<span style={{ 
				fontSize: '14px', 
				color: '#6b7280',
				padding: '0 16px'
			}}>
				Page {currentPage} of {totalPages}
			</span>
			
			<button
				onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
				disabled={currentPage === totalPages}
				style={{
					padding: '8px 16px',
					border: '1px solid #d1d5db',
					backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
					color: currentPage === totalPages ? '#9ca3af' : '#374151',
					borderRadius: '6px',
					cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
					fontSize: '14px'
				}}
			>
				Next →
			</button>
		</div>
	)

	return (
		<div>

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
				{currentMeetings.map(m => (
					<li key={m.id} 
						onClick={() => onOpen(m.id)}
						style={{ 
							display: 'flex', 
							gap: 12, 
							padding: 16, 
							borderBottom: '1px solid #eee',
							backgroundColor: '#fafafa',
							marginBottom: 8,
							borderRadius: 4,
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							border: '1px solid transparent',
							position: 'relative'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#f0f0f0'
							e.currentTarget.style.transform = 'translateY(-1px)'
							e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
							e.currentTarget.style.borderColor = '#d1d5db'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#fafafa'
							e.currentTarget.style.transform = 'translateY(0)'
							e.currentTarget.style.boxShadow = 'none'
							e.currentTarget.style.borderColor = 'transparent'
						}}
					>
						<div style={{ flex: 1 }}>
							<div style={{ 
								display: 'flex', 
								alignItems: 'center', 
								gap: '8px',
								marginBottom: 4 
							}}>
								<div style={{ fontWeight: 600, fontSize: 18 }}>
									<InlineEditableTitle id={m.id} title={m.title || 'Untitled Meeting'} onSaved={refresh} />
								</div>
								<span style={{ 
									fontSize: '12px', 
									color: '#6b7280',
									opacity: 0.7,
									fontStyle: 'italic'
								}}>
									👆 Click to open
								</span>
							</div>
							<div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
								📅 {new Date(m.created_at || m.createdAt).toLocaleString()}
								{m.duration && (
									<span style={{ 
										backgroundColor: '#f3f4f6', 
										padding: '2px 6px', 
										borderRadius: '10px',
										marginLeft: '8px',
										fontWeight: '500',
										color: '#374151'
									}}>
										⏱️ {Math.round(m.duration / 60)} min
									</span>
								)}
								{!m.duration && m.status === 'sent' && (
									<span style={{ 
										backgroundColor: '#fef3c7', 
										padding: '2px 6px', 
										borderRadius: '10px',
										marginLeft: '8px',
										fontSize: '12px',
										color: '#92400e'
									}}>
										⏱️ Duration not recorded
									</span>
								)}
								{/* Debug: Show actual status value */}
								<span style={{ 
									backgroundColor: '#fee', 
									padding: '2px 6px', 
									borderRadius: '10px',
									marginLeft: '8px',
									fontSize: '12px',
									color: '#dc2626'
								}}>
									🔍 Status: {m.status || 'undefined'}
								</span>
							</div>
							{m.summary && (
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
							)}
						</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
							<button 
								onClick={(e) => {
									e.stopPropagation()
									onOpen(m.id)
								}} 
								style={{ 
									padding: '8px 16px',
									backgroundColor: '#3b82f6',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer',
									fontWeight: '500'
								}}
							>
								📄 Open
							</button>
							{m.status !== 'sent' && (
								<button 
									onClick={(e) => {
										e.stopPropagation()
										retry(m.id)
									}} 
									disabled={!online} 
									style={{ 
										padding: '8px 16px',
										backgroundColor: '#10b981',
										color: 'white',
										border: 'none',
										borderRadius: '4px',
										cursor: online ? 'pointer' : 'not-allowed',
										fontWeight: '500',
										opacity: online ? 1 : 0.6
									}}
								>
									📤 Send
								</button>
							)}
						</div>
					</li>
				))}
			</ul>

			{/* Pagination Controls - Moved to bottom */}
			{!loading && meetings.length > 0 && (
				<div style={{ 
					display: 'flex', 
					justifyContent: 'space-between', 
					alignItems: 'center', 
					marginTop: 20,
					padding: '12px 16px',
					backgroundColor: '#f8fafc',
					borderRadius: '8px',
					border: '1px solid #e2e8f0'
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<span style={{ fontSize: '14px', color: '#64748b' }}>
							📊 Showing {startIndex + 1}-{Math.min(endIndex, meetings.length)} of {meetings.length} meetings
						</span>
						<span style={{ 
							fontSize: '12px', 
							color: '#6b7280',
							backgroundColor: '#e5e7eb',
							padding: '2px 6px',
							borderRadius: '10px'
						}}>
							📄 {totalPages} page{totalPages > 1 ? 's' : ''}
						</span>
					</div>
					{totalPages > 1 && (
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<button 
								onClick={() => setCurrentPage(1)} 
								disabled={currentPage === 1}
								style={{
									padding: '4px 8px',
									border: '1px solid #d1d5db',
									backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
									borderRadius: '4px',
									cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
									fontSize: '12px'
								}}
							>
								⏮️ First
							</button>
							<button 
								onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
								disabled={currentPage === 1}
								style={{
									padding: '4px 8px',
									border: '1px solid #d1d5db',
									backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
									borderRadius: '4px',
									cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
									fontSize: '12px'
								}}
							>
								⬅️ Previous
							</button>
							<span style={{ 
								fontSize: '14px', 
								fontWeight: '500',
								color: '#374151',
								minWidth: '80px',
								textAlign: 'center'
							}}>
								Page {currentPage} of {totalPages}
							</span>
							{totalPages > 5 && (
								<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
									<span style={{ fontSize: '12px', color: '#6b7280' }}>Go to:</span>
									<input
										type="number"
										min="1"
										max={totalPages}
										value={currentPage}
										onChange={(e) => {
											const page = parseInt(e.target.value)
											if (page >= 1 && page <= totalPages) {
												setCurrentPage(page)
											}
										}}
										style={{
											width: '50px',
											padding: '2px 4px',
											border: '1px solid #d1d5db',
											borderRadius: '3px',
											fontSize: '12px',
											textAlign: 'center'
										}}
									/>
								</div>
							)}
							<button 
								onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
								disabled={currentPage === totalPages}
								style={{
									padding: '4px 8px',
									border: '1px solid #d1d5db',
									backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
									borderRadius: '4px',
									cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
									fontSize: '12px'
								}}
							>
								Next ➡️
							</button>
							<button 
								onClick={() => setCurrentPage(totalPages)} 
								disabled={currentPage === totalPages}
								style={{
									padding: '4px 8px',
									border: '1px solid #d1d5db',
									backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
									borderRadius: '4px',
									cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
									fontSize: '12px'
								}}
							>
								Last ⏭️
							</button>
						</div>
					)}
				</div>
			)}
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


