// Background processing service for persistent VPS operations
import { autoProcessMeetingRecordingWithWhisperOptimization } from './offline/processingOperations'
import { db } from './db'
import { jobQueueManager } from '../stores/jobQueueManager'

export interface ProcessingJobData {
	meetingId: string
	recordingDuration: number
	timestamp: number
}

// Queue a meeting for background processing 
export async function queueMeetingProcessing(meetingId: string, recordingDuration: number = 0): Promise<string> {
	console.log('🎯 Queuing meeting for background processing:', meetingId)
	
	// 🚨 CRITICAL: Check if meeting is already processed or being processed
	const meeting = await db.meetings.get(meetingId)
	if (!meeting) {
		throw new Error(`Meeting ${meetingId} not found - cannot queue for processing`)
	}
	
	if (meeting.status === 'sent') {
		console.log(`✅ Meeting ${meetingId} already processed. Skipping queue to prevent duplicate.`)
		return 'already_processed'
	}
	
	if (meeting.status === 'queued') {
		console.log(`⏳ Meeting ${meetingId} already being processed (status: queued). Skipping queue to prevent duplicate.`)
		return 'already_processing'
	}
	
	// Check for existing pending jobs for this meeting
	const existingJobs = getPendingProcessingJobs()
	const existingJob = existingJobs.find(job => job.meetingId === meetingId)
	if (existingJob) {
		console.log(`⚠️ Meeting ${meetingId} already has pending job. Skipping to prevent duplicate.`)
		return 'already_queued'
	}
	
	// Create unique job ID
	const jobId = `process_meeting_${meetingId}_${Date.now()}`
	
	// Add to job queue for tracking
	jobQueueManager.addJob(jobId, 'pending', 'Queued for processing...')
	
	// Store job data for processing
	const jobData: ProcessingJobData = {
		meetingId,
		recordingDuration,
		timestamp: Date.now()
	}
	
	// Store job data in localStorage for persistence across navigation
	const jobKey = `processing_job_${jobId}`
	localStorage.setItem(jobKey, JSON.stringify(jobData))
	
	// Start processing in the background
	setTimeout(() => processQueuedMeeting(jobId, jobData), 1000)
	
	console.log('✅ Meeting queued for processing with job ID:', jobId)
	return jobId
}

// Process a queued meeting (runs independently of UI navigation)
async function processQueuedMeeting(jobId: string, jobData: ProcessingJobData): Promise<void> {
	console.log('🚀 Starting background processing for job:', jobId)
	
	try {
		// 🚨 CRITICAL: Double-check meeting status before processing
		const meeting = await db.meetings.get(jobData.meetingId)
		if (!meeting) {
			throw new Error(`Meeting ${jobData.meetingId} not found during processing`)
		}
		
		if (meeting.status === 'sent') {
			console.log(`✅ Meeting ${jobData.meetingId} already processed. Stopping job to prevent duplicate.`)
			jobQueueManager.updateJob(jobId, { 
				status: 'completed', 
				message: 'Already processed - skipped duplicate',
				progress: 100
			})
			// Clean up job data
			const jobKey = `processing_job_${jobId}`
			localStorage.removeItem(jobKey)
			return
		}
		
		// Update job status
		jobQueueManager.updateJob(jobId, { 
			status: 'processing', 
			message: 'Processing meeting with AI...',
			progress: 10
		})
		
		// Update meeting duration if provided
		if (jobData.recordingDuration > 0) {
			await db.meetings.update(jobData.meetingId, {
				duration: jobData.recordingDuration,
				updatedAt: Date.now()
			})
		}
		
		// Update progress
		jobQueueManager.updateJob(jobId, { 
			progress: 30,
			message: 'Assembling audio files...'
		})
		
		// Process the meeting (this can take a while but persists across navigation)
		await autoProcessMeetingRecordingWithWhisperOptimization(jobData.meetingId)
		
		// Update progress
		jobQueueManager.updateJob(jobId, { 
			progress: 90,
			message: 'Finalizing...'
		})
		
		// Mark as completed
		jobQueueManager.updateJob(jobId, { 
			status: 'completed', 
			message: 'Meeting processed successfully!',
			progress: 100
		})
		
		// Clean up job data
		const jobKey = `processing_job_${jobId}`
		localStorage.removeItem(jobKey)
		
		console.log('✅ Background processing completed for job:', jobId)
		
	} catch (error) {
		console.error('❌ Background processing failed for job:', jobId, error)
		
		// Update job status to failed
		jobQueueManager.updateJob(jobId, { 
			status: 'failed', 
			message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			progress: 0
		})
		
		// Don't clean up job data on failure so user can retry
		throw error
	}
}

