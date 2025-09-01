// Audio chunk operations

import { db, Chunk, AudioType } from '../db'
import { generateId } from './offlineUtils'

export async function addChunk(meetingId: string, blob: Blob, index: number, audioType: AudioType = 'mixed'): Promise<void> {
	console.log(`💾 addChunk called:`, {
		meetingId: meetingId, // Log full meeting ID to debug
		meetingIdShort: meetingId ? meetingId.slice(0, 8) + '...' : 'unknown',
		blobSize: blob.size,
		blobType: blob.type,
		index,
		audioType, // NEW: Log audio source type
		timestamp: new Date().toISOString()
	})

	if (blob.size === 0) {
		console.warn(`⚠️ Empty blob for chunk ${index}, skipping...`)
		return
	}

	const chunk: Chunk = {
		id: generateId('chunk'),
		meetingId,
		blob,
		index,
		audioType, // Store the audio source type
		createdAt: Date.now()
	}

	await db.chunks.add(chunk)
	console.log(`✅ Chunk ${index} stored successfully (${blob.size} bytes, type: ${audioType})`)
}

export async function getChunks(meetingId: string) {
	return db.chunks.where({ meetingId }).sortBy('index')
}


