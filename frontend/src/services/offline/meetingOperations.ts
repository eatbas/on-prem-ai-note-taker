// Meeting CRUD operations

import { db, Meeting } from '../db'
import { generateId } from './offlineUtils'

export async function createMeeting(title: string, tags: string[] = [], language: 'tr' | 'en' | 'auto' = 'auto'): Promise<Meeting> {
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

export async function getMeeting(meetingId: string) {
	return db.meetings.get(meetingId)
}

export async function listMeetings(query?: { tag?: string; text?: string; excludeRecordingInProgress?: boolean }): Promise<any[]> {
	let meetings = await db.meetings.orderBy('updatedAt').reverse().toArray()
	
	// Filter out meetings that are currently being recorded if requested
	if (query?.excludeRecordingInProgress) {
		// Import global recording manager to check active recording
		const { globalRecordingManager } = await import('../../stores/globalRecordingManager')
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

export async function updateMeetingTags(meetingId: string, tags: string[]): Promise<void> {
	await db.meetings.update(meetingId, { tags, updatedAt: Date.now() })
}
