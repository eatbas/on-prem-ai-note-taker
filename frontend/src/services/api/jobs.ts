import { apiRequest, apiBase, getUserId } from './core'

export interface JobStatus {
	job_id: string
	status: 'pending' | 'processing' | 'completed' | 'failed'
	phase?: string
	message?: string
	result?: any
	created_at: string
	updated_at: string
	progress?: number
	eta_seconds?: number
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
	return apiRequest<JobStatus>(`/jobs/${jobId}/status`)
}

export async function cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
	return apiRequest<{ success: boolean; message: string }>(`/jobs/${jobId}/cancel`, {
		method: 'POST'
	})
}

export function createJobProgressStream(jobId: string): EventSource {
	const userId = getUserId()
	if (!userId) {
		throw new Error('User ID not found')
	}

	const url = new URL(`${apiBase}/jobs/${jobId}/stream`)
	url.searchParams.set('user_id', userId)

	const eventSource = new EventSource(url.toString())
	
	eventSource.onerror = (error) => {
		console.error('Job progress stream error:', error)
	}

	return eventSource
}
