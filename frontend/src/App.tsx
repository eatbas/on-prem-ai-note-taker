import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import Recorder from './Recorder'
import Dashboard from './Dashboard'
import MeetingView from './MeetingView'
function AppShell() {
	const navigate = useNavigate()
	return (
		<div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'Inter, system-ui, Arial' }}>
			<h1>On-Prem AI Note Taker</h1>
			<Recorder onCreated={(id) => navigate(`/meeting/${id}`)} />
			<hr style={{ margin: '16px 0' }} />
			<Dashboard onOpen={(id) => navigate(`/meeting/${id}`)} />
		</div>
	)
}

function MeetingRoute() {
	const params = useParams()
	const id = params.meetingId as string
	return (
		<div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
			<a href="/">← Back</a>
			<MeetingView meetingId={id} />
		</div>
	)
}

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<AppShell />} />
				<Route path="/meeting/:meetingId" element={<MeetingRoute />} />
			</Routes>
		</BrowserRouter>
	)
}


