// Job Queue Utility Functions

export const getStatusColor = (status: string): string => {
	switch (status) {
		case 'done': return '#10b981'
		case 'error': return '#ef4444'
		case 'canceled': return '#6b7280'
		case 'pending': return '#f59e0b'
		case 'transcribing':
		case 'summarizing':
		case 'finalizing': return '#3b82f6'
		default: return '#6b7280'
	}
}

export const getStatusIcon = (status: string): string => {
	switch (status) {
		case 'done': return '✅'
		case 'error': return '❌'
		case 'canceled': return '⏹️'
		case 'pending': return '⏳'
		case 'transcribing': return '🎙️'
		case 'summarizing': return '📝'
		case 'finalizing': return '🔧'
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
	return ['pending', 'transcribing', 'summarizing', 'finalizing']
}

export const isJobActive = (status: string): boolean => {
	return getActiveStatuses().includes(status)
}

export const isJobCompleted = (status: string): boolean => {
	return ['done', 'error', 'canceled'].includes(status)
}
