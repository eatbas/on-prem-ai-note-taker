import { useState } from 'react'
import { summarize, transcribe, transcribeAndSummarize } from './api'

type TranscriptionSegment = {
	start: number
	end: number
	text: string
}

export default function App() {
	const [file, setFile] = useState<File | null>(null)
	const [transcript, setTranscript] = useState<string>('')
	const [segments, setSegments] = useState<TranscriptionSegment[]>([])
	const [summary, setSummary] = useState<string>('')
	const [loading, setLoading] = useState<boolean>(false)
	const [error, setError] = useState<string>('')

	const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFile(e.target.files?.[0] || null)
	}

	const doTranscribe = async () => {
		if (!file) return
		setLoading(true)
		setError('')
		try {
			const res = await transcribe(file)
			setTranscript(res.text)
			setSegments(res.segments || [])
		} catch (e: any) {
			setError(e.message || 'Failed to transcribe')
		} finally {
			setLoading(false)
		}
	}

	const doSummarize = async () => {
		setLoading(true)
		setError('')
		try {
			const res = await summarize(transcript)
			setSummary(res.summary)
		} catch (e: any) {
			setError(e.message || 'Failed to summarize')
		} finally {
			setLoading(false)
		}
	}

	const doTranscribeAndSummarize = async () => {
		if (!file) return
		setLoading(true)
		setError('')
		try {
			const res = await transcribeAndSummarize(file)
			setTranscript(res.transcript.text)
			setSegments(res.transcript.segments || [])
			setSummary(res.summary)
		} catch (e: any) {
			setError(e.message || 'Failed to transcribe and summarize')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'Inter, system-ui, Arial' }}>
			<h1>On-Prem AI Note Taker</h1>
			<p>Upload an audio file to transcribe and summarize with your local Ollama.</p>
			<input type="file" accept="audio/*,video/*" onChange={onFileChange} />
			<div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
				<button onClick={doTranscribe} disabled={!file || loading}>Transcribe</button>
				<button onClick={doSummarize} disabled={!transcript || loading}>Summarize</button>
				<button onClick={doTranscribeAndSummarize} disabled={!file || loading}>Transcribe + Summarize</button>
			</div>
			{loading && <p>Processing…</p>}
			{error && <p style={{ color: 'crimson' }}>{error}</p>}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
				<div>
					<h2>Transcript</h2>
					<textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={20} style={{ width: '100%' }} />
					<h3>Segments</h3>
					<ul>
						{segments.map((s, i) => (
							<li key={i}>
								[{s.start.toFixed(1)} - {s.end.toFixed(1)}] {s.text}
							</li>
						))}
					</ul>
				</div>
				<div>
					<h2>Summary</h2>
					<textarea value={summary} onChange={e => setSummary(e.target.value)} rows={20} style={{ width: '100%' }} />
				</div>
			</div>
		</div>
	)
}


