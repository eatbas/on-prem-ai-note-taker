// Transcription and processing operations

import { db } from '../db'
import { transcribeAndSummarize, getMeeting as getApiMeeting } from '../api'
import { getMeeting } from './meetingOperations'
import { assembleFileFromChunks, assembleFilesByAudioType } from './fileOperations'
import { getChunks } from './chunkOperations'
import { combineTranscriptsWithSpeakers } from './offlineUtils'
import { performDuplicateCheck, markMeetingAsSynced } from '../sync/duplicateChecker'
import { syncMeetingAsync, checkVpsMemoryStatus, syncMeetingWithRetry, RateLimitError, type JobProgress } from '../api/asyncMeetingSync'

/**
 * 🚨 PHASE 3.2: Async Meeting Sync with Progress Tracking
 * 
 * This function now uses async processing to prevent VPS freezing.
 * It provides real-time progress updates and maintains all existing
 * duplicate prevention and error handling logic.
 */
export async function syncMeeting(meetingId: string, onProgress?: (progress: JobProgress) => void): Promise<void> {
	const meeting = await db.meetings.get(meetingId)
	if (!meeting) {
		throw new Error('Meeting not found')
	}
	
	console.log(`🔍 Starting async sync for meeting ${meetingId}: ${meeting.title}`)
	
	// PHASE 2: Duplicate prevention check
	console.log(`🔍 Checking for duplicates before sync...`)
	const duplicateCheck = await performDuplicateCheck(meetingId)
	
	if (duplicateCheck.isDuplicate && !duplicateCheck.shouldSync) {
		console.log(`⏭️ Skipping sync for ${meetingId}: ${duplicateCheck.reason}`)
		
		// Mark as synced if it's confirmed to exist on VPS
		if (duplicateCheck.reason.includes('already exists on VPS')) {
			await markMeetingAsSynced(meetingId)
		}
		
		return
	}
	
	console.log(`✅ Duplicate check passed: ${duplicateCheck.reason}`)
	
	// 🚨 PHASE 3.2: Check VPS memory status before processing
	console.log(`💾 Checking VPS memory status...`)
	const memoryStatus = await checkVpsMemoryStatus()
	console.log(`💾 VPS Memory: ${memoryStatus.memoryUsage.toFixed(1)}MB - ${memoryStatus.recommendation}`)
	
	if (!memoryStatus.canProcess) {
		throw new Error(`VPS memory usage too high (${memoryStatus.memoryUsage.toFixed(1)}MB). Please try again later.`)
	}
	
	// Update status to queued and record sync attempt
	await db.meetings.update(meetingId, { 
		status: 'queued', 
		last_sync_attempt: Date.now(),
		updatedAt: Date.now() 
	})
	
	const file = await assembleFileFromChunks(meetingId)
	if (file.size === 0) {
		await db.meetings.update(meetingId, { status: 'local', updatedAt: Date.now() })
		throw new Error('No audio data found for this meeting')
	}
	
	const fileSizeMB = file.size / 1024 / 1024
	console.log(`🚀 Starting async sync for meeting ${meetingId}, file size: ${fileSizeMB.toFixed(2)} MB`)
	
	try {
		// Create enhanced progress tracking
		const enhancedProgressCallback = async (progress: JobProgress) => {
			console.log(`📊 Job ${progress.jobId} - ${progress.phase}: ${progress.progress}% - ${progress.message}`)
			
			// Update local meeting status based on job progress
			let localStatus: 'queued' | 'uploading' | 'processing' | 'completed' = 'queued'
			
			if (progress.phase === 'QUEUED') {
				localStatus = 'queued'
			} else if (progress.phase === 'TRANSCRIBING' && progress.progress < 20) {
				localStatus = 'uploading'
			} else if (progress.phase === 'TRANSCRIBING' || progress.phase === 'SUMMARIZING') {
				localStatus = 'processing'
			} else if (progress.isComplete && progress.phase !== 'ERROR') {
				localStatus = 'completed'  // Job finished, but haven't retrieved results yet
			}
			
			// Update local status
			await db.meetings.update(meetingId, { 
				status: localStatus, 
				updatedAt: Date.now() 
			})
			
			// Call user-provided progress callback
			if (onProgress) {
				onProgress(progress)
			}
		}
		
		// 🚨 PHASE 3.2 & 3.3: Use async processing with rate limiting instead of blocking call
		const language = meeting.language || 'auto'
		
		try {
			await syncMeetingWithRetry(meetingId, file, language, enhancedProgressCallback, (rateLimitInfo) => {
				console.warn(`🚫 Rate limited during sync:`, rateLimitInfo)
				// Store rate limit info for user feedback
				console.log(`⏰ Retry recommended in ${rateLimitInfo.retryAfter} seconds`)
			})
		} catch (error) {
			if (error instanceof RateLimitError) {
				// Provide specific rate limiting feedback
				throw new Error(`VPS is currently busy. ${error.message} Please try again in ${Math.ceil(error.retryAfter / 60)} minutes.`)
			}
			throw error
		}
		
		// 🚨 CRITICAL FIX: Fetch and store results before marking as synced
		console.log(`📥 Fetching processed results for meeting ${meetingId}`)
		await fetchAndStoreProcessedResults(meetingId)
		
		// NOW mark as synced (after we have the results)
		await markMeetingAsSynced(meetingId, meetingId)
		
		console.log(`✅ Successfully completed async sync for meeting ${meetingId}`)
		
		// TODO: In Phase 4, we'll implement local data cleanup after sync
		// For now, keep data locally for debugging and rollback capability
		
	} catch (e) {
		// Revert to local status on failure
		await db.meetings.update(meetingId, { 
			status: 'local', 
			updatedAt: Date.now() 
		})
		console.error(`❌ Failed to sync meeting ${meetingId}:`, e)
		throw e
	}
}

