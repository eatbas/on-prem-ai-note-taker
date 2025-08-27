// Cleanup and deletion operations

import { db } from '../db'
import { getChunks } from './chunkOperations'

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
	console.log(`🗑️ Deleting audio chunks for meeting ${meetingId}`)
	
	// Delete all chunks for this meeting
	const chunks = await getChunks(meetingId)
	for (const chunk of chunks) {
		await db.chunks.delete(chunk.id)
	}
	
	console.log(`Successfully deleted ${chunks.length} audio chunks for meeting ${meetingId}`)
}
