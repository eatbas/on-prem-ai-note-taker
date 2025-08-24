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
	if (opts?.language) form.append('language', opts.language)
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	const resp = await fetch(`${apiBase}/transcribe`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Transcribe failed: ${resp.status}`)
	return resp.json()
}

export async function summarize(text: string) {
	const resp = await fetch(`${apiBase}/summarize`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
		body: JSON.stringify({ text }),
	})
	if (!resp.ok) throw new Error(`Summarize failed: ${resp.status}`)
	return resp.json()
}

export async function chat(prompt: string, model?: string) {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout
	
	try {
		const resp = await fetch(`${apiBase}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
			body: JSON.stringify({ prompt, model }),
			signal: controller.signal
		})
		
		if (!resp.ok) {
			const errorText = await resp.text()
			throw new Error(`Chat failed: ${resp.status} - ${errorText}`)
		}
		
		return resp.json()
	} finally {
		clearTimeout(timeoutId)
	}
}

export async function transcribeAndSummarize(file: File, opts?: { language?: string; vadFilter?: boolean }) {
	const form = new FormData()
	form.append('file', file)
	if (opts?.language) form.append('language', opts.language)
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	const resp = await fetch(`${apiBase}/transcribe-and-summarize`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Transcribe+Summarize failed: ${resp.status}`)
	return resp.json()
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

	const resp = await fetch(`${apiBase}/meetings/auto-process`, {
		method: 'POST',
		body: form,
		headers: { 'X-User-Id': getUserId() || '', ...getAuthHeader() },
	})
	if (!resp.ok) throw new Error(`Auto-process meeting failed: ${resp.status}`)
	return resp.json()
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


