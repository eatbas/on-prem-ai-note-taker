import React, { useEffect, useMemo, useState } from 'react'
import { listMeetings, syncMeeting, watchOnline, deleteMeetingLocally, deleteAudioChunksLocally, getMeetings, getVpsHealth, updateMeeting, runVpsDiagnostics, quickVpsTest, VpsDiagnosticResult, deleteMeeting, db } from '../services'
import AskLlama from './AskLlama'

import { useToast } from '../components/common'
// import { createRippleEffect } from '../utils' // Not needed for current implementation

export default function Dashboard({ 
	onOpen, 
	refreshSignal,
	text,
	setText,
	tag,
	setTag,
	online,
	vpsUp,
	onTagsChange,
	isRecording,
	recordingMeetingId
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
	isRecording?: boolean;
	recordingMeetingId?: string | null;
}) {
	const [meetings, setMeetings] = useState<any[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const meetingsPerPage = 3  // Changed from 5 to 3 so you can see pagination with 4 meetings
	const [activeTab, setActiveTab] = useState<'local' | 'vps' | 'llama'>('local')
	const [vpsMeetings, setVpsMeetings] = useState<any[]>([])
	const [vpsLoading, setVpsLoading] = useState(false)
	const [vpsError, setVpsError] = useState<string | null>(null)
	const [sendingMeetings, setSendingMeetings] = useState<Set<string>>(new Set())
	const { showToast, ToastContainer } = useToast()
	
	// Context menu state
	const [contextMenu, setContextMenu] = useState<{
		visible: boolean;
		x: number;
		y: number;
		meetingId: string;
		meetingTitle: string;
	} | null>(null)

	// Context menu functions
	const handleContextMenu = (e: React.MouseEvent, meetingId: string, meetingTitle: string) => {
		e.preventDefault()
		e.stopPropagation()
		setContextMenu({
			visible: true,
			x: e.clientX,
			y: e.clientY,
			meetingId,
			meetingTitle
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
	const handleRenameMeeting = async (meetingId: string) => {
		const meeting = meetings.find(m => m.id === meetingId)
		if (!meeting) return
		
		const newTitle = window.prompt('Enter new meeting title:', meeting.title)
		if (newTitle && newTitle.trim() && newTitle.trim() !== meeting.title) {
			try {
				await updateMeeting(meetingId, newTitle.trim())
				// Update local database as well
				await db.meetings.update(meetingId, { title: newTitle.trim(), updatedAt: Date.now() })
				showToast('Meeting renamed successfully! ✏️', 'success')
				refresh() // Refresh the list
			} catch (err) {
				console.error('Failed to rename meeting:', err)
				showToast('Failed to rename meeting. Please try again.', 'error')
			}
		}
		closeContextMenu()
	}

	const handleDeleteAudio = async (meetingId: string) => {
		if (!window.confirm('Are you sure you want to delete the audio for this meeting? The meeting notes, summary, and transcript will be preserved.')) {
			closeContextMenu()
			return
		}

		try {
			await deleteAudioChunksLocally(meetingId)
			showToast('Audio deleted successfully! 🗑️', 'success')
			refresh() // Refresh the list
		} catch (err) {
			console.error('Failed to delete audio:', err)
			showToast('Failed to delete audio. Please try again.', 'error')
		}
		closeContextMenu()
	}

	const handleDeleteMeeting = async (meetingId: string) => {
		const meeting = meetings.find(m => m.id === meetingId)
		if (!meeting) return

		if (!window.confirm(`Are you sure you want to permanently delete "${meeting.title}"? This will remove all data including audio, transcript, summary, and notes both locally and from the server.`)) {
			closeContextMenu()
			return
		}

		try {
			// Delete from VPS if the meeting was sent
			if (meeting.status === 'sent') {
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
			showToast('Meeting deleted completely! 🗑️', 'success')
			refresh() // Refresh the list
		} catch (err) {
			console.error('Failed to delete meeting:', err)
			showToast('Failed to delete meeting. Please try again.', 'error')
		}
		closeContextMenu()
	}

	async function refresh() {
		console.log('🔄 Dashboard refresh started')
		setLoading(true)
		setError(null)
		try {
			if (online) {
				// Always load local meetings first so user sees something immediately
				const localMeetings = await listMeetings({ text, tag, excludeRecordingInProgress: true })
				console.log('📁 Loaded local meetings:', localMeetings.length)
				setMeetings(localMeetings)
				
				// Try to fetch from backend and merge
				try {
					console.log('🌐 Attempting to fetch from VPS backend...')
					const backendMeetings = await getMeetings()
					console.log('☁️ Loaded VPS meetings:', backendMeetings.length)
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
					const mergedMeetings = Array.from(byId.values()).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
					console.log('🔄 Merged meetings:', mergedMeetings.length)
					setMeetings(mergedMeetings)
				} catch (backendErr) {
					// Backend failed, but we still have local data
					console.warn('❌ Backend fetch failed, using local data:', backendErr)
					setError(`Backend connection failed: ${backendErr instanceof Error ? backendErr.message : 'Unknown error'}. Showing local meetings only.`)
				}
			} else {
				// Use local data when offline
				console.log('📱 Offline mode - using local data only')
				setMeetings(await listMeetings({ text, tag, excludeRecordingInProgress: true }))
			}
		} catch (err) {
			console.error('❌ Failed to load meetings:', err)
			setError(`Failed to load meetings: ${err instanceof Error ? err.message : 'Unknown error'}`)
			// Try to load any local data as last resort
			try {
				setMeetings(await listMeetings({ text, tag, excludeRecordingInProgress: true }))
			} catch (localErr) {
				console.error('❌ Even local data failed:', localErr)
				setMeetings([])
			}
		} finally {
			setLoading(false)
			console.log('✅ Dashboard refresh completed')
		}
	}

	async function clearAllLocalData() {
		// Ask for confirmation before clearing all data
		const confirmed = window.confirm(
			'⚠️ WARNING: This will permanently delete ALL local data including:\n\n' +
			'• All recorded meetings\n' +
			'• All audio chunks\n' +
			'• All transcripts and summaries\n' +
			'• All local settings and preferences\n\n' +
			'This action cannot be undone!\n\n' +
			'Are you sure you want to continue?'
		)
		
		if (!confirmed) {
			console.log('🗑️ Data clearing cancelled by user')
			return
		}
		
		console.log('🗑️ Clearing all local data...')
		setLoading(true)
		
		try {
			// Clear IndexedDB - delete and recreate the database
			try {
				await db.delete()
				console.log('🗑️ IndexedDB deleted')
			} catch (dbError) {
				console.log('🗑️ IndexedDB delete failed, trying to clear tables instead:', dbError)
				// Fallback: clear all tables individually
				await db.meetings.clear()
				await db.chunks.clear()
				await db.notes.clear()
				console.log('🗑️ IndexedDB tables cleared')
			}
			
			// Recreate the database if it was deleted
			try {
				await db.open()
				console.log('🗑️ IndexedDB recreated/opened')
			} catch (openError) {
				console.log('🗑️ IndexedDB open failed, will be recreated on next use:', openError)
			}
			
			// Clear localStorage
			localStorage.clear()
			console.log('🗑️ localStorage cleared')
			
			// Clear sessionStorage
			sessionStorage.clear()
			console.log('🗑️ sessionStorage cleared')
			
			// Clear any recording states
			if (typeof window !== 'undefined' && (window as any).globalRecordingManager) {
				(window as any).globalRecordingManager.clearInterruptedState()
				console.log('🗑️ Recording states cleared')
			}
			
			// Reset local state
			setMeetings([])
			setVpsMeetings([])
			setError(null)
			setVpsError(null)
			
			showToast('All local data cleared successfully! 🗑️', 'success')
			console.log('✅ All local data cleared')
			
		} catch (err) {
			console.error('❌ Failed to clear local data:', err)
			showToast('Failed to clear some local data. Please try again.', 'error')
		} finally {
			setLoading(false)
		}
	}

	async function refreshVpsMeetings() {
		if (!online || !vpsUp) return
		
		setVpsLoading(true)
		setVpsError(null)
		try {
			const vpsMeetingsData = await getMeetings()
			setVpsMeetings(vpsMeetingsData)
		} catch (err) {
			console.error('Failed to load VPS meetings:', err)
			setVpsError(`Failed to load VPS meetings: ${err instanceof Error ? err.message : 'Unknown error'}`)
		} finally {
			setVpsLoading(false)
		}
	}

	async function checkBackendStatus() {
		try {
			setLoading(true)
			const health = await getVpsHealth()
			showToast(`Backend is healthy! 🟢 Whisper: ${health.whisper_model}, Ollama: ${health.ollama_model}`, 'success')
		} catch (err) {
			console.error('Backend health check failed:', err)
			const errorMessage = err instanceof Error ? err.message : 'Unknown error'
			
			if (errorMessage.includes('Failed to fetch') || errorMessage.includes('fetch')) {
				showToast('❌ Cannot connect to backend server. Check if the backend is running.', 'error')
			} else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
				showToast('❌ Authentication failed. Check your credentials.', 'error')
			} else if (errorMessage.includes('500')) {
				showToast('❌ Backend server error. The AI services may be having issues.', 'error')
			} else {
				showToast(`❌ Backend check failed: ${errorMessage}`, 'error')
			}
		} finally {
			setLoading(false)
		}
	}

	async function runFullVpsDiagnostics() {
		try {
			setLoading(true)
			showToast('🔍 Running comprehensive VPS diagnostics...', 'info')
			
			const results = await runVpsDiagnostics()
			
			// Show summary toast
			const successCount = results.filter(r => r.status === 'pass').length
			const errorCount = results.filter(r => r.status === 'fail').length
			
			if (errorCount === 0) {
				showToast(`✅ All VPS tests passed! (${successCount} successful)`, 'success')
			} else {
				showToast(`❌ VPS diagnostics found ${errorCount} issues. Check details below.`, 'error')
			}
			
			// Store results for display - moved to admin dashboard
			// setVpsDiagnosticResults(results)
			// setShowVpsDiagnostics(true)
			
		} catch (err) {
			console.error('VPS diagnostics failed:', err)
			showToast(`❌ Diagnostics failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
		} finally {
			setLoading(false)
		}
	}

	async function quickVpsConnectionTest() {
		try {
			setLoading(true)
			showToast('🧪 Running quick VPS connection test...', 'info')
			
			const result = await quickVpsTest()
			
			if (result.success) {
				showToast(result.message, 'success')
			} else {
				showToast(result.message, 'error')
			}
			
			// Store result for display - moved to admin dashboard
			// setQuickTestResult(result)
			// setShowQuickTest(true)
			
		} catch (err) {
			console.error('Quick VPS test failed:', err)
			showToast(`❌ Quick test failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
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
			console.log('🔄 Dashboard refresh triggered by signal:', refreshSignal)
			refresh()
			// Go to first page when new meetings are added
			setCurrentPage(1)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refreshSignal])

	// Refresh VPS meetings when VPS tab is selected or VPS status changes
	useEffect(() => {
		if (activeTab === 'vps' && vpsUp && online) {
			refreshVpsMeetings()
		}
	}, [activeTab, vpsUp, online])

	async function retry(meetingId: string) {
		try {
			setError(null)
			// Add loading state for this specific meeting
			setSendingMeetings(prev => new Set(prev).add(meetingId))
			await syncMeeting(meetingId)
			await refresh()
			showToast('Meeting sent successfully! 🎉', 'success')
		} catch (err) {
			console.error('Retry failed:', err)
			const errorMessage = err instanceof Error ? err.message : 'Unknown error'
			setError(`Failed to send meeting: ${errorMessage}`)
			
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
			// Remove loading state
			setSendingMeetings(prev => {
				const newSet = new Set(prev)
				newSet.delete(meetingId)
				return newSet
			})
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
					fontSize: '14px',
					transition: 'all 0.2s ease',
					transform: 'scale(1)'
				}}
				onMouseDown={(e) => {
					if (currentPage !== 1) {
						e.currentTarget.style.transform = 'scale(0.95)'
						e.currentTarget.style.backgroundColor = '#e5e7eb'
					}
				}}
				onMouseUp={(e) => {
					if (currentPage !== 1) {
						e.currentTarget.style.transform = 'scale(1)'
						e.currentTarget.style.backgroundColor = 'white'
					}
				}}
				onMouseLeave={(e) => {
					if (currentPage !== 1) {
						e.currentTarget.style.transform = 'scale(1)'
						e.currentTarget.style.backgroundColor = 'white'
					}
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
					fontSize: '14px',
					transition: 'all 0.2s ease',
					transform: 'scale(1)'
				}}
				onMouseDown={(e) => {
					if (currentPage !== totalPages) {
						e.currentTarget.style.transform = 'scale(0.95)'
						e.currentTarget.style.backgroundColor = '#e5e7eb'
					}
				}}
				onMouseUp={(e) => {
					if (currentPage !== totalPages) {
						e.currentTarget.style.transform = 'scale(1)'
						e.currentTarget.style.backgroundColor = 'white'
					}
				}}
				onMouseLeave={(e) => {
					if (currentPage !== totalPages) {
						e.currentTarget.style.transform = 'scale(1)'
						e.currentTarget.style.backgroundColor = 'white'
					}
				}}
			>
				Next →
			</button>
		</div>
	)

	return (
		<div>
			{/* Toast Container */}
			<ToastContainer />

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
			
			{/* Tabs */}
			<div style={{
				display: 'flex',
				borderBottom: '2px solid #e2e8f0',
				marginBottom: '24px',
				backgroundColor: 'white',
				borderRadius: '8px 8px 0 0',
				overflow: 'hidden'
			}}>
				{[
					{ id: 'local', label: '📁 Local Meetings', icon: '🏠' },
					{ id: 'vps', label: '☁️ VPS Meetings', icon: '🌐' },
					{ id: 'llama', label: '🤖 Ask AI Assistant', icon: '💬' }
				].map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id as 'local' | 'vps' | 'llama')}
						style={{
							flex: 1,
							padding: '16px 24px',
							backgroundColor: activeTab === tab.id ? '#3b82f6' : '#f8fafc',
							color: activeTab === tab.id ? 'white' : '#64748b',
							border: 'none',
							fontSize: '16px',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '8px',
							borderRight: '1px solid #e2e8f0',
							transform: 'scale(1)'
						}}
						onMouseEnter={(e) => {
							if (activeTab !== tab.id) {
								e.currentTarget.style.backgroundColor = '#e2e8f0'
							}
						}}
						onMouseLeave={(e) => {
							if (activeTab !== tab.id) {
								e.currentTarget.style.backgroundColor = '#f8fafc'
							}
						}}
						onMouseDown={(e) => {
							e.currentTarget.style.transform = 'scale(0.98)'
						}}
						onMouseUp={(e) => {
							e.currentTarget.style.transform = 'scale(1)'
						}}
					>
						<span style={{ fontSize: '18px' }}>{tab.icon}</span>
						{tab.label}
					</button>
				))}
			</div>

			{/* Admin controls moved to Admin Dashboard */}

			{/* Quick Test Results moved to Admin Dashboard */}

			{/* Diagnostic Results moved to Admin Dashboard */}

			{/* Tab Content */}
			{activeTab === 'llama' && (
				<AskLlama online={online} vpsUp={vpsUp} />
			)}
			
			{/* Job Queue moved to Admin Dashboard */}

			{activeTab === 'local' && (
				<>
					{loading && (
						<div style={{ textAlign: 'center', padding: 20 }}>
							Loading local meetings...
						</div>
					)}
					
					{!loading && meetings.length === 0 && (
						<div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>
							No local meetings found. Start recording to create your first meeting!
						</div>
					)}

					{/* Recording in progress indicator - Removed as requested */}

					{/* Local meetings list */}
					<ul style={{ listStyle: 'none', padding: 0 }}>
						{currentMeetings.map(m => (
							<li key={m.id} 
								onClick={() => onOpen(m.id)}
								onContextMenu={(e) => handleContextMenu(e, m.id, m.title)}
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
											createRippleEffect(e)
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
											fontWeight: '500',
											transition: 'all 0.2s ease',
											transform: 'scale(1)'
										}}
										onMouseDown={(e) => {
											e.currentTarget.style.transform = 'scale(0.95)'
											e.currentTarget.style.backgroundColor = '#2563eb'
										}}
										onMouseUp={(e) => {
											e.currentTarget.style.transform = 'scale(1)'
											e.currentTarget.style.backgroundColor = '#3b82f6'
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.transform = 'scale(1)'
											e.currentTarget.style.backgroundColor = '#3b82f6'
										}}
									>
										📄 Open
									</button>
									{m.status !== 'sent' && (
										<button 
											onClick={(e) => {
												createRippleEffect(e)
												e.stopPropagation()
												retry(m.id)
											}} 
											disabled={!online || sendingMeetings.has(m.id)} 
											style={{ 
												padding: '8px 16px',
												backgroundColor: sendingMeetings.has(m.id) ? '#9ca3af' : '#10b981',
												color: 'white',
												border: 'none',
												borderRadius: '4px',
												cursor: (online && !sendingMeetings.has(m.id)) ? 'pointer' : 'not-allowed',
												fontWeight: '500',
												opacity: online ? 1 : 0.6,
												transition: 'all 0.2s ease',
												transform: 'scale(1)',
												minWidth: '80px'
											}}
											onMouseDown={(e) => {
												if (online && !sendingMeetings.has(m.id)) {
													e.currentTarget.style.transform = 'scale(0.95)'
													e.currentTarget.style.backgroundColor = '#059669'
												}
											}}
											onMouseUp={(e) => {
												if (online && !sendingMeetings.has(m.id)) {
													e.currentTarget.style.transform = 'scale(1)'
													e.currentTarget.style.backgroundColor = '#10b981'
												}
											}}
											onMouseLeave={(e) => {
												if (online && !sendingMeetings.has(m.id)) {
													e.currentTarget.style.transform = 'scale(1)'
													e.currentTarget.style.backgroundColor = '#10b981'
												}
											}}
										>
											{sendingMeetings.has(m.id) ? '⏳ Sending...' : '📤 Send'}
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
											fontSize: '12px',
											transition: 'all 0.2s ease',
											transform: 'scale(1)'
										}}
										onMouseDown={(e) => {
											if (currentPage !== 1) {
												e.currentTarget.style.transform = 'scale(0.95)'
												e.currentTarget.style.backgroundColor = '#e5e7eb'
											}
										}}
										onMouseUp={(e) => {
											if (currentPage !== 1) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
										}}
										onMouseLeave={(e) => {
											if (currentPage !== 1) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
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
											fontSize: '12px',
											transition: 'all 0.2s ease',
											transform: 'scale(1)'
										}}
										onMouseDown={(e) => {
											if (currentPage !== 1) {
												e.currentTarget.style.transform = 'scale(0.95)'
												e.currentTarget.style.backgroundColor = '#e5e7eb'
											}
										}}
										onMouseUp={(e) => {
											if (currentPage !== 1) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
										}}
										onMouseLeave={(e) => {
											if (currentPage !== 1) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
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
											fontSize: '12px',
											transition: 'all 0.2s ease',
											transform: 'scale(1)'
										}}
										onMouseDown={(e) => {
											if (currentPage !== totalPages) {
												e.currentTarget.style.transform = 'scale(0.95)'
												e.currentTarget.style.backgroundColor = '#e5e7eb'
											}
										}}
										onMouseUp={(e) => {
											if (currentPage !== totalPages) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
										}}
										onMouseLeave={(e) => {
											if (currentPage !== totalPages) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
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
											fontSize: '12px',
											transition: 'all 0.2s ease',
											transform: 'scale(1)'
										}}
										onMouseDown={(e) => {
											if (currentPage !== totalPages) {
												e.currentTarget.style.transform = 'scale(0.95)'
												e.currentTarget.style.backgroundColor = '#e5e7eb'
											}
										}}
										onMouseUp={(e) => {
											if (currentPage !== totalPages) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
										}}
										onMouseLeave={(e) => {
											if (currentPage !== totalPages) {
												e.currentTarget.style.transform = 'scale(1)'
												e.currentTarget.style.backgroundColor = 'white'
											}
										}}
									>
										Last ⏭️
									</button>
								</div>
							)}
						</div>
					)}
				</>
			)}

			{activeTab === 'vps' && (
				<div style={{ padding: '24px 0' }}>
					<div style={{ 
						textAlign: 'center', 
						marginBottom: '32px',
						padding: '24px',
						backgroundColor: '#f8fafc',
						borderRadius: '12px',
						border: '2px solid #e2e8f0'
					}}>
						<h2 style={{
							margin: '0 0 16px 0',
							fontSize: '1.8rem',
							fontWeight: '600',
							color: '#1e293b'
						}}>
							☁️ VPS Meetings
						</h2>
						<p style={{
							margin: '0',
							fontSize: '1.1rem',
							color: '#64748b',
							lineHeight: '1.6'
						}}>
							Meetings stored on the VPS server. These are synced from your local recordings.
						</p>
						
						{/* VPS Status */}
						<div style={{
							display: 'flex',
							justifyContent: 'center',
							gap: '16px',
							marginTop: '16px'
						}}>
							<span style={{ 
								fontSize: '14px', 
								fontWeight: '500',
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 16px',
								backgroundColor: vpsUp ? '#dcfce7' : vpsUp === null ? '#fef3c7' : '#fee2e2',
								color: vpsUp ? '#166534' : vpsUp === null ? '#92400e' : '#dc2626',
								borderRadius: '8px',
								border: `1px solid ${vpsUp ? '#bbf7d0' : vpsUp === null ? '#fde68a' : '#fecaca'}`
							}}>
								{vpsUp === null ? '⏳' : vpsUp ? '🟢' : '🔴'} VPS {vpsUp === null ? 'Checking...' : vpsUp ? 'Connected' : 'Disconnected'}
							</span>
						</div>
					</div>

					{/* VPS Error */}
					{vpsError && (
						<div style={{ 
							padding: 12, 
							backgroundColor: '#fee', 
							border: '1px solid #fcc',
							borderRadius: 4,
							marginBottom: 16 
						}}>
							⚠️ {vpsError}
						</div>
					)}

					{/* VPS Loading */}
					{vpsLoading && (
						<div style={{ textAlign: 'center', padding: 20 }}>
							Loading VPS meetings...
						</div>
					)}

					{/* VPS meetings list */}
					{!vpsLoading && vpsMeetings.length > 0 && (
						<ul style={{ listStyle: 'none', padding: 0 }}>
							{vpsMeetings.map(m => (
								<li key={m.id} 
									onClick={() => onOpen(m.id)}
									onContextMenu={(e) => handleContextMenu(e, m.id, m.title)}
									style={{ 
										display: 'flex', 
										gap: 12, 
										padding: 16, 
										borderBottom: '1px solid #eee',
										backgroundColor: '#f0f9ff',
										marginBottom: 8,
										borderRadius: 4,
										cursor: 'pointer',
										transition: 'all 0.2s ease',
										border: '1px solid #0ea5e9',
										position: 'relative'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = '#e0f2fe'
										e.currentTarget.style.transform = 'translateY(-1px)'
										e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = '#f0f9ff'
										e.currentTarget.style.transform = 'translateY(0)'
										e.currentTarget.style.boxShadow = 'none'
									}}
								>
									<div style={{ flex: 1 }}>
										<div style={{ 
											display: 'flex', 
											alignItems: 'center', 
											gap: '8px',
											marginBottom: 4 
										}}>
											<div style={{ fontWeight: 600, fontSize: 18, color: '#0c4a6e' }}>
												{m.title || 'Untitled Meeting'}
											</div>
											<span style={{ 
												fontSize: '12px', 
												color: '#0c4a6e',
												opacity: 0.7,
												fontStyle: 'italic'
											}}>
												☁️ VPS Meeting
											</span>
										</div>
										<div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8, color: '#0c4a6e' }}>
											📅 {new Date(m.created_at || m.createdAt).toLocaleString()}
											{m.duration && (
												<span style={{ 
													backgroundColor: '#0ea5e9', 
													padding: '2px 6px', 
													borderRadius: '10px',
													marginLeft: '8px',
													fontWeight: '500',
													color: 'white'
												}}>
													⏱️ {Math.round(m.duration / 60)} min
												</span>
											)}
										</div>
										{m.summary && (
											<div style={{ 
												fontSize: 14, 
												opacity: 0.9, 
												backgroundColor: 'white',
												padding: 8,
												borderRadius: 4,
												marginTop: 8,
												border: '1px solid #0ea5e9',
												color: '#0c4a6e'
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
												backgroundColor: '#0ea5e9',
												color: 'white',
												border: 'none',
												borderRadius: '4px',
												cursor: 'pointer',
												fontWeight: '500'
											}}
										>
											📄 Open
										</button>
									</div>
								</li>
							))}
						</ul>
					)}

					{/* VPS meetings empty state */}
					{!vpsLoading && vpsMeetings.length === 0 && vpsUp && (
						<div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>
							No VPS meetings found. Local meetings will be synced to the VPS when you record them.
						</div>
					)}

					{/* VPS connection down */}
					{!vpsUp && (
						<div style={{
							padding: '20px',
							backgroundColor: '#fef3c7',
							border: '1px solid #fde68a',
							borderRadius: '8px',
							textAlign: 'center',
							color: '#92400e'
						}}>
							<p style={{ margin: '0 0 12px 0', fontWeight: '500' }}>
								🔴 VPS connection is down
							</p>
							<p style={{ margin: '0', fontSize: '14px' }}>
								Please check your VPS connection or contact your administrator to view VPS meetings.
							</p>
						</div>
					)}

					{/* VPS connected but offline */}
					{vpsUp && !online && (
						<div style={{
							padding: '20px',
							backgroundColor: '#fef3c7',
							border: '1px solid #fde68a',
							borderRadius: '8px',
							textAlign: 'center',
							color: '#92400e'
						}}>
							<p style={{ margin: '0 0 12px 0', fontWeight: '500' }}>
								🔴 You are currently offline
							</p>
							<p style={{ margin: '0', fontSize: '14px' }}>
								Please check your internet connection to view VPS meetings.
							</p>
						</div>
					)}

					{/* Refresh button for VPS meetings */}
					{vpsUp && online && (
						<div style={{
							display: 'flex',
							justifyContent: 'center',
							marginTop: '24px'
						}}>
							<button
								onClick={refreshVpsMeetings}
								disabled={vpsLoading}
								style={{
									padding: '12px 24px',
									backgroundColor: vpsLoading ? '#9ca3af' : '#0ea5e9',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '600',
									cursor: vpsLoading ? 'not-allowed' : 'pointer',
									transition: 'all 0.2s ease',
									transform: 'scale(1)'
								}}
								onMouseEnter={(e) => {
									if (!vpsLoading) {
										e.currentTarget.style.backgroundColor = '#0284c7'
									}
								}}
								onMouseLeave={(e) => {
									if (!vpsLoading) {
										e.currentTarget.style.backgroundColor = '#0ea5e9'
									}
								}}
								onMouseDown={(e) => {
									if (!vpsLoading) {
										e.currentTarget.style.transform = 'scale(0.95)'
										e.currentTarget.style.backgroundColor = '#0369a1'
									}
								}}
								onMouseUp={(e) => {
									if (!vpsLoading) {
										e.currentTarget.style.transform = 'scale(1)'
										e.currentTarget.style.backgroundColor = '#0ea5e9'
									}
								}}
							>
								{vpsLoading ? '🔄 Refreshing...' : '🔄 Refresh VPS Meetings'}
							</button>
						</div>
					)}
				</div>
			)}

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
							onClick={() => handleRenameMeeting(contextMenu.meetingId)}
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
							<span>Rename</span>
						</div>
						
						<div
							onClick={() => handleDeleteAudio(contextMenu.meetingId)}
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
							onClick={() => handleDeleteMeeting(contextMenu.meetingId)}
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

function InlineEditableTitle({ id, title, onSaved }: { id: string; title: string; onSaved: () => void }) {
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
                    fontSize: 18, 
                    fontWeight: 600, 
                    width: '100%', 
                    padding: 4,
                    border: '2px solid #3b82f6',
                    borderRadius: '4px',
                    outline: 'none',
                    backgroundColor: '#f0f9ff'
                }}
            />
        )
    }
    return (
        <span 
            onClick={() => setEditing(true)} 
            style={{ 
                cursor: 'text',
                padding: '2px 4px',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
                backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
            }}
        >
            {title}
        </span>
    )
}


