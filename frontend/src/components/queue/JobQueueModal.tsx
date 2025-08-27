// Job Queue Modal Component

import React from 'react'
import { JobHistoryItem } from '../../stores/jobQueueManager'
import { formatDuration } from './JobQueueUtils'

interface JobQueueModalProps {
	job: JobHistoryItem | null
	onClose: () => void
}

export default function JobQueueModal({ job, onClose }: JobQueueModalProps) {
	if (!job) return null

	return (
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
						onClick={onClose}
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
					<strong>Job ID:</strong> {job.id}
				</div>
				
				<div style={{
					marginBottom: '20px'
				}}>
					<strong>Status:</strong> {job.status}
				</div>
				
				<div style={{
					marginBottom: '20px'
				}}>
					<strong>Message:</strong> {job.message}
				</div>
				
				<div style={{
					marginBottom: '20px'
				}}>
					<strong>Created:</strong> {job.createdAt.toLocaleString()}
				</div>
				
				<div style={{
					marginBottom: '20px'
				}}>
					<strong>Last Updated:</strong> {job.updatedAt.toLocaleString()}
				</div>
				
				{job.eta && (
					<div style={{
						marginBottom: '20px'
					}}>
						<strong>Estimated Time Remaining:</strong> {formatDuration(job.eta)}
					</div>
				)}
				
				<div style={{
					display: 'flex',
					gap: '12px',
					justifyContent: 'flex-end'
				}}>
					<button
						onClick={onClose}
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
	)
}
