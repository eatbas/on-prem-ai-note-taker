// Job Queue Utility Functions

export const getStatusColor = (status: string): string => {
	switch (status) {
		case 'done': 
		case 'completed': return '#10b981'
		case 'error': 
		case 'failed': return '#ef4444'
		case 'canceled': return '#6b7280'
		case 'pending': return '#f59e0b'
		case 'uploading': return '#8b5cf6'  // Purple for upload
		case 'waiting': return '#f59e0b'    // Orange for waiting
		case 'transcribing': return '#3b82f6'  // Blue for transcription
		case 'summarizing': return '#06b6d4'   // Cyan for summarization
		case 'finalizing': return '#059669'    // Green for finalization
		default: return '#6b7280'
	}
}

export const getStatusIcon = (status: string): string => {
	switch (status) {
		case 'done': 
		case 'completed': return '✅'
		case 'error': 
		case 'failed': return '❌'
		case 'canceled': return '⏹️'
		case 'pending': return '⏳'
		case 'uploading': return '📤'  // Upload icon
		case 'waiting': return '⏳'    // Waiting icon
		case 'transcribing': return '🎙️'  // Microphone for transcription
		case 'summarizing': return '📝'   // Document for summarization
		case 'finalizing': return '🔧'    // Wrench for finalization
		default: return '❓'
	}
}

export const formatDuration = (seconds?: number): string => {
	if (!seconds) return 'Unknown'
	if (seconds < 60) return `${Math.round(seconds)}s`
	if (seconds < 3600) return `${Math.round(seconds / 60)}m`
	return `${Math.round(seconds / 3600)}h`
}

export const formatDate = (date: Date): string => {
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return 'Just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`
	return date.toLocaleDateString()
}

export const getActiveStatuses = (): string[] => {
	return ['pending', 'uploading', 'waiting', 'transcribing', 'summarizing', 'finalizing']
}

export const isJobActive = (status: string): boolean => {
	return getActiveStatuses().includes(status)
}

export const isJobCompleted = (status: string): boolean => {
	return ['done', 'error', 'canceled'].includes(status)
}