// Retry a failed processing job
export async function retryProcessingJob(jobId: string): Promise<void> {
	const jobKey = `processing_job_${jobId}`
	const jobDataStr = localStorage.getItem(jobKey)
	
	if (!jobDataStr) {
		throw new Error('Job data not found - cannot retry')
	}
	
	const jobData: ProcessingJobData = JSON.parse(jobDataStr)
	
	// Reset job status
	jobQueueManager.updateJob(jobId, { 
		status: 'pending', 
		message: 'Retrying processing...',
		progress: 0
	})
	
	// Start processing again
	setTimeout(() => processQueuedMeeting(jobId, jobData), 1000)
}

// Get all pending processing jobs (for recovery after app restart)
export function getPendingProcessingJobs(): ProcessingJobData[] {
	const jobs: ProcessingJobData[] = []
	
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)
		if (key && key.startsWith('processing_job_')) {
			try {
				const jobData = JSON.parse(localStorage.getItem(key) || '{}')
				jobs.push(jobData)
			} catch (error) {
				console.warn('Failed to parse job data:', key, error)
			}
		}
	}
	
	return jobs
}

// Resume any interrupted processing jobs on app startup
export function resumeInterruptedJobs(): void {
	const pendingJobs = getPendingProcessingJobs()
	
	if (pendingJobs.length > 0) {
		console.log('🔄 Checking interrupted processing jobs:', pendingJobs.length)
		
		// 🚨 CRITICAL: Check each job's meeting status before resuming
		pendingJobs.forEach(async (jobData) => {
			try {
				const meeting = await db.meetings.get(jobData.meetingId)
				
				if (!meeting) {
					console.log(`❌ Meeting ${jobData.meetingId} not found. Cleaning up job.`)
					const jobKey = `processing_job_resume_process_meeting_${jobData.meetingId}_*`
					// Clean up this job from localStorage
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i)
						if (key && key.includes(jobData.meetingId)) {
							localStorage.removeItem(key)
						}
					}
					return
				}
				
				if (meeting.status === 'sent') {
					console.log(`✅ Meeting ${jobData.meetingId} already processed. Cleaning up job.`)
					// Clean up completed job
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i)
						if (key && key.includes(jobData.meetingId)) {
							localStorage.removeItem(key)
						}
					}
					return
				}
				
				if (meeting.status === 'queued') {
					console.log(`⏳ Meeting ${jobData.meetingId} is already being processed (status: queued). Skipping resume.`)
					return
				}
				
				// Only resume if meeting is still in 'local' status
				if (meeting.status === 'local' || !meeting.status) {
					console.log(`🔄 Resuming processing for meeting ${jobData.meetingId}...`)
					const jobId = `resume_process_meeting_${jobData.meetingId}_${Date.now()}`
					
					// Add back to job queue
					jobQueueManager.addJob(jobId, 'pending', 'Resuming interrupted processing...')
					
					// Start processing
					setTimeout(() => processQueuedMeeting(jobId, jobData), 2000)
				} else {
					console.log(`⚠️ Meeting ${jobData.meetingId} has unexpected status: ${meeting.status}. Cleaning up job.`)
					// Clean up job with unexpected status
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i)
						if (key && key.includes(jobData.meetingId)) {
							localStorage.removeItem(key)
						}
					}
				}
			} catch (error) {
				console.error(`❌ Error checking meeting status for ${jobData.meetingId}:`, error)
			}
		})
	}
}

// Initialize background processor (call this when app starts)
export function initializeBackgroundProcessor(): void {
	console.log('🏗️ Initializing background processor...')
	
	// Resume any interrupted jobs after a short delay
	setTimeout(() => {
		resumeInterruptedJobs()
	}, 3000) // Wait 3 seconds for app to fully initialize
}
