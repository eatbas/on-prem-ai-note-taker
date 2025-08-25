import { useState, useEffect } from 'react'
import { getJobStatus, cancelJob, JobStatus } from '../../services'
import { jobQueueManager, type JobHistoryItem } from '../../stores/jobQueueManager'

interface JobQueueProps {
	online: boolean
	vpsUp: boolean | null
}



export default function JobQueue({ online, vpsUp }: JobQueueProps) {
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

	// Auto-refresh active jobs every 5 seconds
	useEffect(() => {
		if (!online || !vpsUp) return

		const interval = setInterval(() => {
			refreshActiveJobs()
		}, 5000)

		return () => clearInterval(interval)
	}, [online, vpsUp, jobHistory])

	const updateJobInHistory = (jobId: string, updates: Partial<JobHistoryItem>) => {
		jobQueueManager.updateJob(jobId, updates)
	}

	const refreshActiveJobs = async () => {
		if (!online || !vpsUp) return

		const activeJobs = jobHistory.filter(job => 
			['pending', 'transcribing', 'summarizing', 'finalizing'].includes(job.status)
		)

		for (const job of activeJobs) {
			try {
				const status = await getJobStatus(job.id)
				updateJobInHistory(job.id, {
					status: status.phase,
					progress: status.progress,
					message: status.message,
					eta: status.eta_seconds,
					canGoBack: status.phase === 'done' || status.phase === 'error'
				})
			} catch (err) {
				console.error(`Failed to refresh job ${job.id}:`, err)
				// Mark as error if we can't reach the job
				updateJobInHistory(job.id, {
					status: 'error',
					message: 'Connection lost',
					canGoBack: true
				})
			}
		}
	}

	const handleCancelJob = async (jobId: string) => {
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
	}

	const handleGoBackToJob = (job: JobHistoryItem) => {
		setSelectedJob(job)
		// You can implement navigation logic here
		// For now, we'll just show the job details
	}

	const getStatusColor = (status: string) => {
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

	const getStatusIcon = (status: string) => {
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

	const formatDuration = (seconds?: number) => {
		if (!seconds) return 'Unknown'
		if (seconds < 60) return `${Math.round(seconds)}s`
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`
		return `${Math.round(seconds / 3600)}h`
	}

	const formatDate = (date: Date) => {
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

	const clearHistory = () => {
		jobQueueManager.clearHistory()
	}

	return (
		<div style={{ padding: '24px 0' }}>
			{/* Header */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				marginBottom: '24px'
			}}>
				<div>
					<h2 style={{
						margin: '0 0 8px 0',
						fontSize: '1.8rem',
						fontWeight: '600',
						color: '#1e293b'
					}}>
						📋 Job Queue & History
					</h2>
					<p style={{
						margin: '0',
						color: '#64748b',
						fontSize: '1rem'
					}}>
						Track your recent AI processing jobs and go back to completed work
					</p>
				</div>
				
				{jobHistory.length > 0 && (
					<button
						onClick={clearHistory}
						style={{
							padding: '12px 20px',
							backgroundColor: '#6b7280',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							fontSize: '14px',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.2s ease'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#4b5563'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#6b7280'
						}}
					>
						🗑️ Clear History
					</button>
				)}
			</div>

			{/* Status indicators */}
			<div style={{
				display: 'flex',
				gap: '16px',
				marginBottom: '24px',
				flexWrap: 'wrap'
			}}>
				<span style={{ 
					fontSize: '14px', 
					fontWeight: '500',
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					padding: '8px 16px',
					backgroundColor: online ? '#dcfce7' : '#fee2e2',
					color: online ? '#166534' : '#dc2626',
					borderRadius: '8px',
					border: `1px solid ${online ? '#bbf7d0' : '#fecaca'}`
				}}>
					{online ? '🟢' : '🔴'} {online ? 'Online' : 'Offline'}
				</span>
				<span style={{ 
					fontSize: '14px',
					fontWeight: '500',
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					padding: '8px 16px',
					backgroundColor: vpsUp ? '#dcfce7' : vpsUp === null ? '#fef3c7' : '#fee2e2',
					color: vpsUp ? '#166534' : vpsUp === null ? '#92400e' : '#dc2626',
					borderRadius: '8px',
					border: `1px solid ${vpsUp ? '#bbf7d0' : vpsUp === null ? '#fde68a' : '#fecaca'}`
				}}>
					{vpsUp === null ? '⏳' : vpsUp ? '🟢' : '🔴'} VPS {vpsUp === null ? 'Checking...' : vpsUp ? 'Connected' : 'Disconnected'}
				</span>
			</div>

			{/* Error display */}
			{error && (
				<div style={{ 
					padding: '16px', 
					backgroundColor: '#fee2e2', 
					border: '1px solid #fecaca',
					borderRadius: '8px',
					marginBottom: '24px',
					color: '#dc2626'
				}}>
					⚠️ <strong>Error:</strong> {error}
					<button
						onClick={() => setError(null)}
						style={{
							marginLeft: '12px',
							padding: '4px 8px',
							backgroundColor: '#dc2626',
							color: 'white',
							border: 'none',
							borderRadius: '4px',
							fontSize: '12px',
							cursor: 'pointer'
						}}
					>
						✕
					</button>
				</div>
			)}

			{/* Job History */}
			{jobHistory.length > 0 ? (
				<div>
					{/* Stats */}
					<div style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
						gap: '16px',
						marginBottom: '24px'
					}}>
						{[
							{ label: 'Total Jobs', count: jobHistory.length, color: '#3b82f6' },
							{ label: 'Active', count: jobHistory.filter(j => ['pending', 'transcribing', 'summarizing', 'finalizing'].includes(j.status)).length, color: '#f59e0b' },
							{ label: 'Completed', count: jobHistory.filter(j => j.status === 'done').length, color: '#10b981' },
							{ label: 'Failed', count: jobHistory.filter(j => j.status === 'error').length, color: '#ef4444' }
						].map((stat, index) => (
							<div key={index} style={{
								padding: '16px',
								backgroundColor: 'white',
								border: '2px solid #e2e8f0',
								borderRadius: '12px',
								textAlign: 'center'
							}}>
								<div style={{
									fontSize: '2rem',
									fontWeight: '700',
									color: stat.color,
									marginBottom: '8px'
								}}>
									{stat.count}
								</div>
								<div style={{
									fontSize: '14px',
									color: '#64748b',
									fontWeight: '500'
								}}>
									{stat.label}
								</div>
							</div>
						))}
					</div>

					{/* Job List */}
					<div style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '16px'
					}}>
						{jobHistory.map((job) => (
							<div key={job.id} style={{
								padding: '20px',
								backgroundColor: 'white',
								border: '2px solid #e2e8f0',
								borderRadius: '12px',
								transition: 'all 0.2s ease'
							}}>
								{/* Job Header */}
								<div style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'flex-start',
									marginBottom: '16px'
								}}>
									<div style={{ flex: 1 }}>
										<div style={{
											display: 'flex',
											alignItems: 'center',
											gap: '12px',
											marginBottom: '8px'
										}}>
											<span style={{
												fontSize: '18px'
											}}>
												{getStatusIcon(job.status)}
											</span>
											<span style={{
												fontSize: '16px',
												fontWeight: '600',
												color: '#1e293b'
											}}>
												Job #{job.id.slice(0, 8)}
											</span>
											<span style={{
												padding: '4px 12px',
												backgroundColor: getStatusColor(job.status),
												color: 'white',
												borderRadius: '20px',
												fontSize: '12px',
												fontWeight: '600',
												textTransform: 'capitalize'
											}}>
												{job.status}
											</span>
										</div>
										
										<div style={{
											fontSize: '14px',
											color: '#64748b',
											marginBottom: '8px'
										}}>
											{job.message}
										</div>
										
										<div style={{
											fontSize: '12px',
											color: '#94a3b8'
										}}>
											Created: {formatDate(job.createdAt)} • 
											Updated: {formatDate(job.updatedAt)}
											{job.eta && ` • ETA: ${formatDuration(job.eta)}`}
										</div>
									</div>
									
									{/* Action Buttons */}
									<div style={{
										display: 'flex',
										gap: '8px',
										flexDirection: 'column'
									}}>
										{job.canGoBack && (
											<button
												onClick={() => handleGoBackToJob(job)}
												style={{
													padding: '8px 16px',
													backgroundColor: '#10b981',
													color: 'white',
													border: 'none',
													borderRadius: '6px',
													fontSize: '12px',
													fontWeight: '600',
													cursor: 'pointer',
													transition: 'all 0.2s ease'
												}}
												onMouseEnter={(e) => {
													e.currentTarget.style.backgroundColor = '#059669'
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.backgroundColor = '#10b981'
												}}
											>
												↩️ Go Back
											</button>
										)}
										
										{['pending', 'transcribing', 'summarizing', 'finalizing'].includes(job.status) && (
											<button
												onClick={() => handleCancelJob(job.id)}
												disabled={loading}
												style={{
													padding: '8px 16px',
													backgroundColor: '#ef4444',
													color: 'white',
													border: 'none',
													borderRadius: '6px',
													fontSize: '12px',
													fontWeight: '600',
													cursor: loading ? 'not-allowed' : 'pointer',
													transition: 'all 0.2s ease',
													opacity: loading ? 0.6 : 1
												}}
												onMouseEnter={(e) => {
													if (!loading) {
														e.currentTarget.style.backgroundColor = '#dc2626'
													}
												}}
												onMouseLeave={(e) => {
													if (!loading) {
														e.currentTarget.style.backgroundColor = '#ef4444'
													}
												}}
											>
												⏹️ Cancel
											</button>
										)}
									</div>
								</div>

								{/* Progress Bar */}
								{['pending', 'transcribing', 'summarizing', 'finalizing'].includes(job.status) && (
									<div style={{
										marginTop: '16px'
									}}>
										<div style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											marginBottom: '8px'
										}}>
											<span style={{
												fontSize: '14px',
												fontWeight: '500',
												color: '#374151'
											}}>
												Progress
											</span>
											<span style={{
												fontSize: '14px',
												fontWeight: '600',
												color: '#3b82f6'
											}}>
												{Math.round(job.progress)}%
											</span>
										</div>
										<div style={{
											width: '100%',
											height: '8px',
											backgroundColor: '#e5e7eb',
											borderRadius: '4px',
											overflow: 'hidden'
										}}>
											<div style={{
												width: `${job.progress}%`,
												height: '100%',
												backgroundColor: '#3b82f6',
												transition: 'width 0.3s ease'
											}} />
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			) : (
				/* Empty State */
				<div style={{
					padding: '60px 40px',
					textAlign: 'center',
					backgroundColor: '#f8fafc',
					border: '2px dashed #d1d5db',
					borderRadius: '12px'
				}}>
					<div style={{
						fontSize: '4rem',
						marginBottom: '16px'
					}}>
						📋
					</div>
					<h3 style={{
						margin: '0 0 16px 0',
						fontSize: '1.5rem',
						fontWeight: '600',
						color: '#374151'
					}}>
						No Jobs Yet
					</h3>
					<p style={{
						margin: '0',
						fontSize: '1rem',
						color: '#64748b',
						maxWidth: '400px',
						marginLeft: 'auto',
						marginRight: 'auto',
						lineHeight: '1.6'
					}}>
						When you submit audio files for transcription or summarization, your jobs will appear here. 
						You can track progress and go back to completed work.
					</p>
				</div>
			)}

			{/* Selected Job Details Modal */}
			{selectedJob && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000
				}}>
					<div style={{
						backgroundColor: 'white',
						borderRadius: '12px',
						padding: '24px',
						maxWidth: '600px',
						width: '90%',
						maxHeight: '80vh',
						overflow: 'auto'
					}}>
						<div style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: '20px'
						}}>
							<h3 style={{
								margin: 0,
								fontSize: '1.5rem',
								fontWeight: '600',
								color: '#1e293b'
							}}>
								Job Details
							</h3>
							<button
								onClick={() => setSelectedJob(null)}
								style={{
									padding: '8px',
									backgroundColor: '#f3f4f6',
									border: 'none',
									borderRadius: '6px',
									cursor: 'pointer',
									fontSize: '18px',
									color: '#6b7280'
								}}
							>
								✕
							</button>
						</div>
						
						<div style={{
							marginBottom: '20px'
						}}>
							<strong>Job ID:</strong> {selectedJob.id}
						</div>
						
						<div style={{
							marginBottom: '20px'
						}}>
							<strong>Status:</strong> {selectedJob.status}
						</div>
						
						<div style={{
							marginBottom: '20px'
						}}>
							<strong>Message:</strong> {selectedJob.message}
						</div>
						
						<div style={{
							marginBottom: '20px'
						}}>
							<strong>Created:</strong> {selectedJob.createdAt.toLocaleString()}
						</div>
						
						<div style={{
							marginBottom: '20px'
						}}>
							<strong>Last Updated:</strong> {selectedJob.updatedAt.toLocaleString()}
						</div>
						
						{selectedJob.eta && (
							<div style={{
								marginBottom: '20px'
							}}>
								<strong>Estimated Time Remaining:</strong> {formatDuration(selectedJob.eta)}
							</div>
						)}
						
						<div style={{
							display: 'flex',
							gap: '12px',
							justifyContent: 'flex-end'
						}}>
							<button
								onClick={() => setSelectedJob(null)}
								style={{
									padding: '12px 24px',
									backgroundColor: '#6b7280',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '600',
									cursor: 'pointer'
								}}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}


