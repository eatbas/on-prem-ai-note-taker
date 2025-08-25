import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Recorder from './Recorder'
import Dashboard from './Dashboard'
import MeetingView from './MeetingView'
import AdminDashboard from './AdminDashboard'

import { watchOnline } from './offline'
import { getVpsHealth } from './api'
import { useToast } from './Toast'
import { globalRecordingManager } from './globalRecordingManager'

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
						{isRecording && recordingMeetingId && (
							<div style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 12px',
								backgroundColor: '#dcfce7',
								border: '2px solid #22c55e',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '600',
								color: '#166534'
							}}>
								<div style={{
									width: '8px',
									height: '8px',
									backgroundColor: '#ef4444',
									borderRadius: '50%',
									animation: 'pulse 1.5s infinite'
								}} />
								🎙️ Recording...
							</div>
						)}
						
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
						{isRecording && recordingMeetingId && (
							<div style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 12px',
								backgroundColor: '#dcfce7',
								border: '2px solid #22c55e',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '600',
								color: '#166534'
							}}>
								<div style={{
									width: '8px',
									height: '8px',
									backgroundColor: '#ef4444',
									borderRadius: '50%',
									animation: 'pulse 1.5s infinite'
								}} />
								🎙️ Recording...
							</div>
						)}
						
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
				
				{/* Recording status indicator */}
				{isRecording && recordingMeetingId && (
					<div style={{
						padding: '12px 16px',
						backgroundColor: '#dcfce7',
						border: '2px solid #22c55e',
						borderRadius: '8px',
						marginBottom: '16px',
						display: 'flex',
						alignItems: 'center',
						gap: '12px'
					}}>
						<div style={{
							width: '12px',
							height: '12px',
							backgroundColor: '#ef4444',
							borderRadius: '50%',
							animation: 'pulse 1.5s infinite'
						}} />
						<div style={{ flex: 1 }}>
							<div style={{ fontWeight: '600', color: '#166534', fontSize: '14px' }}>
								🎙️ Recording in Progress
							</div>
							<div style={{ color: '#166534', fontSize: '12px' }}>
								Meeting ID: {recordingMeetingId?.slice(0, 8)}... • Return to dashboard to stop recording
							</div>
						</div>
						<button
							onClick={() => navigate('/')}
							style={{
								padding: '8px 12px',
								backgroundColor: '#22c55e',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								fontSize: '12px',
								fontWeight: '600',
								cursor: 'pointer'
							}}
						>
							Go to Dashboard
						</button>
					</div>
				)}
				
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

	// Debug logging for status
	useEffect(() => {
		console.log('🔍 App Debug Status:', { online, vpsUp, isElectron, isRecording, recordingMeetingId })
	}, [online, vpsUp, isRecording, recordingMeetingId])

	useEffect(() => {
		const stop = watchOnline(setOnline)
		return stop
	}, [])

	// Sync App-level recording state with global recording manager
	useEffect(() => {
		const unsubscribe = globalRecordingManager.subscribe((globalState) => {
			console.log('🔄 App: Global recording state changed:', globalState)
			// Always keep App state in sync with global state
			setIsRecording(globalState.isRecording)
			setRecordingMeetingId(globalState.meetingId)
		})

		// Initialize with current global state
		const currentState = globalRecordingManager.getState()
		setIsRecording(currentState.isRecording)
		setRecordingMeetingId(currentState.meetingId)

		return unsubscribe
	}, [])

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
						🎙️ Recording in Progress • Meeting: {recordingMeetingId.slice(0, 8)}...
						<span style={{ opacity: 0.9, fontSize: '12px' }}>
							(Recording will continue across all pages)
						</span>
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


