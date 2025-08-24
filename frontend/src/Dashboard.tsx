import { useEffect, useMemo, useState } from 'react'
import { listMeetings, syncMeeting, watchOnline } from './offline'
import { getMeetings, getVpsHealth, updateMeeting, runVpsDiagnostics, quickVpsTest, VpsDiagnosticResult } from './api'
import { db } from './db'
import AskLlama from './AskLlama'
import JobQueue from './JobQueue'
import { useToast } from './Toast'
import { createRippleEffect } from './utils'

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
	const [activeTab, setActiveTab] = useState<'local' | 'vps' | 'llama' | 'jobs'>('local')
	const [vpsMeetings, setVpsMeetings] = useState<any[]>([])
	const [vpsLoading, setVpsLoading] = useState(false)
	const [vpsError, setVpsError] = useState<string | null>(null)
	const [sendingMeetings, setSendingMeetings] = useState<Set<string>>(new Set())
	const { showToast, ToastContainer } = useToast()
	const [vpsDiagnosticResults, setVpsDiagnosticResults] = useState<VpsDiagnosticResult[]>([])
	const [showVpsDiagnostics, setShowVpsDiagnostics] = useState(false)
	const [quickTestResult, setQuickTestResult] = useState<any>(null)
	const [showQuickTest, setShowQuickTest] = useState(false)

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
			const successCount = results.filter(r => r.status === 'success').length
			const errorCount = results.filter(r => r.status === 'error').length
			
			if (errorCount === 0) {
				showToast(`✅ All VPS tests passed! (${successCount} successful)`, 'success')
			} else {
				showToast(`❌ VPS diagnostics found ${errorCount} issues. Check details below.`, 'error')
			}
			
			// Store results for display
			setVpsDiagnosticResults(results)
			setShowVpsDiagnostics(true)
			
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
			
			// Store result for display
			setQuickTestResult(result)
			setShowQuickTest(true)
			
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
					{ id: 'llama', label: '🤖 Ask AI Assistant', icon: '💬' },
					{ id: 'jobs', label: '📋 Job Queue', icon: '⚙️' }
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
							borderRight: tab.id !== 'jobs' ? '1px solid #e2e8f0' : 'none',
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

			{/* Backend Status Check */}
			{online && (
				<div style={{
					display: 'flex',
					justifyContent: 'center',
					marginBottom: '16px',
					padding: '12px',
					backgroundColor: '#f8fafc',
					borderRadius: '8px',
					border: '1px solid #e2e8f0'
				}}>
					<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
						<button
							onClick={(e) => {
								createRippleEffect(e)
								checkBackendStatus()
							}}
							disabled={loading}
							style={{
								padding: '8px 16px',
								backgroundColor: loading ? '#9ca3af' : '#10b981',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: loading ? 'not-allowed' : 'pointer',
								fontSize: '14px',
								fontWeight: '500',
								transition: 'all 0.2s ease',
								transform: 'scale(1)'
							}}
							onMouseDown={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(0.95)'
									e.currentTarget.style.backgroundColor = '#059669'
								}
							}}
							onMouseUp={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#10b981'
								}
							}}
							onMouseLeave={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#10b981'
								}
							}}
						>
							{loading ? '🔍 Checking...' : '🔍 Check Backend Status'}
						</button>
						
						<button
							onClick={(e) => {
								createRippleEffect(e)
								quickVpsConnectionTest()
							}}
							disabled={loading}
							style={{
								padding: '8px 16px',
								backgroundColor: loading ? '#9ca3af' : '#3b82f6',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: loading ? 'not-allowed' : 'pointer',
								fontSize: '14px',
								fontWeight: '500',
								transition: 'all 0.2s ease',
								transform: 'scale(1)'
							}}
							onMouseDown={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(0.95)'
									e.currentTarget.style.backgroundColor = '#2563eb'
								}
							}}
							onMouseUp={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#3b82f6'
								}
							}}
							onMouseLeave={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#3b82f6'
								}
							}}
						>
							{loading ? '🧪 Testing...' : '🧪 Quick VPS Test'}
						</button>
						
						<button
							onClick={(e) => {
								createRippleEffect(e)
								runFullVpsDiagnostics()
							}}
							disabled={loading}
							style={{
								padding: '8px 16px',
								backgroundColor: loading ? '#9ca3af' : '#8b5cf6',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: loading ? 'not-allowed' : 'pointer',
								fontSize: '14px',
								fontWeight: '500',
								transition: 'all 0.2s ease',
								transform: 'scale(1)'
							}}
							onMouseDown={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(0.95)'
									e.currentTarget.style.backgroundColor = '#7c3aed'
								}
							}}
							onMouseUp={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#8b5cf6'
								}
							}}
							onMouseLeave={(e) => {
								if (!loading) {
									e.currentTarget.style.transform = 'scale(1)'
									e.currentTarget.style.backgroundColor = '#8b5cf6'
								}
							}}
						>
							{loading ? '🔬 Running...' : '🔬 Full VPS Diagnostics'}
						</button>
					</div>
					
					<span style={{ 
						marginLeft: '12px', 
						fontSize: '14px', 
						color: '#6b7280',
						display: 'flex',
						alignItems: 'center',
						gap: '8px'
					}}>
						<span style={{ 
							width: '8px', 
							height: '8px', 
							borderRadius: '50%', 
							backgroundColor: online ? '#10b981' : '#ef4444' 
						}}></span>
						{online ? 'Online' : 'Offline'}
					</span>
				</div>
			)}

			{/* Quick Test Results */}
			{showQuickTest && quickTestResult && (
				<div style={{
					marginBottom: '16px',
					padding: '16px',
					backgroundColor: quickTestResult.success ? '#f0fdf4' : '#fef2f2',
					border: `1px solid ${quickTestResult.success ? '#bbf7d0' : '#fecaca'}`,
					borderRadius: '8px'
				}}>
					<div style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '8px'
					}}>
						<h4 style={{ margin: 0, color: quickTestResult.success ? '#166534' : '#dc2626' }}>
							🧪 Quick VPS Test Result
						</h4>
						<button
							onClick={() => setShowQuickTest(false)}
							style={{
								background: 'none',
								border: 'none',
								fontSize: '18px',
								cursor: 'pointer',
								color: '#6b7280'
							}}
						>
							✕
						</button>
					</div>
					<p style={{ margin: 0, color: quickTestResult.success ? '#166534' : '#dc2626' }}>
						{quickTestResult.message}
					</p>
					{quickTestResult.details && (
						<details style={{ marginTop: '8px' }}>
							<summary style={{ cursor: 'pointer', color: '#6b7280' }}>View Details</summary>
							<pre style={{ 
								margin: '8px 0 0 0', 
								padding: '8px', 
								backgroundColor: 'rgba(0,0,0,0.05)', 
								borderRadius: '4px',
								fontSize: '12px',
								overflow: 'auto'
							}}>
								{JSON.stringify(quickTestResult.details, null, 2)}
							</pre>
						</details>
					)}
				</div>
			)}

			{/* Full Diagnostic Results */}
			{showVpsDiagnostics && vpsDiagnosticResults.length > 0 && (
				<div style={{
					marginBottom: '16px',
					padding: '16px',
					backgroundColor: '#f8fafc',
					border: '1px solid #e2e8f0',
					borderRadius: '8px'
				}}>
					<div style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '16px'
					}}>
						<h4 style={{ margin: 0, color: '#1e293b' }}>
							🔬 VPS Diagnostic Results
						</h4>
						<button
							onClick={() => setShowVpsDiagnostics(false)}
							style={{
								background: 'none',
								border: 'none',
								fontSize: '18px',
								cursor: 'pointer',
								color: '#6b7280'
							}}
						>
							✕
						</button>
					</div>
					
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{vpsDiagnosticResults.map((result, index) => (
							<div key={index} style={{
								padding: '12px',
								backgroundColor: result.status === 'success' ? '#f0fdf4' : 
												result.status === 'warning' ? '#fef3c7' : '#fef2f2',
								border: `1px solid ${result.status === 'success' ? '#bbf7d0' : 
													result.status === 'warning' ? '#fde68a' : '#fecaca'}`,
								borderRadius: '6px'
							}}>
								<div style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: '4px'
								}}>
									<strong style={{ 
										color: result.status === 'success' ? '#166534' : 
												result.status === 'warning' ? '#92400e' : '#dc2626'
									}}>
										{result.step}
									</strong>
									{result.responseTime && (
										<span style={{ 
											fontSize: '12px', 
											color: '#6b7280',
											backgroundColor: 'rgba(0,0,0,0.05)',
											padding: '2px 6px',
											borderRadius: '4px'
										}}>
											{result.responseTime}ms
										</span>
									)}
								</div>
								<p style={{ 
									margin: 0, 
									color: result.status === 'success' ? '#166534' : 
											result.status === 'warning' ? '#92400e' : '#dc2626'
								}}>
									{result.message}
								</p>
								{result.details && (
									<details style={{ marginTop: '8px' }}>
										<summary style={{ cursor: 'pointer', color: '#6b7280' }}>View Details</summary>
										<pre style={{ 
											margin: '8px 0 0 0', 
											padding: '8px', 
											backgroundColor: 'rgba(0,0,0,0.05)', 
											borderRadius: '4px',
											fontSize: '12px',
											overflow: 'auto'
										}}>
											{JSON.stringify(result.details, null, 2)}
										</pre>
									</details>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Tab Content */}
			{activeTab === 'llama' && (
				<AskLlama online={online} vpsUp={vpsUp} />
			)}
			
			{activeTab === 'jobs' && (
				<JobQueue online={online} vpsUp={vpsUp} />
			)}

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

					{/* Local meetings list */}
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


