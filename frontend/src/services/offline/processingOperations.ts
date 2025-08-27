// Transcription and processing operations

import { db } from '../db'
import { transcribeAndSummarize } from '../api'
import { getMeeting } from './meetingOperations'
import { assembleFileFromChunks, assembleFilesByAudioType } from './fileOperations'
import { getChunks } from './chunkOperations'
import { combineTranscriptsWithSpeakers } from './offlineUtils'

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
		// Ensure we always pass a valid language, defaulting to 'auto' for undefined
		const language = meeting.language || 'auto'
		const res = await transcribeAndSummarize(file, { language })
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
		throw e
	}
}

// Legacy function name alias for backward compatibility
export const autoProcessMeetingRecording = autoProcessMeetingRecordingWithWhisperOptimization

export async function autoProcessMeetingRecordingWithWhisperOptimization(meetingId: string, title?: string): Promise<void> {
	console.log(`🚀 Auto-processing meeting ${meetingId} with Whisper optimization...`)
	console.log(`🔍 Full meetingId being processed: ${meetingId}`)
	
	const meeting = await getMeeting(meetingId)
	if (!meeting) {
		console.error(`❌ Meeting ${meetingId} not found`)
		throw new Error('Meeting not found')
	}
	
	// 🚨 CRITICAL: Check if meeting is already processed to prevent duplicate sending
	if (meeting.status === 'sent') {
		console.log(`✅ Meeting ${meetingId} already processed (status: sent). Skipping to prevent duplicate.`)
		return
	}
	
	// Check if meeting is currently being processed (status: queued means processing)
	if (meeting.status === 'queued') {
		console.log(`⏳ Meeting ${meetingId} is already being processed (status: queued). Skipping to prevent duplicate.`)
		return
	}
	
	// Mark as queued to prevent other instances from processing it
	await db.meetings.update(meetingId, { 
		status: 'queued', 
		updatedAt: Date.now() 
	})
	console.log(`🔄 Marked meeting ${meetingId} as queued (processing)`)
	
	let file = await assembleFileFromChunks(meetingId)
	console.log(`📁 Assembled file: ${file.name}, size: ${file.size} bytes`)
	
	// If no file found with exact meeting ID, try to find chunks with similar meeting IDs
	if (file.size === 0) {
		console.log(`🔍 No chunks found for exact meetingId: ${meetingId}. Checking for similar meeting IDs...`)
		
		const allChunks = await db.chunks.toArray()
		const chunksByMeeting = allChunks.reduce((acc, chunk) => {
			acc[chunk.meetingId] = (acc[chunk.meetingId] || 0) + 1
			return acc
		}, {} as Record<string, number>)
		
		// Look for a meeting ID that might be the same but with slight differences
		const availableIds = Object.keys(chunksByMeeting)
		let bestMatch: string | null = null
		
		// Try to find the most recent meeting with chunks
		if (availableIds.length > 0) {
			// Sort by most chunks (likely the current recording)
			bestMatch = availableIds.sort((a, b) => chunksByMeeting[b] - chunksByMeeting[a])[0]
			console.log(`🎯 Trying best match: ${bestMatch} (${chunksByMeeting[bestMatch]} chunks)`)
			
			// Try to assemble file with the best match
			file = await assembleFileFromChunks(bestMatch)
			console.log(`📁 Assembled file with best match: ${file.name}, size: ${file.size} bytes`)
		}
	}
	
	if (file.size === 0) {
		// Let's check if we have chunks in the database
		const chunks = await getChunks(meetingId)
		console.error(`❌ No audio data! Chunks found: ${chunks.length}`)
		
		if (chunks.length > 0) {
			console.error('📋 Chunk details:', chunks.map((c, i) => `#${i}: ${c.blob.size} bytes, type: ${c.audioType}, created: ${new Date(c.createdAt).toISOString()}`))
			
			// Try to determine why assembled file is empty
			const totalSize = chunks.reduce((sum, chunk) => sum + chunk.blob.size, 0)
			console.error(`📊 Total chunks size: ${totalSize} bytes, but assembled file size: ${file.size} bytes`)
		} else {
			// No chunks found - check if meeting exists
			const meetingExists = await db.meetings.get(meetingId)
			console.error('🔍 Meeting exists:', !!meetingExists)
			
			// Check all chunks in database
			const allChunks = await db.chunks.toArray()
			console.error(`🗃️ Total chunks in database: ${allChunks.length}`)
			
			if (allChunks.length > 0) {
				const chunksByMeeting = allChunks.reduce((acc, chunk) => {
					acc[chunk.meetingId] = (acc[chunk.meetingId] || 0) + 1
					return acc
				}, {} as Record<string, number>)
				console.error('📋 Chunks by meeting:', chunksByMeeting)
				console.error('🔍 Looking for meetingId:', meetingId)
				console.error('🔍 Available meeting IDs in chunks:', Object.keys(chunksByMeeting))
				
				// Check for close matches
				const availableIds = Object.keys(chunksByMeeting)
				availableIds.forEach(id => {
					if (id.includes(meetingId.slice(8, 16)) || meetingId.includes(id.slice(8, 16))) {
						console.error(`🔍 Potential match found: ${id} vs ${meetingId}`)
					}
				})
			}
		}
		
		throw new Error('No audio data found for this meeting')
	}
	
	console.log(`Auto-processing meeting ${meetingId}, file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
	
	try {
		// Use the new auto-process endpoint for better reliability
		// Ensure we always pass a valid language, defaulting to 'auto' for undefined
		const language = meeting.language || 'auto'
		console.log(`🚀 Calling autoProcessMeeting with:`, {
			meetingId,
			fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
			language,
			title: title || meeting.title
		})
		
		const result = await transcribeAndSummarize(file, { language })
		
		console.log(`✅ Auto-processing successful for ${meetingId}`)
		
		// Store the results
		await db.notes.put({ 
			meetingId, 
			transcript: result.transcript.text, 
			createdAt: Date.now(), 
			summary: result.summary 
		})
		
		// Update meeting status and title if provided
		const updateData: any = { 
			status: 'sent', 
			updatedAt: Date.now() 
		}
		if (title && title.trim()) {
			updateData.title = title.trim()
		}
		
		await db.meetings.update(meetingId, updateData)
		console.log(`📝 Meeting ${meetingId} auto-processed and saved successfully`)
		
	} catch (e: any) {
		console.error(`❌ Auto-processing failed for ${meetingId}:`, e)
		
		// Update meeting status to show processing failed (back to local for retry)
		try {
			await db.meetings.update(meetingId, { 
				status: 'local', // Back to local status so user can retry
				updatedAt: Date.now() 
			})
		} catch (updateError) {
			console.error('Failed to update meeting status to local:', updateError)
		}
		
		// Enhance error messages for better user experience
		if (e && typeof e === 'object' && e.message) {
			if (e.message.includes('Failed to fetch') || e.message.includes('fetch')) {
				throw new Error('Cannot connect to AI backend server. Make sure the backend is running and accessible.')
			} else if (e.message.includes('401') || e.message.includes('Unauthorized')) {
				throw new Error('Authentication failed. Check your API credentials.')
			} else if (e.message.includes('503') || e.message.includes('500')) {
				throw new Error('Backend server error. The AI service may be temporarily unavailable.')
			}
		}
		
		throw e
	}
}
