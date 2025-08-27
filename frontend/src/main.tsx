import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { syncAllQueued, watchOnline } from './services'
import { ErrorBoundary } from './components/common'
// Initialize centralized API state manager early
import { apiStateManager } from './stores/api'
console.log('🎯 MAIN: API State Manager singleton imported at startup:', !!apiStateManager)

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
	<React.StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</React.StrictMode>
)

// background: attempt sync when coming online
watchOnline(async (online: boolean) => {
	if (online) {
		try { 
			await syncAllQueued() 
		} catch (error) {
			console.log('Background sync failed:', error)
		}
	}
})


