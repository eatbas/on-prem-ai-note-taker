// Job Queue Error Display Component

import React from 'react'

interface JobQueueErrorDisplayProps {
	error: string | null
	onDismiss: () => void
}

export default function JobQueueErrorDisplay({ error, onDismiss }: JobQueueErrorDisplayProps) {
	if (!error) return null

	return (
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
				onClick={onDismiss}
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
	)
}
