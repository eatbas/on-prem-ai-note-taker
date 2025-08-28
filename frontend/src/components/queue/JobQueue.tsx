import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { getJobStatus, cancelJob } from '../../services'
import { jobQueueManager, type JobHistoryItem } from '../../stores/jobQueueManager'
import { isJobActive } from './JobQueueUtils'
import JobQueueHeader from './JobQueueHeader'
import JobQueueStatusIndicators from './JobQueueStatusIndicators'
import JobQueueErrorDisplay from './JobQueueErrorDisplay'
import JobQueueStats from './JobQueueStats'
import JobQueueItem from './JobQueueItem'
import JobQueueModal from './JobQueueModal'

interface JobQueueProps {
	online: boolean
	vpsUp: boolean | null
}

// 🚀 STAGE 2 OPTIMIZATION: Memoize JobQueue component for performance
const JobQueue = memo(function JobQueue({ online, vpsUp }: JobQueueProps) {
	const [jobHistory, setJobHistory] = useState<JobHistoryItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [selectedJob, setSelectedJob] = useState<JobHistoryItem | null>(null)

	// Subscribe to job queue manager
	useEffect(() => {
		const unsubscribe = jobQueueManager.subscribe((jobs) => {
			setJobHistory(jobs)
		})
		return unsubscribe
	}, [])

	// 🚀 STAGE 2 OPTIMIZATION: Memoize expensive calculations first
	const hasActiveJobs = useMemo(() => {
		return jobHistory.some(job => isJobActive(job.status))
	}, [jobHistory])

	const connectionStatus = useMemo(() => ({
		online,
		vpsUp,
		connected: online && !!vpsUp
	}), [online, vpsUp])

	// 🚀 STAGE 2 OPTIMIZATION: Memoize job update function
	const updateJobInHistory = useCallback((jobId: string, updates: Partial<JobHistoryItem>) => {
		jobQueueManager.updateJob(jobId, updates)
	}, [])

	// 🚀 STAGE 2 OPTIMIZATION: Memoize job refresh logic
	const refreshActiveJobs = useCallback(async () => {
		if (!online || !vpsUp) return

		const activeJobs = jobHistory.filter(job => isJobActive(job.status))

		for (const job of activeJobs) {
			try {
				const status = await getJobStatus(job.id)
				updateJobInHistory(job.id, {
					status: status.phase || status.status,
					progress: status.progress,
					message: status.message,
					eta: status.eta_seconds,
					canGoBack: ['done', 'error', 'completed', 'failed', 'canceled'].includes(status.phase || status.status)
				})
			} catch (err) {
				console.error(`Failed to refresh job ${job.id}:`, err)
				updateJobInHistory(job.id, {
					status: 'error',
					message: 'Connection lost',
					canGoBack: true
				})
			}
		}
	}, [online, vpsUp, jobHistory, updateJobInHistory])

	// 🚀 STAGE 2 OPTIMIZATION: Memoize cancel job handler
	const handleCancelJob = useCallback(async (jobId: string) => {
		if (!online || !vpsUp) return

		try {
			setLoading(true)
			await cancelJob(jobId)
			updateJobInHistory(jobId, {
				status: 'canceled',
				message: 'Job cancelled by user',
				canGoBack: true
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to cancel job')
		} finally {
			setLoading(false)
		}
	}, [online, vpsUp, updateJobInHistory])

	// 🚀 STAGE 2 OPTIMIZATION: Memoize additional handlers
	const handleGoBackToJob = useCallback((job: JobHistoryItem) => {
		setSelectedJob(job)
	}, [])

	const clearHistory = useCallback(() => {
		jobQueueManager.clearHistory()
	}, [])

	// Auto-refresh active jobs every 20 seconds (reduced from 5 seconds)
	useEffect(() => {
		if (!online || !vpsUp) return

		if (!hasActiveJobs) return // Don't poll if no active jobs

		const interval = setInterval(() => {
			refreshActiveJobs()
		}, 20000)

		return () => clearInterval(interval)
	}, [online, vpsUp, hasActiveJobs, refreshActiveJobs])

	return (
		<div style={{ padding: '24px 0' }}>
			<JobQueueHeader 
				jobCount={jobHistory.length} 
				onClearHistory={clearHistory} 
			/>
			
			<JobQueueStatusIndicators 
				online={online} 
				vpsUp={vpsUp} 
			/>
			
			<JobQueueErrorDisplay 
				error={error} 
				onDismiss={() => setError(null)} 
			/>

			{jobHistory.length > 0 ? (
				<div>
					<JobQueueStats jobHistory={jobHistory} />
					
					<div style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '16px'
					}}>
						{jobHistory.map((job) => (
							<JobQueueItem
								key={job.id}
								job={job}
								loading={loading}
								onCancelJob={handleCancelJob}
								onGoBackToJob={handleGoBackToJob}
							/>
						))}
					</div>
				</div>
			) : (
				<div style={{
					textAlign: 'center',
					padding: '48px 20px',
					backgroundColor: 'white',
					border: '2px dashed #e2e8f0',
					borderRadius: '12px',
					color: '#64748b'
				}}>
					<div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
					<h3 style={{ 
						margin: '0 0 8px 0',
						fontSize: '1.2rem',
						fontWeight: '600'
					}}>
						No jobs yet
					</h3>
					<p style={{ 
						margin: '0',
						fontSize: '14px'
					}}>
						Start a recording or transcription to see jobs appear here
					</p>
				</div>
			)}

			<JobQueueModal 
				job={selectedJob} 
				onClose={() => setSelectedJob(null)} 
			/>
		</div>
	)
})

export default JobQueue