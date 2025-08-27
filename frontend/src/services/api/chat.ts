import { apiRequest } from './core'

export async function chat(prompt: string, model?: string) {
	// Add job to queue for tracking
	const jobId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	try {
		const { jobQueueManager } = await import('../../stores/jobQueueManager')
		  jobQueueManager.addJob(jobId, 'processing', 'AI is thinking...')
	} catch (error) {
		console.warn('Failed to add job to queue:', error)
	}

	try {
		const result = await apiRequest<any>('/chat', {
			method: 'POST',
			body: JSON.stringify({
				prompt,
				model
			})
		})
		
		// Update job status on success
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			    jobQueueManager.updateJob(jobId, { status: 'completed', message: 'AI response generated' })
		} catch (error) {
			console.warn('Failed to update job status:', error)
		}

		return result
	} catch (error) {
		// Update job status on error
		try {
			const { jobQueueManager } = await import('../../stores/jobQueueManager')
			    jobQueueManager.updateJob(jobId, { status: 'failed', message: `Chat failed: ${error}` })
		} catch (queueError) {
			console.warn('Failed to update job status:', queueError)
		}
		throw error
	}
}
