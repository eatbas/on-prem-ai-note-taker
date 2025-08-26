const apiBase = (() => {
	try {
		// @ts-ignore
		const fromPreload = (window as any).API_BASE_URL as string | undefined
		if (fromPreload) return fromPreload
	} catch {}
	return (import.meta as any).env.VITE_API_BASE_URL || '/api'
})()

function getUserId(): string | undefined {
	try {
		// Electron-preload may set window.USER_ID
		// @ts-ignore
		const fromGlobal = (window as any).USER_ID as string | undefined
		if (fromGlobal) return fromGlobal
	} catch {}
	return localStorage.getItem('user_id') || undefined
}

function getAuthHeader(): Record<string, string> {
	try {
		// @ts-ignore
		const basic = (window as any).BASIC_AUTH as { username?: string; password?: string } | undefined
		if (basic?.username && basic?.password) {
			const token = btoa(`${basic.username}:${basic.password}`)
			return { Authorization: `Basic ${token}` }
		}
	} catch {}
	const u = (import.meta as any).env.VITE_BASIC_AUTH_USERNAME as string | undefined
	const p = (import.meta as any).env.VITE_BASIC_AUTH_PASSWORD as string | undefined
	if (u && p) {
		const token = btoa(`${u}:${p}`)
		return { Authorization: `Basic ${token}` }
	}
	return {}
}

export async function transcribe(file: File, opts?: { language?: string; vadFilter?: boolean }) {
	const form = new FormData()
	form.append('file', file)
	// Always send a language parameter, defaulting to 'auto' for undefined/null/empty
	form.append('language', opts?.language || 'auto')
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	// Add job to queue for tracking
	const jobId = `transcribe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	// Import and add to queue (dynamic import to avoid circular dependencies)
	try {
		const { addJobToQueue } = await import('../stores/jobQueueManager')
		addJobToQueue(jobId, 'pending', `Transcribing audio file`)
	} catch (err) {
		console.warn('Could not add job to queue:', err)
	}

	const resp = await fetch(`${apiBase}/transcribe`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	
	if (!resp.ok) {
		// Update job status to failed
		try {
			const { updateJobInQueue } = await import('../stores/jobQueueManager')
			updateJobInQueue(jobId, { status: 'error', message: `Failed to transcribe audio` })
		} catch (err) {
			console.warn('Could not update job status:', err)
		}
		throw new Error(`Transcribe failed: ${resp.status}`)
	}
	
	const result = await resp.json()
	
	// Update job status to completed
	try {
		const { updateJobInQueue } = await import('../stores/jobQueueManager')
		updateJobInQueue(jobId, { 
			status: 'done', 
			message: `Audio transcribed successfully`,
			progress: 100,
			canGoBack: true
		})
	} catch (err) {
		console.warn('Could not update job status:', err)
	}
	
	return result
}

export async function summarize(text: string, language: string = 'auto') {
	// Add job to queue for tracking
	const jobId = `summarize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	// Import and add to queue (dynamic import to avoid circular dependencies)
	try {
		const { addJobToQueue } = await import('../stores/jobQueueManager')
		addJobToQueue(jobId, 'pending', `Generating summary from text`)
	} catch (err) {
		console.warn('Could not add job to queue:', err)
	}

	const resp = await fetch(`${apiBase}/summarize`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
		body: JSON.stringify({ text, language }),
	})
	
	if (!resp.ok) {
		// Update job status to failed
		try {
			const { updateJobInQueue } = await import('../stores/jobQueueManager')
			updateJobInQueue(jobId, { status: 'error', message: `Failed to generate summary` })
		} catch (err) {
			console.warn('Could not update job status:', err)
		}
		throw new Error(`Summarize failed: ${resp.status}`)
	}
	
	const result = await resp.json()
	
	// Update job status to completed
	try {
		const { updateJobInQueue } = await import('../stores/jobQueueManager')
		updateJobInQueue(jobId, { 
			status: 'done', 
			message: `Summary generated successfully`,
			progress: 100,
			canGoBack: true
		})
	} catch (err) {
		console.warn('Could not update job status:', err)
	}
	
	return result
}

