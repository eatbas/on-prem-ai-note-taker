import Dexie, { Table } from 'dexie'

export type Meeting = {
	id: string
	title: string
	createdAt: number
	updatedAt: number
	tags: string[]
	status: 'local' | 'queued' | 'sent'
	language?: 'tr' | 'en' | 'auto'  // Meeting language for transcription
	// Optional metadata for display
	duration?: number
	// Workspace support
	workspace_id?: number
	is_personal: boolean
}

export type AudioType = 'microphone' | 'system' | 'speaker' | 'mixed'

export type Chunk = {
	id: string
	meetingId: string
	index: number
	blob: Blob
	createdAt: number
	audioType: AudioType  // NEW: Track audio source for Whisper optimization
}

export type Note = {
	meetingId: string
	transcript: string
	summary?: string
	createdAt: number
}

export type Workspace = {
	id: number
	name: string
	description?: string
	is_active: boolean
	createdAt: number
	updatedAt?: number
}

export class AppDB extends Dexie {
	meetings!: Table<Meeting, string>
	chunks!: Table<Chunk, string>
	notes!: Table<Note, string>
	workspaces!: Table<Workspace, number>

	constructor() {
		super('onprem_notes_db')
		
		// Version 1: Original schema
		this.version(1).stores({
			meetings: 'id, createdAt, updatedAt, status, *tags, title',
			chunks: 'id, meetingId, index, createdAt',
			notes: 'meetingId, createdAt',
		})
		
		// Version 2: Add audioType for Whisper optimization
		this.version(2).stores({
			meetings: 'id, createdAt, updatedAt, status, *tags, title',
			chunks: 'id, meetingId, index, createdAt, audioType', // Added audioType index
			notes: 'meetingId, createdAt',
		}).upgrade(trans => {
			// Migrate existing chunks to have 'mixed' audioType (backward compatibility)
			return trans.table('chunks').toCollection().modify((chunk: any) => {
				chunk.audioType = 'mixed'
			})
		})
		
		// Version 3: Add workspace support
		this.version(3).stores({
			meetings: 'id, createdAt, updatedAt, status, *tags, title, workspace_id, is_personal',
			chunks: 'id, meetingId, index, createdAt, audioType',
			notes: 'meetingId, createdAt',
			workspaces: 'id, name, is_active, createdAt',
		}).upgrade(trans => {
			// Migrate existing meetings to be personal by default
			return trans.table('meetings').toCollection().modify((meeting: any) => {
				if (meeting.is_personal === undefined) {
					meeting.is_personal = true
				}
				if (meeting.workspace_id === undefined) {
					meeting.workspace_id = null
				}
			})
		})
	}
}

export const db = new AppDB()


