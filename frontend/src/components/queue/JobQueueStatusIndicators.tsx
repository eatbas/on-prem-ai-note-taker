// Job Queue Status Indicators Component

import React from 'react'

interface JobQueueStatusIndicatorsProps {
	online: boolean
	vpsUp: boolean | null
}

export default function JobQueueStatusIndicators({ online, vpsUp }: JobQueueStatusIndicatorsProps) {
	return (
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
	)
}
