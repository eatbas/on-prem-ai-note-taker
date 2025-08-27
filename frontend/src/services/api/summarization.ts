import { apiRequest } from './core'

export async function summarize(text: string, language: string = 'auto') {
	// Add job to queue for tracking
	const jobId = `summarize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	try {
		const { jobQueueManager } = await import('../../stores/jobQueueManager')
		jobQueueManager.addJob(jobId, 'summarization', 'processing', 'Generating summary...')
	} catch (error) {
		console.warn('Failed to add job to queue:', error)
	}

	try {
		const result = await apiRequest<any>('/summarize', {
			method: 'POST',
			body: JSON.stringify({
				text,
				language
			})
		})
		
		// Update job status on success
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			jobQueueManager.updateJob(jobId, 'completed', 'Summary generated')
		} catch (error) {
			console.warn('Failed to update job status:', error)
		}

		return result
	} catch (error) {
		// Update job status on error
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			jobQueueManager.updateJob(jobId, 'failed', `Summarization failed: ${error}`)
		} catch (queueError) {
			console.warn('Failed to update job status:', queueError)
		}
		throw error
	}
}

export async function submitQueueSummarization(text: string): Promise<{ task_id: string }> {
	return apiRequest<{ task_id: string }>('/queue/summarize', {
		method: 'POST',
		body: JSON.stringify({ text })
	})
}
