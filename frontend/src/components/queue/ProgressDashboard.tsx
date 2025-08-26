import { useState, useEffect } from 'react'
import { getProgressStats, getQueueStats, type ProgressStats, type QueueStats } from '../../services'
import { usePageVisibility } from '../../hooks/usePageVisibility'

interface ProgressDashboardProps {
	online: boolean
	vpsUp: boolean | null
}

export default function ProgressDashboard({ online, vpsUp }: ProgressDashboardProps) {
	const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
	const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
	const isPageVisible = usePageVisibility()

	const loadStats = async () => {
		if (!online || !vpsUp) return

		try {
			setLoading(true)
			setError(null)
			
			const [progress, queue] = await Promise.all([
				getProgressStats().catch(() => null),
				getQueueStats().catch(() => null)
			])
			
			setProgressStats(progress)
			setQueueStats(queue)
			setLastUpdate(new Date())
		} catch (err) {
			console.error('Failed to load stats:', err)
			setError('Failed to load statistics')
		} finally {
			setLoading(false)
		}
	}

	// Auto-refresh every 30 seconds (reduced from 10 seconds)
	// Only poll when component is visible and VPS is up
	useEffect(() => {
		if (!online || !vpsUp || !isPageVisible) return

		// Initial load
		loadStats()
		
		// Set up interval with reduced frequency
		const interval = setInterval(() => {
			// Only load stats if page is still visible
			if (isPageVisible) {
				loadStats()
			}
		}, 30000)
		return () => clearInterval(interval)
	}, [online, vpsUp, isPageVisible])

	const formatDuration = (seconds: number) => {
		if (seconds < 60) return `${Math.round(seconds)}s`
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`
		return `${Math.round(seconds / 3600)}h`
	}

	const StatCard = ({ 
		title, 
		value, 
		icon, 
		color = '#1976d2',
		subtitle 
	}: { 
		title: string
		value: string | number
		icon: string
		color?: string
		subtitle?: string
	}) => (
		<div 
			className="stat-card"
			style={{
				background: 'white',
				border: `2px solid ${color}20`,
				borderRadius: '8px',
				padding: '16px',
				textAlign: 'center',
				minWidth: '120px'
			}}
		>
			<div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
			<div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</div>
			<div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>{title}</div>
			{subtitle && (
				<div style={{ fontSize: '10px', color: '#999' }}>{subtitle}</div>
			)}
		</div>
	)

	if (!online || !vpsUp) {
		return (
			<div className="progress-dashboard offline">
				<h3>📈 System Statistics</h3>
				<div style={{ 
					padding: '20px', 
					textAlign: 'center', 
					color: '#666',
					backgroundColor: '#f5f5f5',
					borderRadius: '8px'
				}}>
					<div style={{ fontSize: '24px', marginBottom: '8px' }}>🔌</div>
					<div>Statistics unavailable - system offline</div>
				</div>
			</div>
		)
	}

	return (
		<div className="progress-dashboard">
			<div style={{ 
				display: 'flex', 
				justifyContent: 'space-between', 
				alignItems: 'center',
				marginBottom: '16px'
			}}>
				<h3>📈 System Statistics</h3>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{lastUpdate && (
						<span style={{ fontSize: '11px', color: '#666' }}>
							Last updated: {lastUpdate.toLocaleTimeString()}
						</span>
					)}
					<button
						onClick={loadStats}
						disabled={loading}
						style={{
							padding: '4px 8px',
							fontSize: '11px',
							backgroundColor: '#f5f5f5',
							border: '1px solid #ddd',
							borderRadius: '4px',
							cursor: loading ? 'not-allowed' : 'pointer'
						}}
					>
						{loading ? '⟲' : '🔄'}
					</button>
				</div>
			</div>

			{error && (
				<div style={{ 
					color: '#ff6b6b', 
					backgroundColor: '#ffebee', 
					padding: '8px', 
					borderRadius: '4px',
					marginBottom: '16px',
					fontSize: '12px'
				}}>
					⚠️ {error}
				</div>
			)}

			{/* Progress Statistics */}
			{progressStats && (
				<div style={{ marginBottom: '24px' }}>
					<h4 style={{ marginBottom: '12px', color: '#333' }}>🎯 Job Progress</h4>
					<div style={{ 
						display: 'grid', 
						gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
						gap: '12px',
						marginBottom: '12px'
					}}>
						<StatCard
							title="Total Jobs"
							value={progressStats.total_jobs}
							icon="📊"
							color="#2196f3"
						/>
						<StatCard
							title="Completed"
							value={progressStats.completed_jobs}
							icon="✅"
							color="#4caf50"
						/>
						<StatCard
							title="Running"
							value={progressStats.running_jobs}
							icon="⚡"
							color="#ff9800"
						/>
						<StatCard
							title="Failed"
							value={progressStats.failed_jobs}
							icon="❌"
							color="#f44336"
						/>
						<StatCard
							title="Avg Time"
							value={formatDuration(progressStats.average_completion_time)}
							icon="⏱️"
							color="#9c27b0"
							subtitle="per job"
						/>
					</div>
					
					{/* Progress Bar */}
					{progressStats.total_jobs > 0 && (
						<div style={{ marginTop: '8px' }}>
							<div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
								Success Rate: {Math.round((progressStats.completed_jobs / progressStats.total_jobs) * 100)}%
							</div>
							<div style={{ 
								backgroundColor: '#f0f0f0', 
								borderRadius: '4px', 
								height: '6px',
								overflow: 'hidden'
							}}>
								<div style={{
									backgroundColor: '#4caf50',
									height: '100%',
									width: `${(progressStats.completed_jobs / progressStats.total_jobs) * 100}%`,
									transition: 'width 0.3s ease'
								}} />
							</div>
						</div>
					)}
				</div>
			)}

			{/* Queue Statistics */}
			{queueStats && (
				<div>
					<h4 style={{ marginBottom: '12px', color: '#333' }}>📤 Queue Status</h4>
					<div style={{ 
						display: 'grid', 
						gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
						gap: '12px'
					}}>
						<StatCard
							title="Active Tasks"
							value={queueStats.active_tasks}
							icon="🔄"
							color="#ff9800"
						/>
						<StatCard
							title="Pending"
							value={queueStats.pending_tasks}
							icon="⏳"
							color="#2196f3"
						/>
						<StatCard
							title="Workers"
							value={queueStats.workers_running}
							icon="👷"
							color="#4caf50"
						/>
						<StatCard
							title="Completed"
							value={queueStats.completed_tasks}
							icon="✅"
							color="#4caf50"
						/>
						<StatCard
							title="Failed"
							value={queueStats.failed_tasks}
							icon="❌"
							color="#f44336"
						/>
					</div>

					{/* Queue Health Indicator */}
					<div style={{ marginTop: '12px', textAlign: 'center' }}>
						<div style={{ 
							display: 'inline-flex', 
							alignItems: 'center', 
							gap: '6px',
							padding: '6px 12px',
							backgroundColor: queueStats.workers_running > 0 ? '#e8f5e8' : '#ffebee',
							color: queueStats.workers_running > 0 ? '#2e7d32' : '#c62828',
							borderRadius: '12px',
							fontSize: '12px'
						}}>
							{queueStats.workers_running > 0 ? '🟢' : '🔴'}
							Queue System {queueStats.workers_running > 0 ? 'Active' : 'Inactive'}
						</div>
					</div>
				</div>
			)}

			{!progressStats && !queueStats && !loading && (
				<div style={{ 
					textAlign: 'center', 
					color: '#666',
					padding: '40px 20px',
					backgroundColor: '#f9f9f9',
					borderRadius: '8px'
				}}>
					<div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
					<div>No statistics available</div>
					<div style={{ fontSize: '12px', marginTop: '4px' }}>
						Start processing some files to see metrics!
					</div>
				</div>
			)}
		</div>
	)
}
