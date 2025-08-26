import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Dashboard, MeetingView, AdminDashboard } from './pages'
import { Recorder, FloatingRecorder } from './components/recording'
import { useToast } from './components/common'
import { watchOnline, getVpsHealth } from './services'
import { globalRecordingManager } from './stores/globalRecordingManager'
import { clearStuckRecordingState } from './utils/'

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')

function AppShell({ 
	text, setText, 
	tag, setTag, 
	online, vpsUp, setVpsUp,
	availableTags, setAvailableTags,
	refreshSignal, setRefreshSignal,
	isRecording, recordingMeetingId,
	onRecordingCreated, onRecordingStopped
}: {
	text: string
	setText: (text: string) => void
	tag: string
	setTag: (tag: string) => void
	online: boolean
	vpsUp: boolean | null
	setVpsUp: (vpsUp: boolean | null) => void
	availableTags: [string, number][]
	setAvailableTags: (tags: [string, number][]) => void
	refreshSignal: number
	setRefreshSignal: (signal: number) => void
	isRecording: boolean
	recordingMeetingId: string | null
	onRecordingCreated: (meetingId: string) => void
	onRecordingStopped: (meetingId: string) => void
}) {
	const navigate = useNavigate()
	const { ToastContainer } = useToast()

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
	}, [setVpsUp])

	return (
		<div style={{ 
			maxWidth: '100%', 
			margin: '0 auto', 
			padding: '24px',
			fontFamily: 'Inter, system-ui, Arial, sans-serif',
			minHeight: '100vh',
			backgroundColor: '#f8fafc'
		}}>
			<ToastContainer />
			{/* Sticky Search and Controls Bar - At the very top */}
			<div style={{ 
				position: 'sticky',
				top: 0,
				zIndex: 1000,
				backgroundColor: 'white',
				borderBottom: '1px solid #e2e8f0',
				padding: '4px 12px',
				marginBottom: '8px',
				boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
				borderRadius: '6px',
				maxWidth: 1200,
				margin: '0 auto 8px auto'
			}}>
				<div style={{ 
					display: 'flex', 
					gap: 8, 
					alignItems: 'center', 
					maxWidth: '1200px',
					margin: '0 auto',
					flexWrap: 'wrap',
					justifyContent: 'center'
				}}>
					<input 
						placeholder="Search title, summary, transcript" 
						value={text} 
						onChange={e => setText(e.target.value)}
						style={{ 
							flex: 1, 
							padding: '4px 8px',
							border: '1px solid #d1d5db',
							borderRadius: '4px',
							fontSize: '14px',
							minWidth: '200px'
						}}
					/>
					<select 
						value={tag} 
						onChange={e => setTag(e.target.value)} 
						style={{ 
							padding: '4px 8px',
							border: '1px solid #d1d5db',
							borderRadius: '4px',
							fontSize: '14px',
							minWidth: '100px'
						}}
					>
						<option value="">All tags</option>
						{availableTags.map(([tagName, count]) => (
							<option key={tagName} value={tagName}>
								{tagName} ({count})
							</option>
						))}
					</select>
					
					{/* Status Indicators */}
					<div style={{
						display: 'flex',
						gap: '6px',
						alignItems: 'center'
					}}>
						<span style={{ 
							fontSize: '14px', 
							fontWeight: '500',
							display: 'flex',
							alignItems: 'center',
							gap: '6px'
						}}>
							{online ? '🟢' : '🔴'} Online
						</span>
						<span 
							title="VPS connectivity" 
							style={{ 
								fontSize: '14px',
								fontWeight: '500',
								display: 'flex',
								alignItems: 'center',
								gap: '6px'
							}}
						>
							{vpsUp === null ? '⏳' : vpsUp ? '🟢' : '🔴'} VPS
						</span>
					</div>

					{/* Recording Control Buttons */}
					<div style={{
						display: 'flex',
						gap: '6px',
						alignItems: 'center'
					}}>
						<Recorder 
							onCreated={onRecordingCreated}
							onStopped={onRecordingStopped}
							text={text}
							setText={setText}
							tag={tag}
							setTag={setTag}
							online={online}
							vpsUp={vpsUp}
						/>
					</div>
				</div>
			</div>
			
			<div style={{
				maxWidth: 1200,
				margin: '0 auto',
				backgroundColor: 'white',
				borderRadius: '12px',
				boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
				padding: '32px',
				minHeight: 'calc(100vh - 48px)'
			}}>
				<header style={{
					textAlign: 'center',
					marginBottom: '32px',
					paddingBottom: '24px',
					borderBottom: '2px solid #e2e8f0'
				}}>
					<h1 style={{
						margin: 0,
						fontSize: '2.5rem',
						fontWeight: '700',
						color: '#1e293b',
						background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
						backgroundClip: 'text',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent'
					}}>
						On-Prem AI Note Taker
					</h1>
					<p style={{
						margin: '8px 0 0 0',
						fontSize: '1.1rem',
						color: '#64748b',
						fontWeight: '500'
					}}>
						Secure, local-first AI-powered meeting notes
					</p>
					
					{/* Admin Dashboard and Queue Links */}
					<div style={{
						marginTop: '16px',
						display: 'flex',
						justifyContent: 'center',
						gap: '12px'
					}}>
						<button
							onClick={() => navigate('/admin')}
							style={{
								padding: '8px 16px',
								backgroundColor: '#dc2626',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '600',
								cursor: 'pointer',
								transition: 'all 0.2s ease',
								display: 'flex',
								alignItems: 'center',
								gap: '8px'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#b91c1c'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = '#dc2626'
							}}
						>
							🛠️ Admin Dashboard
						</button>

					</div>
				</header>
				
				<div style={{ 
					margin: '32px 0',
					height: '1px',
					background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)'
				}} />
				
				<Dashboard 
					onOpen={(id) => navigate(`/meeting/${id}`)} 
					refreshSignal={refreshSignal}
					text={text}
					setText={setText}
					tag={tag}
					setTag={setTag}
					online={online}
					vpsUp={vpsUp}
					onTagsChange={setAvailableTags}
					isRecording={isRecording}
					recordingMeetingId={recordingMeetingId}
				/>
			</div>
		</div>
	)
}