export async function chat(prompt: string, model?: string) {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), 3600000) // 1 hour timeout
	
	// Add job to queue for tracking
	const jobId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	// Import and add to queue (dynamic import to avoid circular dependencies)
	try {
		const { addJobToQueue } = await import('../stores/jobQueueManager')
		addJobToQueue(jobId, 'pending', `Processing AI chat request`)
	} catch (err) {
		console.warn('Could not add job to queue:', err)
	}
	
	try {
		const resp = await fetch(`${apiBase}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
			body: JSON.stringify({ prompt, model }),
			signal: controller.signal
		})
		
		if (!resp.ok) {
			const errorText = await resp.text()
			// Update job status to failed
			try {
				const { updateJobInQueue } = await import('../stores/jobQueueManager')
				updateJobInQueue(jobId, { status: 'error', message: `Chat failed: ${resp.status}` })
			} catch (err) {
				console.warn('Could not update job status:', err)
			}
			throw new Error(`Chat failed: ${resp.status} - ${errorText}`)
		}
		
		const result = await resp.json()
		
		// Update job status to completed
		try {
			const { updateJobInQueue } = await import('../stores/jobQueueManager')
			updateJobInQueue(jobId, { 
				status: 'done', 
				message: `AI chat completed successfully`,
				progress: 100,
				canGoBack: true
			})
		} catch (err) {
			console.warn('Could not update job status:', err)
		}
		
		return result
	} finally {
		clearTimeout(timeoutId)
	}
}

export async function transcribeAndSummarize(file: File, opts?: { language?: string; vadFilter?: boolean }) {
	const form = new FormData()
	form.append('file', file)
	// Always send a language parameter, defaulting to 'auto' for undefined/null/empty
	form.append('language', opts?.language || 'auto')
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	// Add job to queue for tracking
	const jobId = `transcribe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	// Import and add to queue (dynamic import to avoid circular dependencies)
	try {
		const { addJobToQueue } = await import('../stores/jobQueueManager')
		addJobToQueue(jobId, 'pending', `Transcribing and summarizing audio file`)
	} catch (err) {
		console.warn('Could not add job to queue:', err)
	}

	const resp = await fetch(`${apiBase}/transcribe-and-summarize`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	
	if (!resp.ok) {
		// Update job status to failed
		try {
			const { updateJobInQueue } = await import('../stores/jobQueueManager')
			updateJobInQueue(jobId, { status: 'error', message: `Failed to transcribe and summarize audio` })
		} catch (err) {
			console.warn('Could not update job status:', err)
		}
		
		// Provide more specific error messages based on HTTP status
		let errorMessage = `Transcribe+Summarize failed: ${resp.status}`
		if (resp.status === 0 || resp.status === 500) {
			errorMessage = 'Server error: The AI backend may be having issues. Please try again later.'
		} else if (resp.status === 401) {
			errorMessage = 'Authentication failed. Please check your VPS credentials.'
		} else if (resp.status === 413) {
			errorMessage = 'File too large. Try recording shorter sessions.'
		} else if (resp.status === 503) {
			errorMessage = 'VPS service temporarily unavailable. Please try again later.'
		}
		
		throw new Error(errorMessage)
	}
	
	const result = await resp.json()
	
	// Update job status to completed
	try {
		const { updateJobInQueue } = await import('../stores/jobQueueManager')
		updateJobInQueue(jobId, { 
			status: 'done', 
			message: `Audio transcribed and summarized successfully`,
			progress: 100,
			canGoBack: true
		})
	} catch (err) {
		console.warn('Could not update job status:', err)
	}
	
	return result
}

export async function getMeetings() {
	const resp = await fetch(`${apiBase}/meetings`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get meetings failed: ${resp.status}`)
	return resp.json()
}

export async function getVpsMeetings() {
	const resp = await fetch(`${apiBase}/meetings`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get VPS meetings failed: ${resp.status}`)
	return resp.json()
}

export async function getMeeting(meetingId: string) {
	const resp = await fetch(`${apiBase}/meetings/${meetingId}`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get meeting failed: ${resp.status}`)
	return resp.json()
}

export async function updateMeeting(meetingId: string, title: string) {
	const form = new FormData()
	form.append('title', title)
	
	const resp = await fetch(`${apiBase}/meetings/${meetingId}`, {
		method: 'PUT',
		body: form,
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Update meeting failed: ${resp.status}`)
	return resp.json()
}

export async function deleteMeeting(meetingId: string): Promise<{ message: string }> {
	const resp = await fetch(`${apiBase}/meetings/${meetingId}`, {
		method: 'DELETE',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Delete meeting failed: ${resp.status}`)
	return resp.json()
}

export async function getVpsHealth() {
    const resp = await fetch(`${apiBase}/health`, { method: 'GET', headers: { ...getAuthHeader() } })
    if (!resp.ok) throw new Error(`VPS health failed: ${resp.status}`)
    return resp.json() as Promise<{ status: string; whisper_model: string; ollama_model: string }>
}

// New Job Management APIs for transcribe-and-summarize
export interface JobStatus {
	id: string
	phase: 'queued' | 'transcribing' | 'summarizing' | 'finalizing' | 'done' | 'error' | 'canceled'
	progress: number
	message: string
	eta_seconds?: number
	current: number
	total: number
	started_at?: string
	updated_at: string
	is_running: boolean
}

export async function submitTranscribeAndSummarizeJob(
	file: File, 
	language: string = 'auto'
): Promise<{ job_id: string }> {
	const form = new FormData()
	form.append('file', file)
	form.append('language', language)

	const resp = await fetch(`${apiBase}/jobs/transcribe-and-summarize`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Submit job failed: ${resp.status}`)
	return resp.json()
}

export async function autoProcessMeeting(
	file: File, 
	language: string = 'auto',
	title: string = 'Auto-recorded meeting'
): Promise<{
	meeting_id: string
	status: string
	transcript: string
	summary: string
	language: string
	duration?: number
	segments: Array<{ start: number; end: number; text: string }>
	message: string
}> {
	const form = new FormData()
	form.append('file', file)
	form.append('language', language)
	form.append('title', title)

	// Add job to queue for tracking
	const jobId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	
	// Import and add to queue (dynamic import to avoid circular dependencies)
	try {
		const { addJobToQueue } = await import('../stores/jobQueueManager')
		addJobToQueue(jobId, 'pending', `Processing meeting: ${title}`)
	} catch (err) {
		console.warn('Could not add job to queue:', err)
	}

	const resp = await fetch(`${apiBase}/meetings/auto-process`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	
	if (!resp.ok) {
		// Update job status to failed
		try {
			const { updateJobInQueue } = await import('../stores/jobQueueManager')
			updateJobInQueue(jobId, { status: 'error', message: `Failed to process meeting: ${title}` })
		} catch (err) {
			console.warn('Could not update job status:', err)
		}
		throw new Error(`Auto-process meeting failed: ${resp.status}`)
	}
	
	const result = await resp.json()
	
	// Update job status to completed
	try {
		const { updateJobInQueue } = await import('../stores/jobQueueManager')
		updateJobInQueue(jobId, { 
			status: 'done', 
			message: `Meeting processed successfully: ${title}`,
			progress: 100,
			canGoBack: true
		})
	} catch (err) {
		console.warn('Could not update job status:', err)
	}
	
	return result
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
	const resp = await fetch(`${apiBase}/jobs/${jobId}/status`, {
		method: 'GET',
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get job status failed: ${resp.status}`)
	return resp.json()
}

export async function cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
	const resp = await fetch(`${apiBase}/jobs/${jobId}/cancel`, {
		method: 'POST',
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Cancel job failed: ${resp.status}`)
	return resp.json()
}

// Server-Sent Events for progress streaming
export function createJobProgressStream(jobId: string): EventSource {
	const userId = getUserId()
	if (!userId) {
		throw new Error('User ID required for job progress streaming')
	}
	
	// Note: EventSource doesn't support custom headers, so we'll need to handle auth differently
	// For now, we'll use the URL with user ID as a query parameter
	const url = `${apiBase}/jobs/${jobId}/events?user_id=${encodeURIComponent(userId)}`
	const eventSource = new EventSource(url)
	
	return eventSource
}

// ===== 🏷️ TAGS MANAGEMENT =====
export interface Tag {
	name: string
	count: number
}

export async function getTags(): Promise<Tag[]> {
	const resp = await fetch(`${apiBase}/tags`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get tags failed: ${resp.status}`)
	return resp.json()
}

export async function updateMeetingTags(meetingId: string, tags: string[]): Promise<any> {
	const resp = await fetch(`${apiBase}/meetings/${meetingId}/tags`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
		body: JSON.stringify({ tags }),
	})
	if (!resp.ok) throw new Error(`Update meeting tags failed: ${resp.status}`)
	return resp.json()
}

// ===== 📤 QUEUE SYSTEM =====
export interface QueueStats {
	active_tasks: number
	pending_tasks: number
	failed_tasks: number
	completed_tasks: number
	workers_running: number
}

export async function getQueueStats(): Promise<QueueStats> {
	const resp = await fetch(`${apiBase}/queue/stats`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get queue stats failed: ${resp.status}`)
	return resp.json()
}

export async function submitQueueTranscription(file: File, language: string = 'auto'): Promise<{ task_id: string }> {
	const form = new FormData()
	form.append('file', file)
	form.append('language', language)

	const resp = await fetch(`${apiBase}/queue/transcribe`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Queue transcription failed: ${resp.status}`)
	return resp.json()
}

export async function submitQueueSummarization(text: string): Promise<{ task_id: string }> {
	const resp = await fetch(`${apiBase}/queue/summarize`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
		body: JSON.stringify({ text }),
	})
	if (!resp.ok) throw new Error(`Queue summarization failed: ${resp.status}`)
	return resp.json()
}

export async function getQueueTaskStatus(taskId: string): Promise<any> {
	const resp = await fetch(`${apiBase}/queue/task/${taskId}/status`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get queue task status failed: ${resp.status}`)
	return resp.json()
}

export async function getQueueTaskResult(taskId: string): Promise<any> {
	const resp = await fetch(`${apiBase}/queue/task/${taskId}/result`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get queue task result failed: ${resp.status}`)
	return resp.json()
}

// ===== 📈 PROGRESS STATISTICS =====
export interface ProgressStats {
	total_jobs: number
	completed_jobs: number
	failed_jobs: number
	running_jobs: number
	average_completion_time: number
}

export async function getProgressStats(): Promise<ProgressStats> {
	const resp = await fetch(`${apiBase}/progress/stats`, {
		method: 'GET',
		headers: { ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Get progress stats failed: ${resp.status}`)
	return resp.json()
}

// ===== 🎬 ENHANCED MEETING WORKFLOW =====
export async function startMeeting(
	title: string,
	language: 'tr' | 'en' | 'auto',
	tags?: string[]
): Promise<{ meeting_id: string; job_id: string; message: string; language: string }> {
	const payload = {
		title,
		language,
		tags: tags || []
	}

	const resp = await fetch(`${apiBase}/meetings/start`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-User-Id': getUserId() || '', ...getAuthHeader() },
		body: JSON.stringify(payload),
	})
	if (!resp.ok) throw new Error(`Start meeting failed: ${resp.status}`)
	return resp.json()
}

export async function uploadMeetingAudio(
	meetingId: string, 
	file: File, 
	language: string = 'auto'
): Promise<any> {
	const form = new FormData()
	form.append('file', file)
	form.append('language', language)

	const resp = await fetch(`${apiBase}/meetings/${meetingId}/upload-audio`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Upload meeting audio failed: ${resp.status}`)
	return resp.json()
}

// ===== 🔍 VPS DIAGNOSTICS =====
export interface VpsDiagnosticResult {
	step: string
	status: 'success' | 'error' | 'warning'
	message: string
	details?: any
	responseTime?: number
}

export async function runVpsDiagnostics(): Promise<VpsDiagnosticResult[]> {
	const results: VpsDiagnosticResult[] = []
	const startTime = Date.now()
	
	// Step 1: Test basic connectivity
	try {
		const step1Start = Date.now()
		const resp = await fetch(`${apiBase}/health`, { 
			method: 'GET', 
			headers: { ...getAuthHeader() },
			signal: AbortSignal.timeout(10000) // 10 second timeout
		})
		const step1Time = Date.now() - step1Start
		
		if (resp.ok) {
			const health = await resp.json()
			results.push({
				step: 'Basic Connectivity',
				status: 'success',
				message: `✅ Connected to VPS in ${step1Time}ms`,
				details: health,
				responseTime: step1Time
			})
		} else {
			results.push({
				step: 'Basic Connectivity',
				status: 'error',
				message: `❌ HTTP ${resp.status}: ${resp.statusText}`,
				details: { status: resp.status, statusText: resp.statusText },
				responseTime: step1Time
			})
		}
	} catch (err) {
		results.push({
			step: 'Basic Connectivity',
			status: 'error',
			message: `❌ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
			details: err
		})
	}
	
	// Step 2: Test authentication
	try {
		const step2Start = Date.now()
		const resp = await fetch(`${apiBase}/health`, { 
			method: 'GET',
			signal: AbortSignal.timeout(10000)
		})
		const step2Time = Date.now() - step2Start
		
		if (resp.status === 401) {
			results.push({
				step: 'Authentication',
				status: 'success',
				message: '✅ Authentication required (expected)',
				details: { status: resp.status },
				responseTime: step2Time
			})
		} else if (resp.ok) {
			results.push({
				step: 'Authentication',
				status: 'warning',
				message: '⚠️ No authentication required (unexpected)',
				details: { status: resp.status },
				responseTime: step2Time
			})
		} else {
			results.push({
				step: 'Authentication',
				status: 'error',
				message: `❌ Unexpected response: ${resp.status}`,
				details: { status: resp.status, statusText: resp.statusText },
				responseTime: step2Time
			})
		}
	} catch (err) {
		results.push({
			step: 'Authentication',
			status: 'error',
			message: `❌ Auth test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
			details: err
		})
	}
	
	// Step 3: Test with proper authentication
	try {
		const step3Start = Date.now()
		const resp = await fetch(`${apiBase}/health`, { 
			method: 'GET',
			headers: { ...getAuthHeader() },
			signal: AbortSignal.timeout(10000)
		})
		const step3Time = Date.now() - step3Start
		
		if (resp.ok) {
			const health = await resp.json()
			results.push({
				step: 'Authenticated Access',
				status: 'success',
				message: `✅ Successfully authenticated in ${step3Time}ms`,
				details: health,
				responseTime: step3Time
			})
		} else {
			results.push({
				step: 'Authenticated Access',
				status: 'error',
				message: `❌ Auth failed: ${resp.status} ${resp.statusText}`,
				details: { status: resp.status, statusText: resp.statusText },
				responseTime: step3Time
			})
		}
	} catch (err) {
		results.push({
			step: 'Authenticated Access',
			status: 'error',
			message: `❌ Auth test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
			details: err
		})
	}
	
	// Step 4: Test file upload endpoint (without file)
	try {
		const step4Start = Date.now()
		const resp = await fetch(`${apiBase}/transcribe`, { 
			method: 'POST',
			headers: { ...getAuthHeader() },
			body: new FormData(), // Empty form data
			signal: AbortSignal.timeout(15000)
		})
		const step4Time = Date.now() - step4Start
		
		// We expect this to fail (no file), but we want to see the error
		if (resp.status === 422 || resp.status === 400) {
			results.push({
				step: 'File Upload Endpoint',
				status: 'success',
				message: `✅ Upload endpoint accessible (expected validation error)`,
				details: { status: resp.status, statusText: resp.statusText },
				responseTime: step4Time
			})
		} else if (resp.ok) {
			results.push({
				step: 'File Upload Endpoint',
				status: 'warning',
				message: `⚠️ Upload endpoint accepted empty data (unexpected)`,
				details: { status: resp.status },
				responseTime: step4Time
			})
		} else {
			results.push({
				step: 'File Upload Endpoint',
				status: 'error',
				message: `❌ Upload endpoint error: ${resp.status} ${resp.statusText}`,
				details: { status: resp.status, statusText: resp.statusText },
				responseTime: step4Time
			})
		}
	} catch (err) {
		results.push({
			step: 'File Upload Endpoint',
			status: 'error',
			message: `❌ Upload endpoint test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
			details: err
		})
	}
	
	// Step 5: Test with a small dummy file
	try {
		const step5Start = Date.now()
		const dummyFile = new File(['test audio content'], 'test.wav', { type: 'audio/wav' })
		const formData = new FormData()
		formData.append('file', dummyFile)
		
		const resp = await fetch(`${apiBase}/transcribe`, { 
			method: 'POST',
			headers: { ...getAuthHeader() },
			body: formData,
			signal: AbortSignal.timeout(30000) // Longer timeout for file processing
		})
		const step5Time = Date.now() - step5Start
		
		if (resp.ok) {
			results.push({
				step: 'File Processing',
				status: 'success',
				message: `✅ File processing successful in ${step5Time}ms`,
				details: { status: resp.status, responseTime: step5Time },
				responseTime: step5Time
			})
		} else {
			const errorText = await resp.text()
			results.push({
				step: 'File Processing',
				status: 'error',
				message: `❌ File processing failed: ${resp.status} ${resp.statusText}`,
				details: { status: resp.status, statusText: resp.statusText, error: errorText },
				responseTime: step5Time
			})
		}
	} catch (err) {
		results.push({
			step: 'File Processing',
			status: 'error',
			message: `❌ File processing test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
			details: err
		})
	}
	
	// Step 6: Overall summary
	const totalTime = Date.now() - startTime
	const successCount = results.filter(r => r.status === 'success').length
	const errorCount = results.filter(r => r.status === 'error').length
	const warningCount = results.filter(r => r.status === 'warning').length
	
	results.push({
		step: 'Diagnostic Summary',
		status: errorCount === 0 ? 'success' : 'error',
		message: `📊 Completed in ${totalTime}ms: ${successCount} ✅, ${warningCount} ⚠️, ${errorCount} ❌`,
		details: { totalTime, successCount, warningCount, errorCount }
	})
	
	return results
}

// ===== 🧪 QUICK CONNECTION TEST =====
export async function quickVpsTest(): Promise<{ success: boolean; message: string; details?: any }> {
	try {
		const startTime = Date.now()
		const resp = await fetch(`${apiBase}/health`, { 
			method: 'GET', 
			headers: { ...getAuthHeader() },
			signal: AbortSignal.timeout(5000) // 5 second timeout
		})
		const responseTime = Date.now() - startTime
		
		if (resp.ok) {
			const health = await resp.json()
			return {
				success: true,
				message: `✅ VPS connected successfully in ${responseTime}ms`,
				details: { health, responseTime }
			}
		} else {
			return {
				success: false,
				message: `❌ VPS responded with error: ${resp.status} ${resp.statusText}`,
				details: { status: resp.status, statusText: resp.statusText, responseTime }
			}
		}
	} catch (err) {
		return {
			success: false,
			message: `❌ Cannot connect to VPS: ${err instanceof Error ? err.message : 'Unknown error'}`,
			details: { error: err }
		}
	}
}


