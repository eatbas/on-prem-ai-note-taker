import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { syncAllQueued, watchOnline } from './services'
import { ErrorBoundary } from './components/common'
// Initialize centralized API state manager early
import './stores/apiStateManager'

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
	<React.StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</React.StrictMode>
)

// background: attempt sync when coming online
watchOnline(async (online) => {
	if (online) {
		try { await syncAllQueued() } catch {}
	}
})


