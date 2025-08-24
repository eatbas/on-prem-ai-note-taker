import { useState, useRef, useEffect } from 'react'
import { 
	submitTranscribeAndSummarizeJob, 
	getJobStatus, 
	cancelJob, 
	createJobProgressStream,
	JobStatus 
} from './api'
import { useToast } from './Toast'

interface TranscribeAndSummarizeProps {
	online: boolean
	vpsUp: boolean | null
}

export default function TranscribeAndSummarize({ online, vpsUp }: TranscribeAndSummarizeProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [language, setLanguage] = useState<'auto' | 'tr' | 'en'>('auto')
	const [isProcessing, setIsProcessing] = useState(false)
	const [jobId, setJobId] = useState<string | null>(null)
	const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
	const [showProgressModal, setShowProgressModal] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const progressIntervalRef = useRef<number | null>(null)
	const eventSourceRef = useRef<EventSource | null>(null)
	const { showToast, ToastContainer } = useToast()

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
			}
			if (eventSourceRef.current) {
				eventSourceRef.current.close()
			}
		}
	}, [])

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			// Validate file type
			if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
				setError('Please select an audio or video file')
				return
			}
			setSelectedFile(file)
			setError(null)
		}
	}

	const handleSubmit = async () => {
		if (!selectedFile || !online || !vpsUp) return

		try {
			setError(null)
			setIsProcessing(true)

			// Submit the job
			const response = await submitTranscribeAndSummarizeJob(selectedFile, language)
			setJobId(response.job_id)
			setShowProgressModal(true)
			showToast('Job submitted successfully! Starting transcription...', 'success')

			// Start polling for progress
			startProgressTracking(response.job_id)

		} catch (err) {
			console.error('Failed to submit job:', err)
			const errorMessage = err instanceof Error ? err.message : 'Failed to submit job'
			setError(errorMessage)
			showToast(errorMessage, 'error')
			setIsProcessing(false)
		}
	}

	const startProgressTracking = (id: string) => {
		// Initial status fetch
		fetchJobStatus(id)

		// Set up polling interval
		progressIntervalRef.current = window.setInterval(() => {
			fetchJobStatus(id)
		}, 1000) // Poll every second

		// Set up SSE for real-time updates
		try {
			eventSourceRef.current = createJobProgressStream(id)
			eventSourceRef.current.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					setJobStatus(data)
					
					// Stop tracking if job is complete
					if (data.phase === 'done' || data.phase === 'error' || data.phase === 'canceled') {
						stopProgressTracking()
						if (data.phase === 'done') {
							// Close modal after a short delay to show success
							setTimeout(() => {
								setShowProgressModal(false)
								setIsProcessing(false)
								setJobId(null)
								setJobStatus(null)
								setSelectedFile(null)
								if (fileInputRef.current) {
									fileInputRef.current.value = ''
								}
							}, 2000)
						} else {
							setIsProcessing(false)
						}
					}
				} catch (err) {
					console.error('Failed to parse SSE data:', err)
				}
			}
			eventSourceRef.current.onerror = (err) => {
				console.error('SSE error:', err)
				// Fall back to polling only
				if (eventSourceRef.current) {
					eventSourceRef.current.close()
					eventSourceRef.current = null
				}
			}
		} catch (err) {
			console.error('Failed to create SSE stream:', err)
			// Continue with polling only
		}
	}

	const fetchJobStatus = async (id: string) => {
		try {
			const status = await getJobStatus(id)
			setJobStatus(status)
			
			// Stop tracking if job is complete
			if (status.phase === 'done' || status.phase === 'error' || status.phase === 'canceled') {
				stopProgressTracking()
				if (status.phase === 'done') {
					showToast('Transcription and summarization completed successfully!', 'success')
					// Close modal after a short delay to show success
					setTimeout(() => {
						setShowProgressModal(false)
						setIsProcessing(false)
						setJobId(null)
						setJobStatus(null)
						setSelectedFile(null)
						if (fileInputRef.current) {
							fileInputRef.current.value = ''
						}
					}, 2000)
				} else if (status.phase === 'error') {
					showToast('An error occurred during processing', 'error')
					setIsProcessing(false)
				} else if (status.phase === 'canceled') {
					showToast('Job was canceled', 'info')
					setIsProcessing(false)
				}
			}
		} catch (err) {
			console.error('Failed to fetch job status:', err)
		}
	}

	const stopProgressTracking = () => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}
		if (eventSourceRef.current) {
			eventSourceRef.current.close()
			eventSourceRef.current = null
		}
	}

	const handleCancel = async () => {
		if (!jobId) return

		try {
			await cancelJob(jobId)
			stopProgressTracking()
			setIsProcessing(false)
			setShowProgressModal(false)
			setJobId(null)
			setJobStatus(null)
			showToast('Job canceled successfully', 'info')
		} catch (err) {
			console.error('Failed to cancel job:', err)
			const errorMessage = 'Failed to cancel job'
			setError(errorMessage)
			showToast(errorMessage, 'error')
		}
	}

	const formatETA = (etaSeconds?: number): string => {
		if (!etaSeconds || etaSeconds <= 0) return '--:--'
		const minutes = Math.floor(etaSeconds / 60)
		const seconds = Math.floor(etaSeconds % 60)
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
	}

	const getPhaseProgress = (): { transcription: number; summarization: number } => {
		if (!jobStatus) return { transcription: 0, summarization: 0 }

		switch (jobStatus.phase) {
			case 'queued':
				return { transcription: 0, summarization: 0 }
			case 'transcribing':
				return { transcription: jobStatus.progress, summarization: 0 }
			case 'summarizing':
				return { transcription: 100, summarization: jobStatus.progress }
			case 'finalizing':
				return { transcription: 100, summarization: 95 + (jobStatus.progress - 95) * 0.2 }
			case 'done':
				return { transcription: 100, summarization: 100 }
			case 'error':
			case 'canceled':
				return { transcription: 0, summarization: 0 }
			default:
				return { transcription: 0, summarization: 0 }
		}
	}

	const getPhaseMessage = (): string => {
		if (!jobStatus) return 'Preparing...'
		
		switch (jobStatus.phase) {
			case 'queued':
				return 'Job queued, waiting to start...'
			case 'transcribing':
				return `Transcribing audio... ${Math.round(jobStatus.progress)}%`
			case 'summarizing':
				return `Generating summary... ${Math.round(jobStatus.progress)}%`
			case 'finalizing':
				return 'Finalizing summary...'
			case 'done':
				return 'Complete!'
			case 'error':
				return 'Error occurred during processing'
			case 'canceled':
				return 'Job was canceled'
			default:
				return 'Processing...'
		}
	}

	const canSubmit = selectedFile && online && vpsUp && !isProcessing

	return (
		<div style={{ padding: '24px 0' }}>
			<ToastContainer />
			<div style={{ 
				textAlign: 'center', 
				marginBottom: '32px',
				padding: '24px',
				backgroundColor: '#f8fafc',
				borderRadius: '12px',
				border: '2px solid #e2e8f0'
			}}>
				<h2 style={{
					margin: '0 0 16px 0',
					fontSize: '1.8rem',
					fontWeight: '600',
					color: '#1e293b'
				}}>
					🎵 Transcribe & Summarize Audio
				</h2>
				<p style={{
					margin: '0 0 24px 0',
					color: '#64748b',
					fontSize: '16px',
					lineHeight: '1.6'
				}}>
					Upload an audio or video file to transcribe and generate an AI summary. 
					Perfect for meetings, interviews, and presentations.
				</p>

				{/* File Upload */}
				<div style={{ marginBottom: '24px' }}>
					<input
						ref={fileInputRef}
						type="file"
						accept="audio/*,video/*"
						onChange={handleFileSelect}
						style={{ display: 'none' }}
					/>
					<button
						onClick={() => fileInputRef.current?.click()}
						style={{
							padding: '16px 32px',
							backgroundColor: '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							fontSize: '16px',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							margin: '0 auto'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#2563eb'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#3b82f6'
						}}
					>
						📁 Select Audio/Video File
					</button>
				</div>

				{/* Selected File Info */}
				{selectedFile && (
					<div style={{
						marginBottom: '24px',
						padding: '16px',
						backgroundColor: '#f0f9ff',
						border: '1px solid #0ea5e9',
						borderRadius: '8px',
						textAlign: 'left'
					}}>
						<div style={{ fontWeight: '600', marginBottom: '8px' }}>
							📄 Selected File: {selectedFile.name}
						</div>
						<div style={{ fontSize: '14px', color: '#0c4a6e' }}>
							Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
						</div>
					</div>
				)}

				{/* Language Selection */}
				<div style={{ marginBottom: '24px' }}>
					<label style={{
						display: 'block',
						marginBottom: '8px',
						fontWeight: '600',
						color: '#374151'
					}}>
						🌍 Language:
					</label>
					<div style={{
						display: 'flex',
						gap: '8px',
						justifyContent: 'center'
					}}>
						{[
							{ value: 'auto', label: 'Auto' },
							{ value: 'tr', label: 'Türkçe' },
							{ value: 'en', label: 'English' }
						].map((option) => (
							<button
								key={option.value}
								onClick={() => setLanguage(option.value as 'auto' | 'tr' | 'en')}
								style={{
									padding: '8px 16px',
									backgroundColor: language === option.value ? '#3b82f6' : '#f3f4f6',
									color: language === option.value ? 'white' : '#374151',
									border: '1px solid #d1d5db',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: '500',
									cursor: 'pointer',
									transition: 'all 0.2s ease'
								}}
								onMouseEnter={(e) => {
									if (language !== option.value) {
										e.currentTarget.style.backgroundColor = '#e5e7eb'
									}
								}}
								onMouseLeave={(e) => {
									if (language !== option.value) {
										e.currentTarget.style.backgroundColor = '#f3f4f6'
									}
								}}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>

				{/* Submit Button */}
				<button
					onClick={handleSubmit}
					disabled={!canSubmit}
					style={{
						padding: '16px 32px',
						backgroundColor: canSubmit ? '#10b981' : '#9ca3af',
						color: 'white',
						border: 'none',
						borderRadius: '8px',
						fontSize: '16px',
						fontWeight: '600',
						cursor: canSubmit ? 'pointer' : 'not-allowed',
						transition: 'all 0.2s ease',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						margin: '0 auto'
					}}
					onMouseEnter={(e) => {
						if (canSubmit) {
							e.currentTarget.style.backgroundColor = '#059669'
						}
					}}
					onMouseLeave={(e) => {
						if (canSubmit) {
							e.currentTarget.style.backgroundColor = '#10b981'
						}
					}}
				>
					🚀 Transcribe & Summarize
				</button>

				{/* Status Indicators */}
				{!online && (
					<div style={{
						marginTop: '16px',
						padding: '12px 16px',
						backgroundColor: '#fef3c7',
						border: '1px solid #f59e0b',
						borderRadius: '8px',
						color: '#92400e'
					}}>
						⚠️ You are currently offline. Please check your internet connection.
					</div>
				)}

				{!vpsUp && (
					<div style={{
						marginTop: '16px',
						padding: '12px 16px',
						backgroundColor: '#fef3c7',
						border: '1px solid #f59e0b',
						borderRadius: '8px',
						color: '#92400e'
					}}>
						⚠️ VPS connection is down. Please check your VPS connection.
					</div>
				)}

				{error && (
					<div style={{
						marginTop: '16px',
						padding: '12px 16px',
						backgroundColor: '#fee2e2',
						border: '1px solid #ef4444',
						borderRadius: '8px',
						color: '#991b1b'
					}}>
						❌ {error}
					</div>
				)}
			</div>

			{/* Progress Modal */}
			{showProgressModal && (
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
						padding: '32px',
						borderRadius: '16px',
						maxWidth: '500px',
						width: '90%',
						boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
						textAlign: 'center'
					}}>
						<h3 style={{
							margin: '0 0 24px 0',
							fontSize: '24px',
							fontWeight: '600',
							color: '#1e293b'
						}}>
							🔄 Processing your meeting...
						</h3>

						{/* Progress Bars */}
						<div style={{ marginBottom: '24px' }}>
							{/* Transcription Progress */}
							<div style={{ marginBottom: '20px' }}>
								<div style={{
									display: 'flex',
									justifyContent: 'space-between',
									marginBottom: '8px',
									fontSize: '14px',
									fontWeight: '500',
									color: '#374151'
								}}>
									<span>🎵 Transcription</span>
									<span>{Math.round(getPhaseProgress().transcription)}%</span>
								</div>
								<div style={{
									width: '100%',
									height: '12px',
									backgroundColor: '#e5e7eb',
									borderRadius: '6px',
									overflow: 'hidden'
								}}>
									<div style={{
										width: `${getPhaseProgress().transcription}%`,
										height: '100%',
										backgroundColor: '#3b82f6',
										transition: 'width 0.3s ease'
									}}></div>
								</div>
							</div>

							{/* Summarization Progress */}
							<div style={{ marginBottom: '20px' }}>
								<div style={{
									display: 'flex',
									justifyContent: 'space-between',
									marginBottom: '8px',
									fontSize: '14px',
									fontWeight: '500',
									color: '#374151'
								}}>
									<span>📝 Summarization</span>
									<span>{Math.round(getPhaseProgress().summarization)}%</span>
								</div>
								<div style={{
									width: '100%',
									height: '12px',
									backgroundColor: '#e5e7eb',
									borderRadius: '6px',
									overflow: 'hidden'
								}}>
									<div style={{
										width: `${getPhaseProgress().summarization}%`,
										height: '100%',
										backgroundColor: '#10b981',
										transition: 'width 0.3s ease'
									}}></div>
								</div>
							</div>
						</div>

						{/* Status and ETA */}
						<div style={{
							marginBottom: '24px',
							padding: '16px',
							backgroundColor: '#f8fafc',
							borderRadius: '8px',
							border: '1px solid #e2e8f0'
						}}>
							<div style={{
								fontSize: '16px',
								fontWeight: '500',
								color: '#374151',
								marginBottom: '8px'
							}}>
								{getPhaseMessage()}
							</div>
							{jobStatus?.eta_seconds && (
								<div style={{
									fontSize: '14px',
									color: '#64748b'
								}}>
									⏱️ ETA: {formatETA(jobStatus.eta_seconds)}
								</div>
							)}
						</div>

						{/* Cancel Button */}
						<button
							onClick={handleCancel}
							style={{
								padding: '12px 24px',
								backgroundColor: '#ef4444',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500',
								cursor: 'pointer',
								transition: 'background-color 0.2s ease'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#dc2626'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = '#ef4444'
							}}
						>
							❌ Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
