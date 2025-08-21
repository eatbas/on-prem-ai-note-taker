const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

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


