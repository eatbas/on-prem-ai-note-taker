// Job Queue Statistics Component

import React from 'react'
import { JobHistoryItem } from '../../stores/jobQueueManager'
import { isJobActive } from './JobQueueUtils'

interface JobQueueStatsProps {
	jobHistory: JobHistoryItem[]
}

export default function JobQueueStats({ jobHistory }: JobQueueStatsProps) {
	const stats = [
		{ label: 'Total Jobs', count: jobHistory.length, color: '#3b82f6' },
		{ 
			label: 'Active', 
			count: jobHistory.filter(j => isJobActive(j.status)).length, 
			color: '#f59e0b' 
		},
		{ 
			label: 'Completed', 
			count: jobHistory.filter(j => j.status === 'done' || j.status === 'completed').length, 
			color: '#10b981' 
		},
		{ 
			label: 'Failed', 
			count: jobHistory.filter(j => j.status === 'error' || j.status === 'failed').length, 
			color: '#ef4444' 
		}
	]

	return (
		<div style={{
			display: 'grid',
			gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
			gap: '16px',
			marginBottom: '24px'
		}}>
			{stats.map((stat, index) => (
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
	)
}
