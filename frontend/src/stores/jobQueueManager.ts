// Job Queue Manager - Global utility for managing job history

interface JobHistoryItem {
	id: string
	status: string
	progress: number
	message: string
	createdAt: Date
	updatedAt: Date
	eta?: number
	canGoBack: boolean
}

class JobQueueManager {
	private static instance: JobQueueManager
	private listeners: Set<(jobs: JobHistoryItem[]) => void> = new Set()
	private jobHistory: JobHistoryItem[] = []

	private constructor() {
		this.loadFromStorage()
	}

	static getInstance(): JobQueueManager {
		if (!JobQueueManager.instance) {
			JobQueueManager.instance = new JobQueueManager()
		}
		return JobQueueManager.instance
	}

	private loadFromStorage() {
		try {
			const saved = localStorage.getItem('job_history')
			if (saved) {
				this.jobHistory = JSON.parse(saved).map((job: any) => ({
					...job,
					createdAt: new Date(job.createdAt),
					updatedAt: new Date(job.updatedAt)
				}))
			}
		} catch (err) {
			console.error('Failed to load job history:', err)
			this.jobHistory = []
		}
	}

	private saveToStorage() {
		try {
			localStorage.setItem('job_history', JSON.stringify(this.jobHistory))
		} catch (err) {
			console.error('Failed to save job history:', err)
		}
	}

	private notifyListeners() {
		this.listeners.forEach(listener => listener([...this.jobHistory]))
	}

	addJob(jobId: string, status: string = 'pending', message: string = 'Job submitted') {
		const newJob: JobHistoryItem = {
			id: jobId,
			status,
			progress: 0,
			message,
			createdAt: new Date(),
			updatedAt: new Date(),
			canGoBack: false
		}

		this.jobHistory = [newJob, ...this.jobHistory].slice(0, 50) // Keep last 50 jobs
		this.saveToStorage()
		this.notifyListeners()
		
		console.log(`Job ${jobId} added to queue: ${status} - ${message}`)
		return newJob
	}

	updateJob(jobId: string, updates: Partial<JobHistoryItem>) {
		const jobIndex = this.jobHistory.findIndex(job => job.id === jobId)
		if (jobIndex !== -1) {
			this.jobHistory[jobIndex] = {
				...this.jobHistory[jobIndex],
				...updates,
				updatedAt: new Date()
			}
			this.saveToStorage()
			this.notifyListeners()
		}
	}

	getJobs(): JobHistoryItem[] {
		return [...this.jobHistory]
	}

	clearHistory() {
		this.jobHistory = []
		localStorage.removeItem('job_history')
		this.notifyListeners()
	}

	subscribe(listener: (jobs: JobHistoryItem[]) => void): () => void {
		this.listeners.add(listener)
		// Immediately call with current state
		listener([...this.jobHistory])
		
		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener)
		}
	}
}

// Export singleton instance
export const jobQueueManager = JobQueueManager.getInstance()

// Export types
export type { JobHistoryItem }

// Export convenience functions
export const addJobToQueue = (jobId: string, status: string = 'pending', message: string = 'Job submitted') => {
	return jobQueueManager.addJob(jobId, status, message)
}

export const updateJobInQueue = (jobId: string, updates: Partial<JobHistoryItem>) => {
	return jobQueueManager.updateJob(jobId, updates)
}

export const getJobQueue = () => {
	return jobQueueManager.getJobs()
}

export const clearJobQueue = () => {
	return jobQueueManager.clearHistory()
}
