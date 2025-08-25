import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { syncAllQueued, watchOnline } from './services'

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


