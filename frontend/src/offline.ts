import { db, Meeting, Chunk } from './db'
import { transcribeAndSummarize } from './api'

export function generateId(prefix = 'id'): string {
	return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

export async function createMeeting(title: string, tags: string[] = []): Promise<Meeting> {
	const meeting: Meeting = {
		id: generateId('meeting'),
		title,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		tags,
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

export async function listMeetings(query?: { tag?: string; text?: string }): Promise<Meeting[]> {
	let meetings = await db.meetings.orderBy('updatedAt').reverse().toArray()
	if (query?.tag) meetings = meetings.filter(m => m.tags.includes(query.tag!))
	if (query?.text) {
		const t = query.text.toLowerCase()
		meetings = meetings.filter(m => m.title.toLowerCase().includes(t))
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
	if (!meeting) return
	const file = await assembleFileFromChunks(meetingId)
	try {
		const res = await transcribeAndSummarize(file)
		await db.notes.put({ meetingId, transcript: res.transcript.text, createdAt: Date.now(), summary: res.summary })
		await db.meetings.update(meetingId, { status: 'sent', updatedAt: Date.now() })
	} catch (e) {
		await db.meetings.update(meetingId, { status: 'queued', updatedAt: Date.now() })
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


