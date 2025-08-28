// Job Queue Item Component

import React from 'react'
import { JobHistoryItem } from '../../stores/jobQueueManager'
import { getStatusColor, getStatusIcon, formatDate, formatDuration } from './JobQueueUtils'

interface JobQueueItemProps {
	job: JobHistoryItem
	loading: boolean
	onCancelJob: (jobId: string) => void
	onGoBackToJob: (job: JobHistoryItem) => void
}

export default function JobQueueItem({ job, loading, onCancelJob, onGoBackToJob }: JobQueueItemProps) {
	return (
		<div style={{
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
							{job.meetingTitle ? job.meetingTitle : `Job ${job.id.slice(0, 8)}...`}
						</span>
						<span style={{
							padding: '4px 12px',
							backgroundColor: getStatusColor(job.status),
							color: 'white',
							borderRadius: '16px',
							fontSize: '12px',
							fontWeight: '600',
							textTransform: 'uppercase'
						}}>
							{job.status}
						</span>
					</div>
					<div style={{
						fontSize: '14px',
						color: '#64748b',
						marginBottom: '8px'
					}}>
						{formatDate(job.createdAt)}
					</div>
					{job.message && (
						<div style={{
							fontSize: '14px',
							color: '#374151',
							fontStyle: 'italic'
						}}>
							{job.message}
						</div>
					)}
				</div>
			</div>

			{/* Progress Bar */}
			{job.progress !== undefined && job.progress >= 0 && (
				<div style={{
					marginBottom: '16px'
				}}>
					<div style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '8px'
					}}>
						<span style={{
							fontSize: '12px',
							fontWeight: '500',
							color: '#64748b'
						}}>
							Progress
						</span>
						<span style={{
							fontSize: '12px',
							fontWeight: '600',
							color: '#1e293b'
						}}>
							{Math.round(job.progress)}%
						</span>
					</div>
					<div style={{
						width: '100%',
						height: '8px',
						backgroundColor: '#e2e8f0',
						borderRadius: '4px',
						overflow: 'hidden'
					}}>
						<div style={{
							width: `${job.progress}%`,
							height: '100%',
							backgroundColor: getStatusColor(job.status),
							transition: 'width 0.3s ease',
							borderRadius: '4px'
						}} />
					</div>
				</div>
			)}

			{/* ETA */}
			{job.eta && job.eta > 0 && (
				<div style={{
					fontSize: '12px',
					color: '#64748b',
					marginBottom: '16px'
				}}>
					⏱️ Estimated time remaining: {formatDuration(job.eta)}
				</div>
			)}

			{/* Actions */}
			<div style={{
				display: 'flex',
				gap: '12px',
				justifyContent: 'flex-end'
			}}>
				{['pending', 'uploading', 'waiting', 'transcribing', 'summarizing', 'finalizing'].includes(job.status) && (
					<button
						onClick={() => onCancelJob(job.id)}
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
							opacity: loading ? 0.6 : 1,
							transition: 'all 0.2s ease'
						}}
					>
						{loading ? '⏳' : '⏹️'} Cancel
					</button>
				)}
				
				{job.canGoBack && (
					<button
						onClick={() => onGoBackToJob(job)}
						style={{
							padding: '8px 16px',
							backgroundColor: '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							fontSize: '12px',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.2s ease'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#2563eb'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#3b82f6'
						}}
					>
						👀 View Details
					</button>
				)}
			</div>
		</div>
	)
}
