import { useState, useEffect } from 'react'
import { 
	submitQueueTranscription, 
	submitQueueSummarization, 
	getQueueTaskStatus, 
	getQueueTaskResult,
	getQueueStats,
	type QueueStats 
} from '../../services'

interface QueueProcessorProps {
	online: boolean
	vpsUp: boolean | null
}

interface QueueTask {
	id: string
	type: 'transcription' | 'summarization'
	fileName?: string
	status: 'pending' | 'running' | 'completed' | 'failed'
	result?: any
	error?: string
	submittedAt: Date
	completedAt?: Date
}

export default function QueueProcessor({ online, vpsUp }: QueueProcessorProps) {
	const [tasks, setTasks] = useState<QueueTask[]>([])
	const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [textInput, setTextInput] = useState('')
	const [language, setLanguage] = useState<'tr' | 'en'>('tr')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Auto-refresh queue stats and task statuses
	useEffect(() => {
		if (!online || !vpsUp) return

		const refreshData = async () => {
			try {
				// Load queue stats
				const stats = await getQueueStats().catch(() => null)
				setQueueStats(stats)

				// Update task statuses
				const updatedTasks = await Promise.all(
					tasks.map(async (task) => {
						if (task.status === 'pending' || task.status === 'running') {
							try {
								const status = await getQueueTaskStatus(task.id)
								if (status.status === 'completed') {
									const result = await getQueueTaskResult(task.id)
									return {
										...task,
										status: 'completed' as const,
										result,
										completedAt: new Date()
									}
								} else if (status.status === 'failed') {
									return {
										...task,
										status: 'failed' as const,
										error: status.error || 'Task failed',
										completedAt: new Date()
									}
								} else {
									return {
										...task,
										status: status.status === 'running' ? 'running' as const : 'pending' as const
									}
								}
							} catch (err) {
								return task // Keep existing status if can't fetch
							}
						}
						return task
					})
				)
				setTasks(updatedTasks)
			} catch (err) {
				console.error('Failed to refresh queue data:', err)
			}
		}

		refreshData()
		// Increased interval to 15 seconds (from 5 seconds) to reduce API calls
		const interval = setInterval(refreshData, 15000)
		return () => clearInterval(interval)
	}, [online, vpsUp, tasks.length])

	const handleFileTranscription = async () => {
		if (!selectedFile || !online || !vpsUp) return

		try {
			setSubmitting(true)
			setError(null)
			const response = await submitQueueTranscription(selectedFile, language)
			
			const newTask: QueueTask = {
				id: response.task_id,
				type: 'transcription',
				fileName: selectedFile.name,
				status: 'pending',
				submittedAt: new Date()
			}
			
			setTasks(prev => [newTask, ...prev])
			setSelectedFile(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to submit transcription')
		} finally {
			setSubmitting(false)
		}
	}

	const handleTextSummarization = async () => {
		if (!textInput.trim() || !online || !vpsUp) return

		try {
			setSubmitting(true)
			setError(null)
			const response = await submitQueueSummarization(textInput)
			
			const newTask: QueueTask = {
				id: response.task_id,
				type: 'summarization',
				status: 'pending',
				submittedAt: new Date()
			}
			
			setTasks(prev => [newTask, ...prev])
			setTextInput('')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to submit summarization')
		} finally {
			setSubmitting(false)
		}
	}

	const clearCompletedTasks = () => {
		setTasks(prev => prev.filter(task => task.status !== 'completed'))
	}

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'pending': return '⏳'
			case 'running': return '⚡'
			case 'completed': return '✅'
			case 'failed': return '❌'
			default: return '❓'
		}
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pending': return '#f59e0b'
			case 'running': return '#3b82f6'
			case 'completed': return '#10b981'
			case 'failed': return '#ef4444'
			default: return '#6b7280'
		}
	}

	if (!online || !vpsUp) {
		return (
			<div className="queue-processor offline">
				<h3>📤 Queue Processing</h3>
				<div style={{ 
					padding: '20px', 
					textAlign: 'center', 
					color: '#666',
					backgroundColor: '#f5f5f5',
					borderRadius: '8px'
				}}>
					<div style={{ fontSize: '24px', marginBottom: '8px' }}>🔌</div>
					<div>Queue processing unavailable - system offline</div>
				</div>
			</div>
		)
	}

	return (
		<div className="queue-processor">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<h3>📤 Queue Processing</h3>
				{queueStats && (
					<div style={{ fontSize: '12px', color: '#666' }}>
						🔄 {queueStats.active_tasks} active • ⏳ {queueStats.pending_tasks} pending • 👷 {queueStats.workers_running} workers
					</div>
				)}
			</div>

			{error && (
				<div style={{ 
					color: '#ef4444', 
					backgroundColor: '#fef2f2', 
					padding: '8px 12px', 
					borderRadius: '4px',
					marginBottom: '16px',
					fontSize: '14px'
				}}>
					⚠️ {error}
				</div>
			)}

			{/* File Transcription */}
			<div style={{ 
				backgroundColor: 'white',
				border: '1px solid #e2e8f0',
				borderRadius: '8px',
				padding: '16px',
				marginBottom: '16px'
			}}>
				<h4 style={{ marginBottom: '12px' }}>🎙️ Audio Transcription</h4>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
					<input
						type="file"
						accept="audio/*"
						onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
						style={{ flex: 1 }}
					/>
					<select
						value={language}
						onChange={(e) => setLanguage(e.target.value as 'tr' | 'en')}
						style={{ 
							padding: '6px 8px',
							border: '1px solid #d1d5db',
							borderRadius: '4px'
						}}
					>
						<option value="en">English</option>
						<option value="tr">Turkish</option>
					</select>
					<button
						onClick={handleFileTranscription}
						disabled={!selectedFile || submitting}
						style={{
							padding: '8px 16px',
							backgroundColor: selectedFile && !submitting ? '#3b82f6' : '#9ca3af',
							color: 'white',
							border: 'none',
							borderRadius: '4px',
							cursor: selectedFile && !submitting ? 'pointer' : 'not-allowed'
						}}
					>
						{submitting ? '⏳ Submitting...' : '📤 Queue'}
					</button>
				</div>
				{selectedFile && (
					<div style={{ fontSize: '12px', color: '#666' }}>
						Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
					</div>
				)}
			</div>

			{/* Text Summarization */}
			<div style={{ 
				backgroundColor: 'white',
				border: '1px solid #e2e8f0',
				borderRadius: '8px',
				padding: '16px',
				marginBottom: '16px'
			}}>
				<h4 style={{ marginBottom: '12px' }}>📝 Text Summarization</h4>
				<div style={{ marginBottom: '12px' }}>
					<textarea
						value={textInput}
						onChange={(e) => setTextInput(e.target.value)}
						placeholder="Enter text to summarize..."
						style={{
							width: '100%',
							minHeight: '80px',
							padding: '8px',
							border: '1px solid #d1d5db',
							borderRadius: '4px',
							resize: 'vertical'
						}}
					/>
				</div>
				<button
					onClick={handleTextSummarization}
					disabled={!textInput.trim() || submitting}
					style={{
						padding: '8px 16px',
						backgroundColor: textInput.trim() && !submitting ? '#10b981' : '#9ca3af',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: textInput.trim() && !submitting ? 'pointer' : 'not-allowed'
					}}
				>
					{submitting ? '⏳ Submitting...' : '📤 Queue Summarization'}
				</button>
			</div>

			{/* Task List */}
			<div style={{ 
				backgroundColor: 'white',
				border: '1px solid #e2e8f0',
				borderRadius: '8px',
				padding: '16px'
			}}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
					<h4>📋 Queue Tasks ({tasks.length})</h4>
					{tasks.some(t => t.status === 'completed') && (
						<button
							onClick={clearCompletedTasks}
							style={{
								padding: '4px 8px',
								fontSize: '12px',
								backgroundColor: '#f3f4f6',
								border: '1px solid #d1d5db',
								borderRadius: '4px',
								cursor: 'pointer'
							}}
						>
							🗑️ Clear Completed
						</button>
					)}
				</div>

				{tasks.length === 0 ? (
					<div style={{ 
						textAlign: 'center', 
						color: '#6b7280', 
						padding: '20px',
						fontStyle: 'italic'
					}}>
						No tasks in queue. Submit a file or text above to get started!
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{tasks.map(task => (
							<div
								key={task.id}
								style={{
									padding: '12px',
									border: '1px solid #e5e7eb',
									borderRadius: '6px',
									backgroundColor: '#f9fafb'
								}}
							>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ fontSize: '16px' }}>
											{task.type === 'transcription' ? '🎙️' : '📝'}
										</span>
										<span style={{ fontWeight: '600', fontSize: '14px' }}>
											{task.type === 'transcription' ? 'Transcription' : 'Summarization'}
										</span>
										{task.fileName && (
											<span style={{ fontSize: '12px', color: '#6b7280' }}>
												{task.fileName}
											</span>
										)}
									</div>
									<div style={{ 
										display: 'flex', 
										alignItems: 'center', 
										gap: '4px',
										color: getStatusColor(task.status),
										fontSize: '12px',
										fontWeight: '600'
									}}>
										{getStatusIcon(task.status)} {task.status.toUpperCase()}
									</div>
								</div>
								<div style={{ fontSize: '11px', color: '#6b7280' }}>
									Submitted: {task.submittedAt.toLocaleString()}
									{task.completedAt && ` • Completed: ${task.completedAt.toLocaleString()}`}
								</div>
								{task.error && (
									<div style={{ 
										fontSize: '12px', 
										color: '#ef4444', 
										marginTop: '4px',
										padding: '4px 8px',
										backgroundColor: '#fef2f2',
										borderRadius: '4px'
									}}>
										Error: {task.error}
									</div>
								)}
								{task.result && (
									<div style={{ 
										fontSize: '12px', 
										marginTop: '8px',
										padding: '8px',
										backgroundColor: '#f0fdf4',
										border: '1px solid #bbf7d0',
										borderRadius: '4px',
										maxHeight: '100px',
										overflow: 'auto'
									}}>
										<strong>Result:</strong>
										<pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', fontSize: '11px' }}>
											{JSON.stringify(task.result, null, 2)}
										</pre>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
