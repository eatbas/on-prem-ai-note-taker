import { db, Meeting, Chunk } from './db'
import { transcribeAndSummarize, autoProcessMeeting } from './api'

export function generateId(prefix = 'id'): string {
	return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

export async function createMeeting(title: string, tags: string[] = [], language: 'tr' | 'en' = 'tr'): Promise<Meeting> {
	const meeting: Meeting = {
		id: generateId('meeting'),
		title,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		tags,
		language,
		status: 'local',
	}
	await db.meetings.add(meeting)
	return meeting
}

export async function addChunk(meetingId: string, blob: Blob, index: number): Promise<void> {
	const chunk: Chunk = {
		id: generateId('chunk'),
		meetingId,
		index,
		blob,
		createdAt: Date.now(),
	}
	await db.chunks.add(chunk)
}

export async function listMeetings(query?: { tag?: string; text?: string; excludeRecordingInProgress?: boolean }): Promise<any[]> {
	let meetings = await db.meetings.orderBy('updatedAt').reverse().toArray()
	
	// Filter out meetings that are currently being recorded if requested
	if (query?.excludeRecordingInProgress) {
		// Import global recording manager to check active recording
		const { globalRecordingManager } = await import('../stores/globalRecordingManager')
		const currentRecording = globalRecordingManager.getState()
		if (currentRecording.isRecording && currentRecording.meetingId) {
			meetings = meetings.filter(m => m.id !== currentRecording.meetingId)
		}
	}
	
	if (query?.tag) meetings = meetings.filter(m => m.tags.includes(query.tag!))
	if (query?.text) {
		const t = query.text.toLowerCase()
		// Preload notes to allow transcript/summary search
		const notesArr = await db.notes.toArray()
		const noteById: Record<string, { transcript: string; summary?: string }> = {}
		for (const n of notesArr) noteById[n.meetingId] = { transcript: n.transcript || '', summary: n.summary }
		meetings = meetings.filter(m => {
			const inTitle = m.title.toLowerCase().includes(t)
			const note = noteById[m.id]
			const inSummary = note?.summary ? note.summary.toLowerCase().includes(t) : false
			const inTranscript = note?.transcript ? note.transcript.toLowerCase().includes(t) : false
			// attach hint for UI (not persisted)
			// @ts-ignore
			m.__hit = inTitle ? 'title' : inSummary ? 'summary' : inTranscript ? 'transcript' : undefined
			return inTitle || inSummary || inTranscript
		})
	}
	return meetings
}

export async function getMeeting(meetingId: string) {
	return db.meetings.get(meetingId)
}

export async function getChunks(meetingId: string) {
	return db.chunks.where({ meetingId }).sortBy('index')
}

export async function assembleFileFromChunks(meetingId: string): Promise<File> {
	const parts = await getChunks(meetingId)
	const blobs = parts.map(p => p.blob)
	return new File(blobs, `${meetingId}.webm`, { type: 'audio/webm' })
}

export async function syncMeeting(meetingId: string): Promise<void> {
	const meeting = await db.meetings.get(meetingId)
	if (!meeting) {
		throw new Error('Meeting not found')
	}
	
	const file = await assembleFileFromChunks(meetingId)
	if (file.size === 0) {
		throw new Error('No audio data found for this meeting')
	}
	
	console.log(`Syncing meeting ${meetingId}, file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
	
	try {
		const res = await transcribeAndSummarize(file, { language: meeting.language })
		await db.notes.put({ 
			meetingId, 
			transcript: res.transcript.text, 
			createdAt: Date.now(), 
			summary: res.summary 
		})
		await db.meetings.update(meetingId, { 
			status: 'sent', 
			updatedAt: Date.now() 
		})
		console.log(`Successfully synced meeting ${meetingId}`)
	} catch (e) {
		await db.meetings.update(meetingId, { 
			status: 'queued', 
			updatedAt: Date.now() 
		})
		console.error(`Failed to sync meeting ${meetingId}:`, e)
		
		// Provide more specific error messages
		if (e instanceof Error) {
			if (e.message.includes('Failed to fetch') || e.message.includes('fetch')) {
				throw new Error('Cannot connect to AI backend server. Make sure the backend is running and accessible.')
			} else if (e.message.includes('401') || e.message.includes('Unauthorized')) {
				throw new Error('Authentication failed. Check your credentials.')
			} else if (e.message.includes('413') || e.message.includes('too large')) {
				throw new Error('Audio file too large. Try recording shorter sessions.')
			} else if (e.message.includes('500')) {
				throw new Error('Server error. The AI backend may be having issues.')
			}
		}
		throw e
	}
}

export function watchOnline(callback: (online: boolean) => void) {
	const handler = () => callback(navigator.onLine)
	window.addEventListener('online', handler)
	window.addEventListener('offline', handler)
	callback(navigator.onLine)
	return () => {
		window.removeEventListener('online', handler)
		window.removeEventListener('offline', handler)
	}
}

export async function syncAllQueued(): Promise<void> {
	const pending = await db.meetings.where('status').notEqual('sent').toArray()
	for (const m of pending) {
		try {
			await syncMeeting(m.id)
		} catch {
			// keep queued
		}
	}
}

export async function updateMeetingTags(meetingId: string, tags: string[]): Promise<void> {
	await db.meetings.update(meetingId, { tags, updatedAt: Date.now() })
}

export async function autoProcessMeetingRecording(
	meetingId: string,
	title?: string
): Promise<void> {
	const meeting = await db.meetings.get(meetingId)
	if (!meeting) {
		throw new Error('Meeting not found')
	}
	
	const file = await assembleFileFromChunks(meetingId)
	if (file.size === 0) {
		throw new Error('No audio data found for this meeting')
	}
	
	console.log(`Auto-processing meeting ${meetingId}, file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
	
	try {
		// Use the new auto-process endpoint for better reliability
		const result = await autoProcessMeeting(
			file, 
			meeting.language, 
			title || meeting.title
		)
		
		// Save the results to local database
		await db.notes.put({ 
			meetingId, 
			transcript: result.transcript, 
			createdAt: Date.now(), 
			summary: result.summary 
		})
		
		// Update meeting status and metadata
		await db.meetings.update(meetingId, { 
			status: 'sent', 
			updatedAt: Date.now(),
			title: result.message.includes('Meeting') ? result.message.split("'")[1] : meeting.title
		})
		
		console.log(`Successfully auto-processed meeting ${meetingId}`)
	} catch (e) {
		await db.meetings.update(meetingId, { 
			status: 'queued', 
			updatedAt: Date.now() 
		})
		console.error(`Failed to auto-process meeting ${meetingId}:`, e)
		
		// Provide more specific error messages
		if (e instanceof Error) {
			if (e.message.includes('Failed to fetch') || e.message.includes('fetch')) {
				throw new Error('Cannot connect to AI backend server. Make sure the backend is running and accessible.')
			} else if (e.message.includes('401') || e.message.includes('Unauthorized')) {
				throw new Error('Authentication failed. Check your credentials.')
			} else if (e.message.includes('413') || e.message.includes('too large')) {
				throw new Error('Audio file too large. Try recording shorter sessions.')
			} else if (e.message.includes('500')) {
				throw new Error('Server error. The AI backend may be having issues.')
			} else if (e.message.includes('Auto-process meeting failed')) {
				throw new Error('Failed to process meeting automatically. Please try again.')
			}
		}
		throw e
	}
}

export async function deleteMeetingLocally(meetingId: string): Promise<void> {
	// Delete meeting record
	await db.meetings.delete(meetingId)
	
	// Delete all chunks for this meeting
	const chunks = await db.chunks.where({ meetingId }).toArray()
	for (const chunk of chunks) {
		await db.chunks.delete(chunk.id)
	}
	
	// Delete notes for this meeting
	await db.notes.delete(meetingId)
	
	console.log(`Successfully deleted local meeting data for ${meetingId}`)
}

export async function deleteAudioChunksLocally(meetingId: string): Promise<void> {
	// Delete all chunks for this meeting but keep meeting record and notes
	const chunks = await db.chunks.where({ meetingId }).toArray()
	for (const chunk of chunks) {
		await db.chunks.delete(chunk.id)
	}
	
	console.log(`Successfully deleted local audio chunks for ${meetingId}`)
}