/**
 * Legacy sync function for backward compatibility
 * This still uses the old blocking method as a fallback
 */
export async function syncMeetingBlocking(meetingId: string): Promise<void> {
	console.log(`⚠️ Using legacy blocking sync for meeting ${meetingId}`)
	
	const meeting = await db.meetings.get(meetingId)
	if (!meeting) {
		throw new Error('Meeting not found')
	}
	
	// Duplicate prevention check
	const duplicateCheck = await performDuplicateCheck(meetingId)
	if (duplicateCheck.isDuplicate && !duplicateCheck.shouldSync) {
		if (duplicateCheck.reason.includes('already exists on VPS')) {
			await markMeetingAsSynced(meetingId)
		}
		return
	}
	
	// Update status to queued
	await db.meetings.update(meetingId, { 
		status: 'queued', 
		last_sync_attempt: Date.now(),
		updatedAt: Date.now() 
	})
	
	const file = await assembleFileFromChunks(meetingId)
	if (file.size === 0) {
		await db.meetings.update(meetingId, { status: 'local', updatedAt: Date.now() })
		throw new Error('No audio data found for this meeting')
	}
	
	try {
		// Use old blocking method
		const language = meeting.language || 'auto'
		const res = await transcribeAndSummarize(file, { language })
		
		// Save results locally
		await db.notes.put({ 
			meetingId, 
			transcript: res.transcript.text, 
			createdAt: Date.now(), 
			summary: res.summary 
		})
		
		// Mark as synced
		await markMeetingAsSynced(meetingId, meetingId)
		
		console.log(`✅ Successfully synced meeting ${meetingId} (blocking method)`)
		
	} catch (e) {
		await db.meetings.update(meetingId, { 
			status: 'local', 
			updatedAt: Date.now() 
		})
		throw e
	}
}

/**
 * 🚨 CRITICAL FIX: Fetch and store processed results from VPS
 */
async function fetchAndStoreProcessedResults(meetingId: string): Promise<void> {
	try {
		console.log(`📥 Fetching processed meeting data from VPS for ${meetingId}`)
		
		// Fetch the meeting from VPS with processed results
		const vpsMeeting = await getApiMeeting(meetingId)
		
		if (!vpsMeeting) {
			throw new Error('Meeting not found on VPS after processing')
		}
		
		console.log(`📄 VPS meeting data:`, {
			id: vpsMeeting.id,
			title: vpsMeeting.title,
			hasTranscription: !!vpsMeeting.transcription,
			hasSummary: !!vpsMeeting.summary,
			transcriptionLength: vpsMeeting.transcription?.length || 0,
			summaryLength: vpsMeeting.summary?.length || 0
		})
		
		// Store or update the transcript and summary
		if (vpsMeeting.transcription || vpsMeeting.summary) {
			await db.notes.put({
				meetingId,
				transcript: vpsMeeting.transcription || '',
				summary: vpsMeeting.summary || undefined,
				createdAt: Date.now()
			})
			console.log(`✅ Stored processed results for meeting ${meetingId}`)
		}
		
		// Update meeting metadata if available
		const updateData: any = { 
			updatedAt: Date.now()
		}
		
		if (vpsMeeting.title) updateData.title = vpsMeeting.title
		if (vpsMeeting.language) updateData.language = vpsMeeting.language
		if (typeof vpsMeeting.duration === 'number') updateData.duration = vpsMeeting.duration
		
		await db.meetings.update(meetingId, updateData)
		
		console.log(`✅ Successfully fetched and stored processed results for ${meetingId}`)
		
	} catch (error) {
		console.error(`❌ Failed to fetch processed results for ${meetingId}:`, error)
		throw new Error(`Failed to retrieve processed results: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
	if (meeting.status === 'synced') {
		console.log(`✅ Meeting ${meetingId} already processed (status: synced). Skipping to prevent duplicate.`)
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
					if (meetingId && id && meetingId.length > 16 && id.length > 16) {
						if (id.includes(meetingId.slice(8, 16)) || meetingId.includes(id.slice(8, 16))) {
							console.error(`🔍 Potential match found: ${id} vs ${meetingId}`)
						}
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
			status: 'synced', 
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
