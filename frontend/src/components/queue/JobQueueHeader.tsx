// Job Queue Header Component

import React from 'react'

interface JobQueueHeaderProps {
	jobCount: number
	onClearHistory: () => void
}

export default function JobQueueHeader({ jobCount, onClearHistory }: JobQueueHeaderProps) {
	return (
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
			
			{jobCount > 0 && (
				<button
					onClick={onClearHistory}
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
	)
}
