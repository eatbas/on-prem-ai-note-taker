import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { syncAllQueued, watchOnline } from './services'
// Initialize centralized API state manager early
import './stores/apiStateManager'

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)

// background: attempt sync when coming online
watchOnline(async (online) => {
	if (online) {
		try { await syncAllQueued() } catch {}
	}
})


