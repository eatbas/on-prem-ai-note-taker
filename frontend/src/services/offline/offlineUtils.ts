// Core utility functions for offline operations

export function generateId(prefix = 'id'): string {
	return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

// Helper function to combine transcripts with speaker labels
export function combineTranscriptsWithSpeakers(micTranscript: string, systemTranscript: string): string {
	const lines: string[] = []
	
	if (micTranscript.trim()) {
		lines.push('## Speaker: USER (Microphone)')
		lines.push(micTranscript.trim())
		lines.push('')
	}
	
	if (systemTranscript.trim()) {
		lines.push('## Speaker: OTHERS (System Audio)')
		lines.push(systemTranscript.trim())
		lines.push('')
	}
	
	lines.push('---')
	lines.push('*This transcript was processed using Whisper dual-stream optimization for perfect speaker separation.*')
	
	return lines.join('\n')
}

// Online/offline connectivity utilities
export function watchOnline(callback: (isOnline: boolean) => void): () => void {
	const handleOnline = () => callback(true)
	const handleOffline = () => callback(false)
	
	window.addEventListener('online', handleOnline)
	window.addEventListener('offline', handleOffline)
	
	// Call immediately with current state
	callback(navigator.onLine)
	
	// Return cleanup function
	return () => {
		window.removeEventListener('online', handleOnline)
		window.removeEventListener('offline', handleOffline)
	}
}

// Sync all queued operations when coming back online
export async function syncAllQueued(): Promise<void> {
	console.log('🚀 syncAllQueued: Starting comprehensive sync...')
	
	try {
		// Import sync modules dynamically to avoid circular dependencies
		const { processQueuedMeetings } = await import('../sync/queuedMeetings')
		const { processOutbox } = await import('../sync/outbox')
		const { retryFetchAndCacheMeetings } = await import('../sync/vpsCache')
		
		// Step 1: Process queued meetings first (they contain actual content)
		console.log('📡 Step 1: Processing queued meetings...')
		await processQueuedMeetings()
		
		// Step 2: Process outbox operations (mutations)
		console.log('📤 Step 2: Processing outbox operations...')
		await processOutbox()
		
		// Step 3: Refresh cache from VPS
		console.log('🔄 Step 3: Refreshing VPS cache...')
		try {
			await retryFetchAndCacheMeetings({ attempts: 2, baseDelayMs: 1000 })
		} catch (error) {
			console.warn('Cache refresh failed, but core sync completed:', error)
		}
		
		console.log('✅ syncAllQueued: All sync operations completed successfully')
		
	} catch (error) {
		console.error('❌ syncAllQueued: Sync failed:', error)
		throw error
	}
}
