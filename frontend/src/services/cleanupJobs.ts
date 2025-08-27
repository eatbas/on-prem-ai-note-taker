// Emergency cleanup utilities for duplicate processing jobs
import { db } from './db'

// 🚨 EMERGENCY: Clean up all duplicate/stuck processing jobs
export function cleanupProcessingJobs(): void {
	console.warn('🚨 CLEANUP: Removing all processing job data...')
	
	let cleanedCount = 0
	
	// Remove all processing job data from localStorage
	for (let i = localStorage.length - 1; i >= 0; i--) {
		const key = localStorage.key(i)
		if (key && key.startsWith('processing_job_')) {
			localStorage.removeItem(key)
			cleanedCount++
			console.log('🧹 Removed processing job:', key)
		}
	}
	
	console.log(`✅ Cleanup completed. Removed ${cleanedCount} processing jobs.`)
	
	// Also reset any meetings stuck in 'queued' status back to 'local'
	db.meetings.where('status').equals('queued').modify({status: 'local'}).then((count) => {
		console.log(`✅ Reset ${count} meetings from 'queued' to 'local' status.`)
	}).catch((error) => {
		console.error('❌ Failed to reset meeting statuses:', error)
	})
}

// Expose cleanup function globally for emergency use
if (typeof window !== 'undefined') {
	(window as any).cleanupProcessingJobs = cleanupProcessingJobs
	console.log('🚨 Emergency cleanup function available: window.cleanupProcessingJobs()')
}