function MeetingRoute({ 
	text, setText, 
	tag, setTag, 
	online, vpsUp, 
	availableTags,
	isRecording, recordingMeetingId
}: {
	text: string
	setText: (text: string) => void
	tag: string
	setTag: (tag: string) => void
	online: boolean
	vpsUp: boolean | null
	availableTags: [string, number][]
	isRecording: boolean
	recordingMeetingId: string | null
}) {
	const params = useParams()
	const navigate = useNavigate()
	const id = params.meetingId as string
	const { ToastContainer } = useToast()
	
	return (
		<div style={{ 
			maxWidth: '100%', 
			margin: '0 auto', 
			padding: '24px',
			fontFamily: 'Inter, system-ui, Arial, sans-serif',
			minHeight: '100vh',
			backgroundColor: '#f8fafc'
		}}>
			<ToastContainer />
			{/* Sticky Search and Controls Bar - At the very top */}
			<div style={{ 
				position: 'sticky',
				top: 0,
				zIndex: 1000,
				backgroundColor: 'white',
				borderBottom: '1px solid #e2e8f0',
				padding: '16px',
				marginBottom: '24px',
				boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
				borderRadius: '12px',
				maxWidth: 1200,
				margin: '0 auto 24px auto'
			}}>
				<div style={{ 
					display: 'flex', 
					gap: 12, 
					alignItems: 'center', 
					maxWidth: '1200px',
					margin: '0 auto',
					flexWrap: 'wrap',
					justifyContent: 'center'
				}}>
					<input 
						placeholder="Search title, summary, transcript" 
						value={text} 
						onChange={e => setText(e.target.value)}
						style={{ 
							flex: 1, 
							padding: '8px 12px',
							border: '1px solid #d1d5db',
							borderRadius: '6px',
							fontSize: '14px',
							maxWidth: '400px',
							minWidth: '300px'
						}}
					/>
					<select 
						value={tag} 
						onChange={e => setTag(e.target.value)} 
						style={{ 
							padding: '8px 12px',
							border: '1px solid #d1d5db',
							borderRadius: '6px',
							fontSize: '14px',
							minWidth: '120px'
						}}
					>
						<option value="">All tags</option>
						{availableTags.map(([tagName, count]) => (
							<option key={tagName} value={tagName}>
								{tagName} ({count})
							</option>
						))}
					</select>
					
					{/* Status Indicators */}
					<div style={{
						display: 'flex',
						gap: '8px',
						alignItems: 'center'
					}}>
						<span style={{ 
							fontSize: '14px', 
							fontWeight: '500',
							display: 'flex',
							alignItems: 'center',
							gap: '8px'
						}}>
							{online ? '🟢' : '🔴'} Online
						</span>
						<span 
							title="VPS connectivity" 
							style={{ 
								fontSize: '14px',
								fontWeight: '500',
								display: 'flex',
								alignItems: 'center',
								gap: '8px'
							}}
						>
							{vpsUp === null ? '⏳' : vpsUp ? '🟢' : '🔴'} VPS
						</span>
					</div>

					{/* Recording Control Buttons */}
					<div style={{
						display: 'flex',
						gap: '8px',
						alignItems: 'center'
					}}>
					</div>
				</div>
			</div>
			
			<div style={{
				maxWidth: 1200,
				margin: '0 auto',
				backgroundColor: 'white',
				borderRadius: '12px',
				boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
				padding: '32px',
				minHeight: 'calc(100vh - 48px)'
			}}>
				<nav style={{
					marginBottom: '24px',
					paddingBottom: '16px',
					borderBottom: '1px solid #e2e8f0'
				}}>
					<button 
						onClick={() => navigate('/')}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							padding: '8px 16px',
							backgroundColor: '#f1f5f9',
							color: '#475569',
							textDecoration: 'none',
							borderRadius: '8px',
							fontWeight: '500',
							transition: 'all 0.2s ease',
							border: 'none',
							cursor: 'pointer',
							fontSize: '14px'
						}}
					>
						← Back to Dashboard
					</button>
				</nav>
				
				{/* Recording status indicator - Removed as requested */}
				
				<MeetingView 
					meetingId={id} 
					onBack={() => navigate('/')}
				/>
			</div>
		</div>
	)
}

