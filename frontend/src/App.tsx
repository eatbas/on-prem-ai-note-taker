import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import Recorder from './Recorder'
import Dashboard from './Dashboard'
import MeetingView from './MeetingView'

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')

function AppShell() {
	const navigate = useNavigate()
	const [refreshSignal, setRefreshSignal] = useState(0)
	return (
		<div style={{ 
			maxWidth: '100%', 
			margin: '0 auto', 
			padding: '24px',
			fontFamily: 'Inter, system-ui, Arial, sans-serif',
			minHeight: '100vh',
			backgroundColor: '#f8fafc'
		}}>
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
				</header>
				
				{/* Stay on dashboard when recording starts; meeting can be opened from the list */}
				<Recorder onCreated={() => { /* no navigation */ }} onStopped={() => setRefreshSignal(Date.now())} />
				
				<div style={{ 
					margin: '32px 0',
					height: '1px',
					background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)'
				}} />
				
				<Dashboard onOpen={(id) => navigate(`/meeting/${id}`)} refreshSignal={refreshSignal} />
			</div>
		</div>
	)
}

function MeetingRoute() {
	const params = useParams()
	const navigate = useNavigate()
	const id = params.meetingId as string
	return (
		<div style={{ 
			maxWidth: '100%', 
			margin: '0 auto', 
			padding: '24px',
			fontFamily: 'Inter, system-ui, Arial, sans-serif',
			minHeight: '100vh',
			backgroundColor: '#f8fafc'
		}}>
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
				<MeetingView meetingId={id} />
			</div>
		</div>
	)
}

export default function App() {
	const Router = isElectron ? HashRouter : BrowserRouter
	return (
		<Router>
			<Routes>
				<Route path="/" element={<AppShell /> } />
				<Route path="/meeting/:meetingId" element={<MeetingRoute /> } />
			</Routes>
		</Router>
	)
}


