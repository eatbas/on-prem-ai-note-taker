import { useEffect, useState, useRef } from 'react'
import { db, syncMeeting, updateMeetingTags, assembleFileFromChunks, deleteMeetingLocally, deleteAudioChunksLocally, updateMeeting, deleteMeeting } from '../services'
import { TagsManager } from '../components/common'
import { useToast } from '../components/common'
import { createRippleEffect } from '../utils'

export default function MeetingView({ meetingId, onBack }: { meetingId: string; onBack?: () => void }) {
	const [meeting, setMeeting] = useState<any>(null)
	const [note, setNote] = useState<any>(null)
	const [sending, setSending] = useState(false)
    const [tagsInput, setTagsInput] = useState('')
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'audio'>('summary')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [totalChunks, setTotalChunks] = useState(0)
    const { showToast, ToastContainer } = useToast()

    // Audio playback state
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [isLoadingAudio, setIsLoadingAudio] = useState(false)
    const [audioError, setAudioError] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement>(null)

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteOperation, setDeleteOperation] = useState<'audio' | 'meeting' | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    
    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
    } | null>(null)

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

	// Context menu functions
	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setContextMenu({
			visible: true,
			x: e.clientX,
			y: e.clientY
		})
	}

	const closeContextMenu = () => {
		setContextMenu(null)
	}

	// Click outside to close context menu
	useEffect(() => {
		const handleClickOutside = () => {
			if (contextMenu?.visible) {
				closeContextMenu()
			}
		}
		
		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [contextMenu?.visible])

	// Context menu actions
	const handleContextMenuRename = async () => {
		if (!meeting) return
		
		const newTitle = window.prompt('Enter new meeting title:', meeting.title)
		if (newTitle && newTitle.trim() && newTitle.trim() !== meeting.title) {
			try {
				await updateMeeting(meetingId, newTitle.trim())
				// Update local database as well
				await db.meetings.update(meetingId, { title: newTitle.trim(), updatedAt: Date.now() })
				setMeeting(await db.meetings.get(meetingId))
				showToast('Meeting renamed successfully! ✏️', 'success')
			} catch (err) {
				console.error('Failed to rename meeting:', err)
				showToast('Failed to rename meeting. Please try again.', 'error')
			}
		}
		closeContextMenu()
	}

	const handleContextMenuDeleteAudio = () => {
		setDeleteOperation('audio')
		setShowDeleteModal(true)
		closeContextMenu()
	}

	const handleContextMenuDeleteMeeting = () => {
		setDeleteOperation('meeting')
		setShowDeleteModal(true)
		closeContextMenu()
	}

	async function sendNow() {
		setSending(true)
		try {
			await syncMeeting(meetingId)
			setNote(await db.notes.get(meetingId))
			// Refresh meeting to get updated status
			setMeeting(await db.meetings.get(meetingId))
			showToast('Meeting sent successfully! 🎉', 'success')
		} catch (err) {
			console.error('Send failed:', err)
			const errorMessage = err instanceof Error ? err.message : 'Unknown error'
			
			// Show specific error messages based on error type
			if (errorMessage.includes('Server error') || errorMessage.includes('500')) {
				showToast('Server error: The AI backend may be having issues. Please try again later.', 'error')
			} else if (errorMessage.includes('Cannot connect')) {
				showToast('Connection error: Cannot reach the AI backend server.', 'error')
			} else if (errorMessage.includes('Authentication failed')) {
				showToast('Authentication error: Please check your credentials.', 'error')
			} else if (errorMessage.includes('too large')) {
				showToast('File too large: Try recording shorter sessions.', 'error')
			} else {
				showToast(`Failed to send meeting: ${errorMessage}`, 'error')
			}
		} finally {
			setSending(false)
		}
	}

    async function saveTags() {
        try {
            const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
            await updateMeetingTags(meetingId, tags)
            setMeeting(await db.meetings.get(meetingId))
            showToast('Tags saved successfully! 🏷️', 'success')
        } catch (err) {
            console.error('Failed to save tags:', err)
            showToast('Failed to save tags. Please try again.', 'error')
        }
    }

    // Load audio for playback
    async function loadAudio() {
        setIsLoadingAudio(true)
        setAudioError(null)
        
        try {
            const chunks = await db.chunks.where({ meetingId }).sortBy('index')
            if (chunks.length === 0) {
                setAudioError('No audio data found for this meeting')
                return
            }
            
            const file = await assembleFileFromChunks(meetingId)
            const url = URL.createObjectURL(file)
            setAudioUrl(url)
        } catch (error) {
            console.error('Failed to load audio:', error)
            setAudioError('Failed to load audio. The recording might be corrupted.')
        } finally {
            setIsLoadingAudio(false)
        }
    }

    // Delete functions
    async function handleDeleteAudio() {
        setIsDeleting(true)
        try {
            await deleteAudioChunksLocally(meetingId)
            
            // Also revoke audio URL if it exists
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl)
                setAudioUrl(null)
            }
            
            showToast('Audio deleted successfully! 🗑️', 'success')
            setShowDeleteModal(false)
            setDeleteOperation(null)
        } catch (error) {
            console.error('Failed to delete audio:', error)
            showToast('Failed to delete audio. Please try again.', 'error')
        } finally {
            setIsDeleting(false)
        }
    }

    async function handleDeleteMeeting() {
        setIsDeleting(true)
        try {
            // Delete from VPS if the meeting was sent
            if (meeting?.status === 'sent') {
                try {
                    await deleteMeeting(meetingId)
                    showToast('Meeting deleted from server ✅', 'info')
                } catch (vpsError) {
                    console.warn('Failed to delete from VPS, proceeding with local deletion:', vpsError)
                    showToast('⚠️ Could not delete from server, but deleting locally', 'info')
                }
            }
            
            // Delete locally
            await deleteMeetingLocally(meetingId)
            
            // Revoke audio URL if it exists
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl)
                setAudioUrl(null)
            }
            
            showToast('Meeting deleted completely! 🗑️', 'success')
            setShowDeleteModal(false)
            setDeleteOperation(null)
            
            // Navigate back after successful deletion
            if (onBack) {
                setTimeout(onBack, 1000) // Give user time to see the success message
            }
        } catch (error) {
            console.error('Failed to delete meeting:', error)
            showToast('Failed to delete meeting. Please try again.', 'error')
        } finally {
            setIsDeleting(false)
        }
    }

    // Cleanup audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl)
            }
        }
    }, [audioUrl])

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
		<div 
			style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}
			onContextMenu={handleContextMenu}
		>
			{/* Toast Container */}
			<ToastContainer />
			
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
					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
						<button 
							onClick={(e) => {
								createRippleEffect(e)
								sendNow()
							}} 
							disabled={sending || meeting.status === 'sent'}
							style={{
								padding: '12px 24px',
								backgroundColor: sending ? '#9ca3af' : meeting.status === 'sent' ? '#10b981' : '#3b82f6',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: (sending || meeting.status === 'sent') ? 'not-allowed' : 'pointer',
								fontWeight: '600',
								fontSize: '14px',
								transition: 'all 0.2s ease',
								transform: 'scale(1)',
								minWidth: '140px'
							}}
							onMouseDown={(e) => {
								if (!sending && meeting.status !== 'sent') {
									e.currentTarget.style.transform = 'scale(0.95)'
									e.currentTarget.style.backgroundColor = '#2563eb'
								}
							}}
							onMouseUp={(e) => {
								if (!sending && meeting.status !== 'sent') {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#3b82f6'
								}
							}}
							onMouseLeave={(e) => {
								if (!sending && meeting.status !== 'sent') {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#3b82f6'
								}
							}}
						>
							{sending ? '⏳ Sending...' : meeting.status === 'sent' ? '✅ Sent' : '📤 Send/Resend'}
						</button>
						
						{/* Delete Audio Button */}
						<button 
							onClick={() => {
								setDeleteOperation('audio')
								setShowDeleteModal(true)
							}}
							style={{
								padding: '12px 16px',
								backgroundColor: '#f59e0b',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: '600',
								fontSize: '14px',
								transition: 'all 0.2s ease'
							}}
							title="Delete audio only (keep meeting data)"
						>
							🎵 Delete Audio
						</button>
						
						{/* Delete Meeting Button */}
						<button 
							onClick={() => {
								setDeleteOperation('meeting')
								setShowDeleteModal(true)
							}}
							style={{
								padding: '12px 16px',
								backgroundColor: '#ef4444',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: '600',
								fontSize: '14px',
								transition: 'all 0.2s ease'
							}}
							title="Delete entire meeting (both local and VPS)"
						>
							🗑️ Delete Meeting
						</button>
					</div>
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
							fontSize: '16px',
							transition: 'all 0.2s ease',
							transform: 'scale(1)'
						}}
						onMouseDown={(e) => {
							e.currentTarget.style.transform = 'scale(0.98)'
						}}
						onMouseUp={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
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
							fontSize: '16px',
							transition: 'all 0.2s ease',
							transform: 'scale(1)'
						}}
						onMouseDown={(e) => {
							e.currentTarget.style.transform = 'scale(0.98)'
						}}
						onMouseUp={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
						}}
					>
						🎧 Transcript
					</button>
					<button
						onClick={() => {
							setActiveTab('audio')
							if (!audioUrl && !isLoadingAudio) {
								loadAudio()
							}
						}}
						style={{
							padding: '12px 24px',
							border: 'none',
							backgroundColor: 'transparent',
							borderBottom: activeTab === 'audio' ? '2px solid #3b82f6' : '2px solid transparent',
							color: activeTab === 'audio' ? '#3b82f6' : '#64748b',
							fontWeight: activeTab === 'audio' ? '600' : '400',
							cursor: 'pointer',
							fontSize: '16px',
							transition: 'all 0.2s ease',
							transform: 'scale(1)'
						}}
						onMouseDown={(e) => {
							e.currentTarget.style.transform = 'scale(0.98)'
						}}
						onMouseUp={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
						}}
					>
						🔊 Audio
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

				{activeTab === 'audio' && (
					<div>
						<div style={{ 
							background: 'white', 
							border: '1px solid #e2e8f0', 
							borderRadius: 8, 
							padding: 16, 
							minHeight: 300 
						}}>
							{isLoadingAudio ? (
								<div style={{ textAlign: 'center', padding: '40px 20px' }}>
									<div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
									<div style={{ color: '#64748b' }}>Loading audio...</div>
								</div>
							) : audioError ? (
								<div style={{ textAlign: 'center', padding: '40px 20px' }}>
									<div style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️</div>
									<div style={{ color: '#ef4444', marginBottom: '16px' }}>{audioError}</div>
									<button 
										onClick={loadAudio}
										style={{
											padding: '8px 16px',
											backgroundColor: '#3b82f6',
											color: 'white',
											border: 'none',
											borderRadius: '6px',
											cursor: 'pointer'
										}}
									>
										Try Again
									</button>
								</div>
							) : audioUrl ? (
								<div style={{ textAlign: 'center' }}>
									<div style={{ fontSize: '24px', marginBottom: '16px' }}>🎵</div>
									<div style={{ marginBottom: '16px', color: '#64748b' }}>
										Recording from {new Date(meeting.createdAt).toLocaleString()}
									</div>
									<audio 
										ref={audioRef}
										controls 
										style={{ width: '100%', maxWidth: '500px' }}
										preload="metadata"
									>
										<source src={audioUrl} type="audio/webm" />
										Your browser does not support the audio element.
									</audio>
									<div style={{ marginTop: '16px', fontSize: '14px', color: '#64748b' }}>
										💡 You can play, pause, and seek through your meeting recording
									</div>
								</div>
							) : (
								<div style={{ textAlign: 'center', padding: '40px 20px' }}>
									<div style={{ fontSize: '24px', marginBottom: '16px' }}>🎤</div>
									<div style={{ color: '#64748b', marginBottom: '16px' }}>
										No audio available. Click below to load your recording.
									</div>
									<button 
										onClick={loadAudio}
										style={{
											padding: '12px 24px',
											backgroundColor: '#3b82f6',
											color: 'white',
											border: 'none',
											borderRadius: '6px',
											cursor: 'pointer',
											fontWeight: '600'
										}}
									>
										🔊 Load Audio
									</button>
								</div>
							)}
						</div>
					</div>
				)}
				<div style={{ marginTop: 16 }}>
					<h3>Tags</h3>
					<input 
						value={tagsInput} 
						onChange={e => setTagsInput(e.target.value)} 
						placeholder="tag1, tag2" 
						style={{
							padding: '8px 12px',
							border: '1px solid #e2e8f0',
							borderRadius: '6px',
							marginRight: '8px',
							fontSize: '14px',
							width: '200px'
						}}
					/>
					<button 
						onClick={(e) => {
							createRippleEffect(e)
							saveTags()
						}}
						style={{
							padding: '8px 16px',
							backgroundColor: '#10b981',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							fontWeight: '500',
							fontSize: '14px',
							transition: 'all 0.2s ease',
							transform: 'scale(1)'
						}}
						onMouseDown={(e) => {
							e.currentTarget.style.transform = 'scale(0.95)'
							e.currentTarget.style.backgroundColor = '#059669'
						}}
						onMouseUp={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
							e.currentTarget.style.backgroundColor = '#10b981'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
							e.currentTarget.style.backgroundColor = '#10b981'
						}}
					>
						💾 Save Tags
					</button>
				</div>

				{/* Delete Confirmation Modal */}
				{showDeleteModal && (
					<div style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000
					}}>
						<div style={{
							backgroundColor: 'white',
							padding: '24px',
							borderRadius: '12px',
							maxWidth: '400px',
							width: '90%',
							boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
						}}>
							<div style={{
								display: 'flex',
								alignItems: 'center',
								marginBottom: '16px'
							}}>
								<div style={{ fontSize: '24px', marginRight: '12px' }}>
									{deleteOperation === 'audio' ? '🎵' : '🗑️'}
								</div>
								<h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
									{deleteOperation === 'audio' ? 'Delete Audio' : 'Delete Meeting'}
								</h3>
							</div>
							
							<p style={{ 
								margin: '0 0 20px 0', 
								color: '#6b7280', 
								fontSize: '14px',
								lineHeight: '1.5'
							}}>
								{deleteOperation === 'audio' 
									? 'This will permanently delete the audio recording for this meeting. The meeting notes, summary, and transcript will be preserved.'
									: 'This will permanently delete the entire meeting, including audio, transcript, summary, and all associated data both locally and from the server.'
								}
							</p>
							
							<div style={{ 
								display: 'flex', 
								justifyContent: 'flex-end', 
								gap: '12px' 
							}}>
								<button
									onClick={() => {
										setShowDeleteModal(false)
										setDeleteOperation(null)
									}}
									disabled={isDeleting}
									style={{
										padding: '8px 16px',
										backgroundColor: '#f3f4f6',
										color: '#374151',
										border: '1px solid #d1d5db',
										borderRadius: '6px',
										cursor: isDeleting ? 'not-allowed' : 'pointer',
										fontSize: '14px',
										fontWeight: '500'
									}}
								>
									Cancel
								</button>
								<button
									onClick={deleteOperation === 'audio' ? handleDeleteAudio : handleDeleteMeeting}
									disabled={isDeleting}
									style={{
										padding: '8px 16px',
										backgroundColor: deleteOperation === 'audio' ? '#f59e0b' : '#ef4444',
										color: 'white',
										border: 'none',
										borderRadius: '6px',
										cursor: isDeleting ? 'not-allowed' : 'pointer',
										fontSize: '14px',
										fontWeight: '600',
										opacity: isDeleting ? 0.6 : 1
									}}
								>
									{isDeleting 
										? (deleteOperation === 'audio' ? 'Deleting Audio...' : 'Deleting Meeting...') 
										: (deleteOperation === 'audio' ? 'Delete Audio' : 'Delete Meeting')
									}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Context Menu */}
			{contextMenu?.visible && (
				<div
					style={{
						position: 'fixed',
						top: contextMenu.y,
						left: contextMenu.x,
						backgroundColor: 'white',
						border: '1px solid #e5e7eb',
						borderRadius: '8px',
						boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
						zIndex: 1000,
						minWidth: '180px',
						overflow: 'hidden'
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div style={{
						padding: '8px 0',
						fontSize: '14px'
					}}>
						<div
							onClick={handleContextMenuRename}
							style={{
								padding: '12px 16px',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								transition: 'background-color 0.15s ease'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#f3f4f6'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = 'transparent'
							}}
						>
							<span style={{ fontSize: '16px' }}>✏️</span>
							<span>Rename Meeting</span>
						</div>
						
						<div
							onClick={handleContextMenuDeleteAudio}
							style={{
								padding: '12px 16px',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								transition: 'background-color 0.15s ease'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#fef3c7'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = 'transparent'
							}}
						>
							<span style={{ fontSize: '16px' }}>🎵</span>
							<span>Delete Audio</span>
						</div>
						
						<div
							onClick={handleContextMenuDeleteMeeting}
							style={{
								padding: '12px 16px',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								transition: 'background-color 0.15s ease',
								borderTop: '1px solid #f3f4f6'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#fee2e2'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = 'transparent'
							}}
						>
							<span style={{ fontSize: '16px' }}>🗑️</span>
							<span style={{ color: '#dc2626' }}>Delete Meeting</span>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

function InlineTitle({ id, title, onSaved }: { id: string; title: string; onSaved: () => void }) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(title)
    const { showToast } = useToast()
    
    useEffect(() => setValue(title), [title])
    async function save() {
        const trimmed = value.trim()
        if (trimmed && trimmed !== title) {
            try { 
                await updateMeeting(id, trimmed) 
                showToast('Title updated successfully! ✏️', 'success')
            } catch (err) {
                showToast('Failed to update title. Please try again.', 'error')
            }
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
                style={{ 
                    fontSize: 22, 
                    fontWeight: 700, 
                    width: '100%', 
                    padding: 6,
                    border: '2px solid #3b82f6',
                    borderRadius: '6px',
                    outline: 'none',
                    backgroundColor: '#f0f9ff'
                }}
            />
        )
    }
    return (
        <h2 
            style={{ 
                margin: 0,
                cursor: 'text',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                backgroundColor: 'transparent'
            }} 
            onClick={() => setEditing(true)}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
            }}
        >
            {title}
        </h2>
    )
}


