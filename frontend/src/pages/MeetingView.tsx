import { useEffect, useState, useRef } from 'react'
import { db, syncMeeting, updateMeetingTags, assembleFileFromChunks, assembleFilesByAudioType, deleteMeetingLocally, deleteAudioChunksLocally, updateMeeting, deleteMeeting, getMeeting as getVpsMeeting, getMeetingSpeakers, updateSpeakerName } from '../services'
import { TagsManager } from '../components/common'
import { useToast } from '../components/common'
import { createRippleEffect, formatDuration } from '../utils'
import config from '../utils/envLoader'

export default function MeetingView({ meetingId, onBack }: { meetingId: string; onBack?: () => void }) {
	const [meeting, setMeeting] = useState<any>(null)
	const [note, setNote] = useState<any>(null)
	const [sending, setSending] = useState(false)
    const [tagsInput, setTagsInput] = useState('')
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'audio' | 'speakers'>('summary')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [totalChunks, setTotalChunks] = useState(0)
    const { showToast, ToastContainer } = useToast()
    const [isRemote, setIsRemote] = useState(false)
    // Audio details
    const [audioTotalBytes, setAudioTotalBytes] = useState(0)
    const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null)
    const chunkMs = config.audioChunkMs

    // Audio playback state
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [isLoadingAudio, setIsLoadingAudio] = useState(false)
    const [audioError, setAudioError] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement>(null)

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteOperation, setDeleteOperation] = useState<'audio' | 'meeting' | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Dual audio information state
    const [dualAudioInfo, setDualAudioInfo] = useState<{
        microphone: { chunks: number; size: number; hasData: boolean; whisperBenefit: string };
        system: { chunks: number; size: number; hasData: boolean; whisperBenefit: string };
        hasSeparateStreams: boolean;
    } | null>(null)

    // Audio URLs for playback
    const [audioUrls, setAudioUrls] = useState<{
        microphone: string | null;
        system: string | null;
    }>({ microphone: null, system: null })

    const [activeAudioType, setActiveAudioType] = useState<'microphone' | 'system'>('microphone')
    const micAudioRef = useRef<HTMLAudioElement>(null)
    const systemAudioRef = useRef<HTMLAudioElement>(null)

    // Speaker management state
    const [speakers, setSpeakers] = useState<any[]>([])
    const [loadingSpeakers, setLoadingSpeakers] = useState(false)
    const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
    const [speakerNameInput, setSpeakerNameInput] = useState('')
    
    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
    } | null>(null)

	useEffect(() => {
		let interval: any = null

		async function loadLocal() {
			const m = await db.meetings.get(meetingId)
			setMeeting(m)
			setNote(await db.notes.get(meetingId))
            setTagsInput((m?.tags || []).join(', '))
            
            // Load chunk information for progress tracking and details
            if (m?.status === 'local' || m?.status === 'queued' || m?.status === 'sent') {
                const chunks = await db.chunks.where({ meetingId }).toArray()
                setTotalChunks(chunks.length)
                setUploadProgress(chunks.length)
                
                // Analyze dual audio information
                const micChunks = chunks.filter(c => c.audioType === 'microphone')
                const systemChunks = chunks.filter(c => c.audioType === 'system')
                
                const micSize = micChunks.reduce((sum, c) => sum + (c.blob ? c.blob.size : 0), 0)
                const systemSize = systemChunks.reduce((sum, c) => sum + (c.blob ? c.blob.size : 0), 0)
                const totalBytes = micSize + systemSize
                
                console.log(`📊 Audio Analysis: Mic=${micChunks.length} chunks (${(micSize/1024).toFixed(1)}KB), System=${systemChunks.length} chunks (${(systemSize/1024).toFixed(1)}KB)`)
                
                const micBenefit = micSize > 0 ? "Perfect isolation of user speech" : "No microphone data"
                const systemBenefit = systemSize > 0 ? "Clear participant audio separation" : "No system audio data"
                
                setDualAudioInfo({
                    microphone: {
                        chunks: micChunks.length,
                        size: micSize,
                        hasData: micSize > 0,
                        whisperBenefit: micBenefit
                    },
                    system: {
                        chunks: systemChunks.length,
                        size: systemSize,
                        hasData: systemSize > 0,
                        whisperBenefit: systemBenefit
                    },
                    hasSeparateStreams: micChunks.length > 0 && systemChunks.length > 0
                })
                
                setAudioTotalBytes(totalBytes)
            }
		}

        function mapRemoteMeeting(remote: any) {
            return {
                id: remote.id,
                title: remote.title,
                createdAt: new Date(remote.created_at).getTime(),
                updatedAt: new Date(remote.updated_at).getTime(),
                duration: remote.duration,
                tags: remote.tags || [],
                status: 'sent'
            }
        }

		async function init() {
			const local = await db.meetings.get(meetingId)
			if (local) {
                setIsRemote(false)
				await loadLocal()
				interval = setInterval(loadLocal, 2000) // Refresh every 2 seconds
				return
			}

            // No local meeting found: fetch from VPS
            setIsRemote(true)
            try {
                const remote = await getVpsMeeting(meetingId)
                setMeeting(mapRemoteMeeting(remote))
                setNote({ id: remote.id, summary: remote.summary || '', transcript: remote.transcription || '' })
                setTagsInput(((remote.tags as string[] | undefined) || []).join(', '))
                setTotalChunks(0)
                setAudioTotalBytes(0)
                
                // Load speakers for remote meetings
                loadSpeakers()
            } catch (err) {
                console.error('Failed to load meeting from VPS:', err)
                showToast('Failed to load meeting from VPS. Please check your connection.', 'error')
            }
		}
		init()
		return () => { if (interval) clearInterval(interval) }
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
				// Update local database as well when applicable
                if (!isRemote) {
                    await db.meetings.update(meetingId, { title: newTitle.trim(), updatedAt: Date.now() })
                    setMeeting(await db.meetings.get(meetingId))
                } else {
                    try {
                        const remote = await getVpsMeeting(meetingId)
                        setMeeting({
                            id: remote.id,
                            title: remote.title,
                            createdAt: new Date(remote.created_at).getTime(),
                            updatedAt: new Date(remote.updated_at).getTime(),
                            duration: remote.duration,
                            tags: remote.tags || [],
                            status: 'sent'
                        })
                    } catch {}
                }
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

    // Load speakers from backend
    const loadSpeakers = async () => {
        if (!meeting?.id || !isRemote) return
        
        setLoadingSpeakers(true)
        try {
            const speakersData = await getMeetingSpeakers(meeting.id)
            setSpeakers(speakersData)
        } catch (error) {
            console.error('Failed to load speakers:', error)
            showToast('Failed to load speakers', 'error')
        } finally {
            setLoadingSpeakers(false)
        }
    }

    // Update speaker name
    const handleUpdateSpeakerName = async (speakerId: string, newName: string) => {
        if (!meeting?.id || !newName.trim()) return
        
        try {
            await updateSpeakerName(meeting.id, speakerId, newName.trim())
            await loadSpeakers() // Reload speakers
            setEditingSpeaker(null)
            setSpeakerNameInput('')
            showToast('Speaker name updated', 'success')
        } catch (error) {
            console.error('Failed to update speaker name:', error)
            showToast('Failed to update speaker name', 'error')
        }
    }

    // Start editing speaker name
    const startEditingSpeaker = (speakerId: string, currentName: string) => {
        setEditingSpeaker(speakerId)
        setSpeakerNameInput(currentName)
    }

    // Cancel editing speaker name
    const cancelEditingSpeaker = () => {
        setEditingSpeaker(null)
        setSpeakerNameInput('')
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

    // Load dual audio for playback
    async function loadDualAudio() {
        if (!audioUrls.microphone && !audioUrls.system) {
            setIsLoadingAudio(true)
            setAudioError(null)
            
            try {
                const audioFiles = await assembleFilesByAudioType(meetingId)
                
                const newUrls: { microphone: string | null; system: string | null } = {
                    microphone: null,
                    system: null
                }
                
                if (audioFiles.microphone) {
                    newUrls.microphone = URL.createObjectURL(audioFiles.microphone)
                }
                
                if (audioFiles.system) {
                    newUrls.system = URL.createObjectURL(audioFiles.system)
                }
                
                if (!newUrls.microphone && !newUrls.system) {
                    setAudioError('No audio data found for this meeting')
                    return
                }
                
                setAudioUrls(newUrls)
                console.log('🎵 Dual audio loaded:', { 
                    mic: !!newUrls.microphone, 
                    system: !!newUrls.system 
                })
            } catch (error) {
                console.error('Failed to load dual audio:', error)
                setAudioError('Failed to load audio files')
            } finally {
                setIsLoadingAudio(false)
            }
        }
    }

    // Delete functions
    async function handleDeleteAudio() {
        setIsDeleting(true)
        try {
            await deleteAudioChunksLocally(meetingId)
            
            // Also revoke dual audio URLs if they exist
            if (audioUrls.microphone) {
                URL.revokeObjectURL(audioUrls.microphone)
            }
            if (audioUrls.system) {
                URL.revokeObjectURL(audioUrls.system)
            }
            setAudioUrls({ microphone: null, system: null })
            
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
            if (audioUrls.microphone) {
                URL.revokeObjectURL(audioUrls.microphone)
            }
            if (audioUrls.system) {
                URL.revokeObjectURL(audioUrls.system)
            }
        }
    }, [audioUrls])

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
            style={{ display: 'block' }}
            onContextMenu={handleContextMenu}
        >
            {/* Toast Container */}
            <ToastContainer />
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <InlineTitle id={meetingId} title={meeting.title} onSaved={async () => {
                        if (isRemote) {
                            try {
                                const remote = await getVpsMeeting(meetingId)
                                setMeeting({
                                    id: remote.id,
                                    title: remote.title,
                                    createdAt: new Date(remote.created_at).getTime(),
                                    updatedAt: new Date(remote.updated_at).getTime(),
                                    duration: remote.duration,
                                    tags: remote.tags || [],
                                    status: 'sent'
                                })
                            } catch {}
                        } else {
                            setMeeting(await db.meetings.get(meetingId))
                        }
                    }} />
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
                    📅 {new Date(meeting.createdAt).toLocaleString()} {typeof meeting.duration === 'number' || audioDurationSec || totalChunks ? `• ⏱️ ${formatDuration((audioDurationSec ?? (typeof meeting.duration === 'number' ? meeting.duration : (totalChunks * (chunkMs / 1000)))))}` : ''}
                </div>

                {/* Audio details panel */}
                {/* Enhanced Audio Analysis Panel */}
                <div style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16
                }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '16px', fontWeight: '600' }}>
                        🎵 Whisper Audio Analysis
                    </h3>
                    
                    {dualAudioInfo ? (
                        <div>
                            {/* Basic Info Row */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                gap: 12,
                                marginBottom: 16
                            }}>
                                <div><strong>Language:</strong> <span style={{ color: '#334155' }}>{meeting.language === 'auto' ? 'TR' : meeting.language?.toUpperCase?.() || 'TR'}</span></div>
                                <div><strong>Total Chunks:</strong> <span style={{ color: '#334155' }}>{totalChunks}</span></div>
                                <div><strong>Chunk Size:</strong> <span style={{ color: '#334155' }}>{Math.round(chunkMs/1000)}s</span></div>
                                <div><strong>Total Size:</strong> <span style={{ color: '#334155' }}>{(audioTotalBytes / (1024*1024)).toFixed(2)} MB</span></div>
                            </div>

                            {/* Dual Audio Breakdown */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 16
                            }}>
                                {/* Microphone Audio */}
                                <div style={{
                                    padding: 12,
                                    backgroundColor: dualAudioInfo.microphone.hasData ? '#eff6ff' : '#f1f5f9',
                                    border: `1px solid ${dualAudioInfo.microphone.hasData ? '#dbeafe' : '#e2e8f0'}`,
                                    borderRadius: 6
                                }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: 8 }}>
                                        🎤 Microphone Audio
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 4 }}>
                                        <strong>Chunks:</strong> {dualAudioInfo.microphone.chunks} • 
                                        <strong> Size:</strong> {(dualAudioInfo.microphone.size / 1024).toFixed(1)} KB
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                                        {dualAudioInfo.microphone.whisperBenefit}
                                    </div>
                                </div>

                                {/* System Audio */}
                                <div style={{
                                    padding: 12,
                                    backgroundColor: dualAudioInfo.system.hasData ? '#f0fdf4' : '#f1f5f9',
                                    border: `1px solid ${dualAudioInfo.system.hasData ? '#dcfce7' : '#e2e8f0'}`,
                                    borderRadius: 6
                                }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: 8 }}>
                                        🔊 System Audio
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 4 }}>
                                        <strong>Chunks:</strong> {dualAudioInfo.system.chunks} • 
                                        <strong> Size:</strong> {(dualAudioInfo.system.size / 1024).toFixed(1)} KB
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                                        {dualAudioInfo.system.whisperBenefit}
                                    </div>
                                </div>
                            </div>

                            {/* Whisper Benefit Summary */}
                            {dualAudioInfo.hasSeparateStreams && (
                                <div style={{
                                    marginTop: 12,
                                    padding: 10,
                                    backgroundColor: '#fefce8',
                                    border: '1px solid #fef3c7',
                                    borderRadius: 6,
                                    fontSize: '12px',
                                    color: '#92400e'
                                }}>
                                    ✨ <strong>Whisper Optimization:</strong> Dual-stream recording detected! This provides maximum accuracy with separate user and participant audio channels.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: 12
                        }}>
                            <div><strong>Language:</strong> <span style={{ color: '#334155' }}>{meeting.language === 'auto' ? 'TR' : meeting.language?.toUpperCase?.() || 'TR'}</span></div>
                            <div><strong>Chunks:</strong> <span style={{ color: '#334155' }}>{totalChunks}</span></div>
                            <div><strong>Chunk Size:</strong> <span style={{ color: '#334155' }}>{Math.round(chunkMs/1000)}s</span></div>
                            <div><strong>Total Size:</strong> <span style={{ color: '#334155' }}>{(audioTotalBytes / (1024*1024)).toFixed(2)} MB</span></div>
                        </div>
                    )}
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
                            if (!audioUrls.microphone && !audioUrls.system && !isLoadingAudio) {
                                loadDualAudio()
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
                    {isRemote && (
                        <button
                            onClick={() => setActiveTab('speakers')}
                            style={{
                                padding: '12px 24px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                borderBottom: activeTab === 'speakers' ? '2px solid #3b82f6' : '2px solid transparent',
                                color: activeTab === 'speakers' ? '#3b82f6' : '#64748b',
                                fontWeight: activeTab === 'speakers' ? '600' : '400',
                                cursor: 'pointer',
                                fontSize: '16px',
                                transition: 'all 0.2s ease',
                                transform: 'scale(1)'
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== 'speakers') {
                                    e.currentTarget.style.color = '#475569'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== 'speakers') {
                                    e.currentTarget.style.color = '#64748b'
                                }
                            }}
                        >
                            👥 Speakers
                        </button>
                    )}
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
                                    <div style={{ color: '#64748b' }}>Loading dual audio...</div>
                                </div>
                            ) : audioError ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️</div>
                                    <div style={{ color: '#ef4444', marginBottom: '16px' }}>{audioError}</div>
                                    <button 
                                        onClick={loadDualAudio}
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
                            ) : (audioUrls.microphone || audioUrls.system) ? (
                                <div>
                                    {/* Audio Type Selector */}
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        marginBottom: '20px',
                                        gap: '8px'
                                    }}>
                                        {audioUrls.microphone && (
                                            <button
                                                onClick={() => setActiveAudioType('microphone')}
                                                style={{
                                                    padding: '8px 16px',
                                                    border: `2px solid ${activeAudioType === 'microphone' ? '#3b82f6' : '#e2e8f0'}`,
                                                    backgroundColor: activeAudioType === 'microphone' ? '#eff6ff' : 'white',
                                                    color: activeAudioType === 'microphone' ? '#3b82f6' : '#64748b',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                🎤 Microphone
                                            </button>
                                        )}
                                        {audioUrls.system && (
                                            <button
                                                onClick={() => setActiveAudioType('system')}
                                                style={{
                                                    padding: '8px 16px',
                                                    border: `2px solid ${activeAudioType === 'system' ? '#10b981' : '#e2e8f0'}`,
                                                    backgroundColor: activeAudioType === 'system' ? '#f0fdf4' : 'white',
                                                    color: activeAudioType === 'system' ? '#10b981' : '#64748b',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                🔊 System Audio
                                            </button>
                                        )}
                                    </div>

                                    {/* Active Audio Player */}
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '16px' }}>
                                            {activeAudioType === 'microphone' ? '🎤' : '🔊'}
                                        </div>
                                        <div style={{ marginBottom: '16px', color: '#64748b' }}>
                                            <strong>
                                                {activeAudioType === 'microphone' ? 'Microphone Audio' : 'System Audio'}
                                            </strong> from {new Date(meeting.createdAt).toLocaleString()}
                                        </div>
                                        
                                        {/* Microphone Audio Player */}
                                        {activeAudioType === 'microphone' && audioUrls.microphone && (
                                            <audio 
                                                ref={micAudioRef}
                                                controls 
                                                style={{ width: '100%', maxWidth: '500px' }}
                                                preload="metadata"
                                            >
                                                <source src={audioUrls.microphone} type="audio/webm" />
                                                Your browser does not support the audio element.
                                            </audio>
                                        )}
                                        
                                        {/* System Audio Player */}
                                        {activeAudioType === 'system' && audioUrls.system && (
                                            <audio 
                                                ref={systemAudioRef}
                                                controls 
                                                style={{ width: '100%', maxWidth: '500px' }}
                                                preload="metadata"
                                            >
                                                <source src={audioUrls.system} type="audio/webm" />
                                                Your browser does not support the audio element.
                                            </audio>
                                        )}
                                        
                                        <div style={{ marginTop: '16px', fontSize: '14px', color: '#64748b' }}>
                                            💡 Switch between microphone and system audio using the buttons above
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '16px' }}>🎤</div>
                                    <div style={{ color: '#64748b', marginBottom: '16px' }}>
                                        No audio available. Click below to load your recording.
                                    </div>
                                    <button 
                                        onClick={loadDualAudio}
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
                                        🔊 Load Dual Audio
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Speakers Tab */}
                {activeTab === 'speakers' && (
                    <div>
                        <div style={{ 
                            background: 'white', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: 8, 
                            padding: 16
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginBottom: '20px',
                                paddingBottom: '12px',
                                borderBottom: '1px solid #e2e8f0'
                            }}>
                                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '600' }}>
                                    👥 Meeting Speakers ({speakers.length})
                                </h3>
                                <button 
                                    onClick={loadSpeakers}
                                    disabled={loadingSpeakers}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: loadingSpeakers ? '#e2e8f0' : '#3b82f6',
                                        color: loadingSpeakers ? '#64748b' : 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: loadingSpeakers ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    {loadingSpeakers ? '🔄 Loading...' : '🔄 Refresh'}
                                </button>
                            </div>

                            {loadingSpeakers ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
                                    <div style={{ color: '#64748b' }}>Loading speakers...</div>
                                </div>
                            ) : speakers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '16px' }}>👥</div>
                                    <div style={{ color: '#64748b', marginBottom: '16px' }}>
                                        No speakers found. This meeting may not have speaker diarization data.
                                    </div>
                                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                                        Speaker identification is available for meetings processed with dual audio.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {speakers.map((speaker) => (
                                        <div key={speaker.id} style={{
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            backgroundColor: speaker.speaker_type === 'USER' ? '#eff6ff' : '#f8fafc'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '20px' }}>
                                                        {speaker.speaker_type === 'USER' ? '🎤' : '🔊'}
                                                    </span>
                                                    {editingSpeaker === speaker.id ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input
                                                                type="text"
                                                                value={speakerNameInput}
                                                                onChange={(e) => setSpeakerNameInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleUpdateSpeakerName(speaker.id, speakerNameInput)
                                                                    } else if (e.key === 'Escape') {
                                                                        cancelEditingSpeaker()
                                                                    }
                                                                }}
                                                                autoFocus
                                                                style={{
                                                                    padding: '4px 8px',
                                                                    border: '1px solid #3b82f6',
                                                                    borderRadius: '4px',
                                                                    fontSize: '16px',
                                                                    fontWeight: '600'
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => handleUpdateSpeakerName(speaker.id, speakerNameInput)}
                                                                style={{
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#10b981',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px'
                                                                }}
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                onClick={cancelEditingSpeaker}
                                                                style={{
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#ef4444',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px'
                                                                }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                                                                {speaker.custom_name || speaker.original_speaker_id}
                                                            </h4>
                                                            {speaker.speaker_type !== 'USER' && (
                                                                <button
                                                                    onClick={() => startEditingSpeaker(speaker.id, speaker.custom_name || speaker.original_speaker_id)}
                                                                    style={{
                                                                        padding: '2px 6px',
                                                                        backgroundColor: 'transparent',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        color: '#6b7280'
                                                                    }}
                                                                    title="Rename speaker"
                                                                >
                                                                    ✏️
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                    {speaker.speaker_type === 'USER' ? 'Microphone' : 'System Audio'}
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                                                <div style={{ textAlign: 'center', padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6' }}>
                                                        {speaker.total_segments}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>Segments</div>
                                                </div>
                                                <div style={{ textAlign: 'center', padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>
                                                        {formatDuration(Math.round(speaker.total_duration))}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>Duration</div>
                                                </div>
                                            </div>

                                            {/* Show sample segments */}
                                            <div style={{ marginTop: '12px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                                    Sample Quotes:
                                                </div>
                                                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                                    {speaker.segments.slice(0, 3).map((segment: any, index: number) => (
                                                        <div key={segment.id} style={{
                                                            padding: '8px',
                                                            backgroundColor: 'white',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '4px',
                                                            marginBottom: '6px',
                                                            fontSize: '14px'
                                                        }}>
                                                            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
                                                                {formatDuration(Math.round(segment.start_time))} - {formatDuration(Math.round(segment.end_time))}
                                                            </div>
                                                            <div style={{ color: '#374151' }}>
                                                                "{segment.text}"
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {speaker.segments.length > 3 && (
                                                        <div style={{ 
                                                            textAlign: 'center', 
                                                            padding: '8px', 
                                                            color: '#6b7280', 
                                                            fontSize: '12px',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            ... and {speaker.segments.length - 3} more segments
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
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


