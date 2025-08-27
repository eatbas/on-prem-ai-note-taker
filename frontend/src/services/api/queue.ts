import { apiRequest } from './core'

export interface QueueStats {
	pending: number
	processing: number
	completed: number
	failed: number
	total: number
	active_tasks?: number
	pending_tasks?: number
	completed_tasks?: number
	failed_tasks?: number
	workers_running?: number
}

export interface ProgressStats {
	totalJobs: number
	completedJobs: number
	failedJobs: number
	pendingJobs: number
	processingJobs: number
	successRate: number
}

export async function getQueueStats(): Promise<QueueStats> {
	return apiRequest<QueueStats>('/queue/stats')
}

export async function getQueueTaskStatus(taskId: string): Promise<any> {
	return apiRequest<any>(`/queue/status/${taskId}`)
}

export async function getQueueTaskResult(taskId: string): Promise<any> {
	return apiRequest<any>(`/queue/result/${taskId}`)
}

export async function getProgressStats(): Promise<ProgressStats> {
	return apiRequest<ProgressStats>('/progress/stats')
}