export default function App() {
	const Router = isElectron ? HashRouter : BrowserRouter
	const [refreshSignal, setRefreshSignal] = useState(0)
	const [text, setText] = useState('')
	const [tag, setTag] = useState('')
	const [online, setOnline] = useState(true)
	const [vpsUp, setVpsUp] = useState<boolean | null>(null)
	const [availableTags, setAvailableTags] = useState<[string, number][]>([])
	
	// Global recording state
	const [isRecording, setIsRecording] = useState(false)
	const [recordingMeetingId, setRecordingMeetingId] = useState<string | null>(null)
	const [recordingTime, setRecordingTime] = useState(0)

	// Format recording time as HH:MM:SS
	const formatRecordingTime = () => {
		const hours = Math.floor(recordingTime / 3600)
		const minutes = Math.floor((recordingTime % 3600) / 60)
		const seconds = recordingTime % 60
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
	}

	// Debug logging for status
	useEffect(() => {
		console.log('🔍 App Debug Status:', { online, vpsUp, isElectron, isRecording, recordingMeetingId, recordingTime })
	}, [online, vpsUp, isRecording, recordingMeetingId, recordingTime])

	useEffect(() => {
		const stop = watchOnline(setOnline)
		return stop
	}, [])

	// Sync App-level recording state with global recording manager
	useEffect(() => {
		const unsubscribe = globalRecordingManager.subscribe((globalState) => {
			console.log('🔄 App: Global recording state changed:', globalState)
			console.log('⏱️ App: Timer update received - recording time:', globalState.recordingTime)
			// Always keep App state in sync with global state
			setIsRecording(globalState.isRecording)
			setRecordingMeetingId(globalState.meetingId)
			setRecordingTime(globalState.recordingTime)
		})

		// Initialize with current global state
		const currentState = globalRecordingManager.getState()
		setIsRecording(currentState.isRecording)
		setRecordingMeetingId(currentState.meetingId)
		setRecordingTime(currentState.recordingTime)

		return unsubscribe
	}, [])

	// Note: Timer updates are now handled by globalRecordingManager subscription
	// No need for additional timer here - it was causing double counting

	// Warn user before leaving/refreshing during recording
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (isRecording) {
				e.preventDefault()
				e.returnValue = 'Recording is in progress. Are you sure you want to leave? Your recording may be lost.'
				return 'Recording is in progress. Are you sure you want to leave? Your recording may be lost.'
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => window.removeEventListener('beforeunload', handleBeforeUnload)
	}, [isRecording])

	// Keyboard shortcut to clear stuck recording states (Ctrl+Shift+R)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'R') {
				e.preventDefault()
				console.log('🔧 Clearing stuck recording states via keyboard shortcut')
				clearStuckRecordingState()
				// Also clear the global recording manager state
				if (globalRecordingManager.isRecordingInterrupted()) {
					globalRecordingManager.clearInterruptedState()
				}
				alert('Stuck recording states cleared! You may need to refresh the page.')
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Handle app closing while recording (Electron only)
	useEffect(() => {
		if (isElectron && typeof window !== 'undefined' && (window as any).electronAPI) {
			const handleAppClosing = () => {
				console.log('🎙️ App closing while recording - stopping recording...')
				if (isRecording && recordingMeetingId) {
					// Save current state before stopping
					globalRecordingManager.saveCurrentState()
					// Stop recording immediately
					globalRecordingManager.stopRecording()
				}
			}

			// Listen for app closing stop recording command
			;(window as any).electronAPI.onAppClosingStopRecording(handleAppClosing)

			// Listen for mic selector open (from floating window)
			const openMic = () => {
				// Dispatch a global event that Recorder listens to
				window.dispatchEvent(new Event('open-mic-selector'))
			}
			// Listen via preload API
			;(window as any).electronAPI.onOpenMicSelector?.(openMic)

			return () => {
				// Clean up listeners
				;(window as any).electronAPI.removeAppClosingStopRecordingListener()
				;(window as any).electronAPI.removeOpenMicSelectorListener?.()
			}
		}
	}, [isRecording, recordingMeetingId])

	// Check for saved recording state on app startup
	useEffect(() => {
		if (globalRecordingManager.hasSavedRecordingState()) {
			console.log('🎙️ Found saved recording state from app closure')
			// Clear the saved state since user should start fresh
			globalRecordingManager.clearInterruptedState()
			// Show a toast or alert to inform user
			if (typeof window !== 'undefined' && (window as any).showToast) {
				;(window as any).showToast('Previous recording was interrupted. Please start a new recording.', 'info')
			}
		}
	}, [])

	// Recording handlers
	const handleRecordingCreated = (meetingId: string) => {
		console.log('🎙️ Recording started for meeting:', meetingId)
		setIsRecording(true)
		setRecordingMeetingId(meetingId)
		// Don't refresh dashboard immediately - wait for recording to complete
	}

	const handleRecordingStopped = (meetingId: string) => {
		console.log('⏹️ Recording stopped for meeting:', meetingId)
		setIsRecording(false)
		setRecordingMeetingId(null)
		// Now refresh dashboard to show the completed meeting
		setRefreshSignal(Date.now())
	}

	// Handle stop click from floating recorder window
	useEffect(() => {
		const api = (window as any).electronAPI
		if (!api) return
		const handler = () => {
			if (isRecording && recordingMeetingId) {
				globalRecordingManager.saveCurrentState()
				globalRecordingManager.stopRecording()
			}
		}
		api.onStopRecordingFromFloating?.(handler)
		return () => api.removeStopRecordingFromFloatingListener?.()
	}, [isRecording, recordingMeetingId])

	// Debug logging for FloatingRecorder rendering
	console.log('🎙️ App: About to render FloatingRecorder with:', { isRecording, recordingTime, recordingMeetingId })
	
	return (
		<Router>
			{/* Hidden Recorder component to manage global recording state */}
			<div style={{ display: 'none' }}>
				<Recorder 
					onCreated={handleRecordingCreated}
					onStopped={handleRecordingStopped}
					text={text}
					setText={setText}
					tag={tag}
					setTag={setTag}
					online={online}
					vpsUp={vpsUp}
				/>
			</div>
			
			{/* Floating Recorder Widget - Frontend Only */}
			<FloatingRecorder
				isRecording={isRecording}
				recordingTime={recordingTime}
				meetingId={recordingMeetingId}
				onStopRecording={() => {
					if (isRecording && recordingMeetingId) {
						// Save current state before stopping
						globalRecordingManager.saveCurrentState()
						// Stop recording immediately
						globalRecordingManager.stopRecording()
					}
				}}
			/>
			
			{/* Global Recording Notification - Appears on all pages */}
			{isRecording && recordingMeetingId && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					zIndex: 9999,
					background: 'linear-gradient(135deg, #22c55e, #16a34a)',
					color: 'white',
					padding: '12px 20px',
					textAlign: 'center',
					boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
					fontSize: '14px',
					fontWeight: '600'
				}}>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '12px'
					}}>
						<div style={{
							width: '8px',
							height: '8px',
							backgroundColor: '#ef4444',
							borderRadius: '50%',
							animation: 'pulse 1.5s infinite'
						}} />
						🎙️ Recording in Progress • Meeting: {recordingMeetingId.slice(0, 8)}... • {formatRecordingTime()}
					</div>
				</div>
			)}
			
			<div style={{ 
				paddingTop: isRecording && recordingMeetingId ? '50px' : '0',
				transition: 'padding-top 0.3s ease'
			}}>
				<Routes>
					<Route path="/" element={
						<AppShell 
						text={text}
						setText={setText}
						tag={tag}
						setTag={setTag}
						online={online}
						vpsUp={vpsUp}
						setVpsUp={setVpsUp}
						availableTags={availableTags}
						setAvailableTags={setAvailableTags}
						refreshSignal={refreshSignal}
						setRefreshSignal={setRefreshSignal}
						isRecording={isRecording}
						recordingMeetingId={recordingMeetingId}
						onRecordingCreated={handleRecordingCreated}
						onRecordingStopped={handleRecordingStopped}
					/>
				} />
				<Route path="/meeting/:meetingId" element={
					<MeetingRoute 
						text={text}
						setText={setText}
						tag={tag}
						setTag={setTag}
						online={online}
						vpsUp={vpsUp}
						availableTags={availableTags}
						isRecording={isRecording}
						recordingMeetingId={recordingMeetingId}
					/>
				} />
				<Route path="/admin" element={<AdminDashboard />} />
				
			</Routes>
			</div>
		</Router>
	)
}


