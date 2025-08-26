import Dexie, { Table } from 'dexie'

export type Meeting = {
	id: string
	title: string
	createdAt: number
	updatedAt: number
	tags: string[]
	status: 'local' | 'queued' | 'sent'
	language?: 'tr' | 'en'  // Meeting language for transcription
	// Optional metadata for display
	duration?: number
}

export type Chunk = {
	id: string
	meetingId: string
	index: number
	blob: Blob
	createdAt: number
}

export type Note = {
	meetingId: string
	transcript: string
	summary?: string
	createdAt: number
}

export class AppDB extends Dexie {
	meetings!: Table<Meeting, string>
	chunks!: Table<Chunk, string>
	notes!: Table<Note, string>

	constructor() {
		super('onprem_notes_db')
		this.version(1).stores({
			meetings: 'id, createdAt, updatedAt, status, *tags, title',
			chunks: 'id, meetingId, index, createdAt',
			notes: 'meetingId, createdAt',
		})
	}
}

export const db = new AppDB()


