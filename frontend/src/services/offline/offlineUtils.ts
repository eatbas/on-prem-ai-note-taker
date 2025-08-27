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

// Placeholder for sync all queued function (to be implemented)
export async function syncAllQueued(): Promise<void> {
	console.log('syncAllQueued: Feature not yet implemented')
	// TODO: Implement syncing all queued meetings
}
