import { apiBase, getAuthHeader, getUserId, handleApiResponse } from './core'

export async function transcribe(file: File, opts?: { language?: string; vadFilter?: boolean }) {
	const form = new FormData()
	form.append('file', file)
	// Always send a language parameter, defaulting to 'auto' for undefined/null/empty
	form.append('language', opts?.language || 'auto')
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	// Add job to queue for tracking
	const jobId = `transcribe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	// Import and add to queue (dynamic import to avoid circular dependencies)
	try {
		const { jobQueueManager } = await import('../../stores/jobQueueManager')
		jobQueueManager.addJob(jobId, 'processing', 'Transcribing audio...')
	} catch (error) {
		console.warn('Failed to add job to queue:', error)
	}

	try {
		const userId = getUserId()
		const response = await fetch(`${apiBase}/transcribe`, {
			method: 'POST',
			headers: {
				...getAuthHeader(),
				...(userId && { 'X-User-Id': userId })
			},
			body: form
		})

		const result = await handleApiResponse<any>(response)
		
		// Update job status on success
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			jobQueueManager.updateJob(jobId, { status: 'completed', message: 'Transcription completed' })
		} catch (error) {
			console.warn('Failed to update job status:', error)
		}

		return result
	} catch (error) {
		// Update job status on error
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			jobQueueManager.updateJob(jobId, { status: 'failed', message: `Transcription failed: ${error}` })
		} catch (queueError) {
			console.warn('Failed to update job status:', queueError)
		}
		throw error
	}
}

export async function submitQueueTranscription(file: File, language: string = 'auto'): Promise<{ task_id: string }> {
	const form = new FormData()
	form.append('file', file)
	form.append('language', language)

	const userId = getUserId()
	const response = await fetch(`${apiBase}/queue/transcribe`, {
		method: 'POST',
		headers: {
			...getAuthHeader(),
			...(userId && { 'X-User-Id': userId })
		},
		body: form
	})

	return handleApiResponse<{ task_id: string }>(response)
}

export async function transcribeAndSummarize(file: File, opts?: { language?: string; vadFilter?: boolean }) {
	// Add job to queue for tracking
	const jobId = `transcribe_summarize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	try {
		const { jobQueueManager } = await import('../../stores/jobQueueManager')
		jobQueueManager.addJob(jobId, 'processing', 'Transcribing and summarizing...')
	} catch (error) {
		console.warn('Failed to add job to queue:', error)
	}

	const form = new FormData()
	form.append('file', file)
	form.append('language', opts?.language || 'auto')
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	try {
		const userId = getUserId()
		const response = await fetch(`${apiBase}/transcribe-and-summarize`, {
			method: 'POST',
			headers: {
				...getAuthHeader(),
				...(userId && { 'X-User-Id': userId })
			},
			body: form
		})

		const result = await handleApiResponse<any>(response)
		
		// Update job status on success
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			jobQueueManager.updateJob(jobId, { status: 'completed', message: 'Transcription and summarization completed' })
		} catch (error) {
			console.warn('Failed to update job status:', error)
		}

		return result
	} catch (error) {
		// Update job status on error
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			jobQueueManager.updateJob(jobId, { status: 'failed', message: `Transcription failed: ${error}` })
		} catch (queueError) {
			console.warn('Failed to update job status:', queueError)
		}
		throw error
	}
}

export async function submitTranscribeAndSummarizeJob(
	file: File, 
	language: string = 'auto', 
	vadFilter: boolean = false
): Promise<{ job_id: string }> {
	const form = new FormData()
	form.append('file', file)
	form.append('language', language)
	form.append('vad_filter', String(vadFilter))

	const userId = getUserId()
	const response = await fetch(`${apiBase}/jobs/transcribe-and-summarize`, {
		method: 'POST',
		headers: {
			...getAuthHeader(),
			...(userId && { 'X-User-Id': userId })
		},
		body: form
	})

	return handleApiResponse<{ job_id: string }>(response)
}
