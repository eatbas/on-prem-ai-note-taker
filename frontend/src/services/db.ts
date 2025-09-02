import Dexie, { Table } from 'dexie'

// Enhanced meeting status flow for better tracking and VPS optimization
export type MeetingStatus = 'local' | 'queued' | 'uploading' | 'processing' | 'synced' | 'sent'

export type Meeting = {
	id: string
	title: string
	createdAt: number
	updatedAt: number
	tags: string[]
	status: MeetingStatus
	language?: 'tr' | 'en' | 'auto'  // Meeting language for transcription
	// Optional metadata for display
	duration?: number
	// Workspace support
	workspace_id?: number
	is_personal: boolean
	// Sync tracking
	vps_id?: string  // ID on VPS if synced
	last_sync_attempt?: number  // Timestamp of last sync attempt
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

// Outbox for offline-first mutations
export type OutboxStatus = 'pending' | 'processing' | 'done' | 'error'
export type OutboxItem = {
	id?: number
	type: 'rename_meeting' | 'update_tags' | 'delete_meeting'
	payload: any
	createdAt: number
	attempts: number
	lastError?: string
	status: OutboxStatus
}

// Cache metadata for intelligent sync
export type CacheMetadata = {
	key: string
	lastSync: number
	expires?: number
	version: number
}

export class AppDB extends Dexie {
	meetings!: Table<Meeting, string>
	chunks!: Table<Chunk, string>
	notes!: Table<Note, string>
	workspaces!: Table<Workspace, number>
	outbox!: Table<OutboxItem, number>
	cache_metadata!: Table<CacheMetadata, string>

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
		
		// Version 4: Enhanced sync tracking and status types
		this.version(4).stores({
			meetings: 'id, createdAt, updatedAt, status, *tags, title, workspace_id, is_personal, vps_id, last_sync_attempt',
			chunks: 'id, meetingId, index, createdAt, audioType',
			notes: 'meetingId, createdAt',
			workspaces: 'id, name, is_active, createdAt',
		}).upgrade(trans => {
			// Migrate existing status types and add sync tracking fields
			return trans.table('meetings').toCollection().modify((meeting: any) => {
				// Convert old 'sent' status to 'synced'
				if (meeting.status === 'sent') {
					meeting.status = 'synced'
				}
				// Add sync tracking fields
				if (meeting.vps_id === undefined) {
					meeting.vps_id = null
				}
				if (meeting.last_sync_attempt === undefined) {
					meeting.last_sync_attempt = null
				}
			})
		})
		
		// Version 5: Offline-first outbox and cache metadata
		this.version(5).stores({
			meetings: 'id, createdAt, updatedAt, status, *tags, title, workspace_id, is_personal, vps_id, last_sync_attempt',
			chunks: 'id, meetingId, index, createdAt, audioType',
			notes: 'meetingId, createdAt',
			workspaces: 'id, name, is_active, createdAt',
			outbox: '++id, type, createdAt, attempts, status',
			cache_metadata: 'key, lastSync'
		})
	}
}

export const db = new AppDB()


