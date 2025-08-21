const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

export async function transcribe(file: File, opts?: { language?: string; vadFilter?: boolean }) {
	const form = new FormData()
	form.append('file', file)
	if (opts?.language) form.append('language', opts.language)
	if (opts?.vadFilter !== undefined) form.append('vad_filter', String(opts.vadFilter))

	const resp = await fetch(`${apiBase}/transcribe`, {
		method: 'POST',
		body: form,
	})
	if (!resp.ok) throw new Error(`Transcribe failed: ${resp.status}`)
	return resp.json()
}

export async function summarize(text: string) {
	const resp = await fetch(`${apiBase}/summarize`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
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
	})
	if (!resp.ok) throw new Error(`Transcribe+Summarize failed: ${resp.status}`)
	return resp.json()
}


