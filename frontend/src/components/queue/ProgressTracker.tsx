import React, { useEffect, useState } from 'react'
import { JobStatusResponse, createJobProgressStream } from '../../services'

interface ProgressTrackerProps {
	jobId: string
	onComplete?: (result: any) => void
	onError?: (error: string) => void
	onCancel?: () => void
}

interface ProgressState {
	status: string
	progress_percent: number
	current_phase: string
	phase_progress: number
	estimated_remaining_seconds?: number
	message: string
}

export default function ProgressTracker({ 
	jobId, 
	onComplete, 
	onError, 
	onCancel 
}: ProgressTrackerProps) {
	const [progress, setProgress] = useState<ProgressState | null>(null)
	const [isStreaming, setIsStreaming] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let eventSource: EventSource | null = null

		const startProgressStream = async () => {
			try {
				setIsStreaming(true)
				setError(null)

				eventSource = createJobProgressStream(jobId)

				eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data)
						
						if (data.error) {
							setError(data.error)
							onError?.(data.error)
							return
						}

						const progressData: ProgressState = {
							status: data.status || 'unknown',
							progress_percent: data.progress_percent || 0,
							current_phase: data.current_phase || 'unknown',
							phase_progress: data.phase_progress || 0,
							estimated_remaining_seconds: data.estimated_remaining_seconds,
							message: data.message || ''
						}

						setProgress(progressData)

						// Check if job is completed
						if (data.status === 'completed' && data.result_data) {
							onComplete?.(data.result_data)
						} else if (data.status === 'failed') {
							setError(data.error_message || 'Job failed')
							onError?.(data.error_message || 'Job failed')
						} else if (data.status === 'cancelled') {
							setError('Job was cancelled')
							onError?.('Job was cancelled')
						}
					} catch (parseError) {
						console.error('Failed to parse progress data:', parseError)
					}
				}

				eventSource.onerror = (event) => {
					console.error('EventSource error:', event)
					setError('Connection error - progress updates may be delayed')
				}

			} catch (err) {
				console.error('Failed to start progress stream:', err)
				setError('Failed to start progress tracking')
				onError?.('Failed to start progress tracking')
			}
		}

		startProgressStream()

		return () => {
			if (eventSource) {
				eventSource.close()
			}
			setIsStreaming(false)
		}
	}, [jobId, onComplete, onError])

	const formatTime = (seconds?: number): string => {
		if (!seconds || seconds <= 0) return '--:--'
		
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = Math.floor(seconds % 60)
		return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
	}

	const getPhaseColor = (phase: string): string => {
		switch (phase.toLowerCase()) {
			case 'initializing':
				return '#3b82f6' // blue
			case 'transcribing':
				return '#10b981' // green
			case 'summarizing':
				return '#f59e0b' // amber
			case 'finalizing':
				return '#8b5cf6' // purple
			default:
				return '#6b7280' // gray
		}
	}

	const getStatusColor = (status: string): string => {
		switch (status.toLowerCase()) {
			case 'pending':
				return '#6b7280' // gray
			case 'processing':
				return '#3b82f6' // blue
			case 'completed':
				return '#10b981' // green
			case 'failed':
				return '#ef4444' // red
			case 'cancelled':
				return '#f59e0b' // amber
			default:
				return '#6b7280' // gray
		}
	}

	if (error) {
		return (
			<div style={{
				padding: '16px',
				border: '1px solid #ef4444',
				borderRadius: '8px',
				backgroundColor: '#fef2f2',
				color: '#dc2626'
			}}>
				<strong>Error:</strong> {error}
			</div>
		)
	}

	if (!progress) {
		return (
			<div style={{
				padding: '16px',
				textAlign: 'center',
				color: '#6b7280'
			}}>
				{isStreaming ? 'Connecting to progress stream...' : 'Loading...'}
			</div>
		)
	}

	return (
		<div style={{
			padding: '20px',
			border: '1px solid #e5e7eb',
			borderRadius: '12px',
			backgroundColor: 'white',
			boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
		}}>
			{/* Job Status Header */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				marginBottom: '20px'
			}}>
				<div>
					<h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>
						Job Progress
					</h3>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px'
					}}>
						<span style={{
							padding: '4px 8px',
							borderRadius: '12px',
							fontSize: '12px',
							fontWeight: '500',
							backgroundColor: getStatusColor(progress.status) + '20',
							color: getStatusColor(progress.status)
						}}>
							{progress.status.toUpperCase()}
						</span>
						<span style={{ color: '#6b7280', fontSize: '14px' }}>
							{progress.current_phase}
						</span>
					</div>
				</div>
				
				{progress.estimated_remaining_seconds !== undefined && (
					<div style={{ textAlign: 'right' }}>
						<div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
							Estimated Time Remaining
						</div>
						<div style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>
							{formatTime(progress.estimated_remaining_seconds)}
						</div>
					</div>
				)}
			</div>

			{/* Overall Progress Bar */}
			<div style={{ marginBottom: '20px' }}>
				<div style={{
					display: 'flex',
					justifyContent: 'space-between',
					marginBottom: '8px'
				}}>
					<span style={{ fontSize: '14px', fontWeight: '500' }}>Overall Progress</span>
					<span style={{ fontSize: '14px', color: '#6b7280' }}>
						{Math.round(progress.progress_percent)}%
					</span>
				</div>
				<div style={{
					width: '100%',
					height: '8px',
					backgroundColor: '#f3f4f6',
					borderRadius: '4px',
					overflow: 'hidden'
				}}>
					<div style={{
						width: `${progress.progress_percent}%`,
						height: '100%',
						backgroundColor: '#3b82f6',
						borderRadius: '4px',
						transition: 'width 0.3s ease'
					}} />
				</div>
			</div>

			{/* Phase Progress Bar */}
			<div style={{ marginBottom: '20px' }}>
				<div style={{
					display: 'flex',
					justifyContent: 'space-between',
					marginBottom: '8px'
				}}>
					<span style={{ fontSize: '14px', fontWeight: '500' }}>
						{progress.current_phase.charAt(0).toUpperCase() + progress.current_phase.slice(1)}
					</span>
					<span style={{ fontSize: '14px', color: '#6b7280' }}>
						{Math.round(progress.phase_progress)}%
					</span>
				</div>
				<div style={{
					width: '100%',
					height: '8px',
					backgroundColor: '#f3f4f6',
					borderRadius: '4px',
					overflow: 'hidden'
				}}>
					<div style={{
						width: `${progress.phase_progress}%`,
						height: '100%',
						backgroundColor: getPhaseColor(progress.current_phase),
						borderRadius: '4px',
						transition: 'width 0.3s ease'
					}} />
				</div>
			</div>

			{/* Status Message */}
			{progress.message && (
				<div style={{
					padding: '12px',
					backgroundColor: '#f8fafc',
					borderRadius: '8px',
					border: '1px solid #e2e8f0',
					fontSize: '14px',
					color: '#374151'
				}}>
					{progress.message}
				</div>
			)}

			{/* Cancel Button */}
			{progress.status === 'processing' && onCancel && (
				<div style={{ marginTop: '16px', textAlign: 'center' }}>
					<button
						onClick={onCancel}
						style={{
							padding: '8px 16px',
							border: '1px solid #ef4444',
							borderRadius: '6px',
							backgroundColor: 'white',
							color: '#ef4444',
							cursor: 'pointer',
							fontSize: '14px',
							fontWeight: '500'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#fef2f2'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'white'
						}}
					>
						Cancel Job
					</button>
				</div>
			)}
		</div>
	)
}
