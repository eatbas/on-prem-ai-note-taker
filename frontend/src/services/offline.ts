import { db, Meeting, Chunk, AudioType } from './db'
import { transcribeAndSummarize } from './api'

export function generateId(prefix = 'id'): string {
	return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

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

export async function addChunk(meetingId: string, blob: Blob, index: number, audioType: AudioType = 'mixed'): Promise<void> {
	console.log(`💾 addChunk called:`, {
		meetingId: meetingId.slice(0, 8) + '...',
		blobSize: blob.size,
		blobType: blob.type,
		index,
		audioType, // NEW: Log audio source type
		timestamp: new Date().toISOString()
	})
	
	const chunk: Chunk = {
		id: generateId('chunk'),
		meetingId,
		index,
		blob,
		createdAt: Date.now(),
		audioType, // NEW: Store audio source type for Whisper optimization
	}
	
	try {
		await db.chunks.add(chunk)
		console.log(`✅ Chunk ${index} (${audioType}) saved successfully to database (${blob.size} bytes)`)
	} catch (error) {
		console.error(`❌ Failed to save chunk ${index} (${audioType}) to database:`, error)
		throw error
	}
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

// WHISPER OPTIMIZATION: Assemble files by audio type for separate processing
export async function assembleFilesByAudioType(meetingId: string): Promise<{
	microphone?: File
	system?: File
	speaker?: File
	mixed?: File
	hasSeparateStreams: boolean
}> {
	console.log('🎯 Assembling Whisper-optimized audio files by type...')
	
	const allChunks = await db.chunks.where('meetingId').equals(meetingId).sortBy('index')
	
	// Group chunks by audio type
	const micChunks = allChunks.filter(chunk => chunk.audioType === 'microphone').sort((a, b) => a.index - b.index)
	const systemChunks = allChunks.filter(chunk => chunk.audioType === 'system').sort((a, b) => a.index - b.index)
	const speakerChunks = allChunks.filter(chunk => chunk.audioType === 'speaker').sort((a, b) => a.index - b.index)
	const mixedChunks = allChunks.filter(chunk => chunk.audioType === 'mixed').sort((a, b) => a.index - b.index)
	
	const result: {
		microphone?: File
		system?: File
		speaker?: File
		mixed?: File
		hasSeparateStreams: boolean
	} = {
		hasSeparateStreams: micChunks.length > 0 && (systemChunks.length > 0 || speakerChunks.length > 0)
	}
	
	// Create microphone file if chunks exist
	if (micChunks.length > 0) {
		const micBlobs = micChunks.map(chunk => chunk.blob)
		result.microphone = new File(micBlobs, `${meetingId}_microphone.webm`, { type: 'audio/webm' })
		console.log(`🎤 Microphone file: ${micChunks.length} chunks, ${(result.microphone.size / 1024).toFixed(2)} KB`)
	}
	
	// Create system audio file if chunks exist  
	if (systemChunks.length > 0) {
		const systemBlobs = systemChunks.map(chunk => chunk.blob)
		result.system = new File(systemBlobs, `${meetingId}_system.webm`, { type: 'audio/webm' })
		console.log(`🔊 System audio file: ${systemChunks.length} chunks, ${(result.system.size / 1024).toFixed(2)} KB`)
	}
	
	// Create speaker audio file if chunks exist
	if (speakerChunks.length > 0) {
		const speakerBlobs = speakerChunks.map(chunk => chunk.blob)
		result.speaker = new File(speakerBlobs, `${meetingId}_speaker.webm`, { type: 'audio/webm' })
		console.log(`🔊 Speaker audio file: ${speakerChunks.length} chunks, ${(result.speaker.size / 1024).toFixed(2)} KB`)
	}
	
	// Create mixed file if chunks exist (fallback compatibility)
	if (mixedChunks.length > 0) {
		const mixedBlobs = mixedChunks.map(chunk => chunk.blob)
		result.mixed = new File(mixedBlobs, `${meetingId}_mixed.webm`, { type: 'audio/webm' })
		console.log(`🔄 Mixed audio file: ${mixedChunks.length} chunks, ${(result.mixed.size / 1024).toFixed(2)} KB`)
	}
	
	console.log('🎯 Whisper Audio File Analysis:', {
		microphone: result.microphone ? `${(result.microphone.size / 1024).toFixed(2)} KB` : 'None',
		system: result.system ? `${(result.system.size / 1024).toFixed(2)} KB` : 'None',
		speaker: result.speaker ? `${(result.speaker.size / 1024).toFixed(2)} KB` : 'None',
		mixed: result.mixed ? `${(result.mixed.size / 1024).toFixed(2)} KB` : 'None',
		hasSeparateStreams: result.hasSeparateStreams
	})
	
	return result
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
	console.log(`📁 Assembled file: ${file.name}, size: ${file.size} bytes`)
	
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
		
		console.log(`✅ Auto-process result:`, result)
		
		// Save the results to local database
		await db.notes.put({ 
			meetingId, 
			transcript: result.transcript.text, 
			createdAt: Date.now(), 
			summary: result.summary 
		})
		
		// Update meeting status and metadata
		await db.meetings.update(meetingId, { 
			status: 'sent', 
			updatedAt: Date.now(),
			title: title || meeting.title
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

// WHISPER OPTIMIZATION: Enhanced auto-processing with dual audio support
export async function autoProcessMeetingRecordingWithWhisperOptimization(
	meetingId: string,
	title?: string
): Promise<void> {
	console.log('🎯 WHISPER OPTIMIZATION: Starting enhanced audio processing...')
	
	const meeting = await db.meetings.get(meetingId)
	if (!meeting) {
		throw new Error('Meeting not found')
	}
	
	// Check for dual recording files first (Whisper optimization)
	const audioFiles = await assembleFilesByAudioType(meetingId)
	
	if (!audioFiles.microphone && !audioFiles.system && !audioFiles.mixed) {
		throw new Error('No audio data found for this meeting')
	}
	
	const language = meeting.language || 'auto'
	const meetingTitle = title || meeting.title
	
	// WHISPER OPTIMIZATION: Process separate audio streams if available
	if (audioFiles.hasSeparateStreams && audioFiles.microphone && audioFiles.system) {
		console.log('🎯 PERFECT WHISPER SETUP: Processing separate mic and system audio for maximum accuracy!')
		
		try {
			// Use the dedicated dual audio backend endpoint for speaker diarization
			console.log('🎯 PROCESSING DUAL AUDIO: Processing both streams separately...')
			
			// Process microphone and system audio separately, then combine
			const [micResult, systemResult] = await Promise.all([
				audioFiles.microphone ? transcribeAndSummarize(audioFiles.microphone, { language }) : null,
				audioFiles.system ? transcribeAndSummarize(audioFiles.system, { language }) : null
			])
			
			// Combine transcripts with speaker labels
			let combinedTranscript = ''
			if (micResult && systemResult) {
				combinedTranscript = combineTranscriptsWithSpeakers(micResult.transcript.text, systemResult.transcript.text)
			} else if (micResult) {
				combinedTranscript = `Microphone: ${micResult.transcript.text}`
			} else if (systemResult) {
				combinedTranscript = `System Audio: ${systemResult.transcript.text}`
			}
			
			// Use the better summary (usually from the main audio stream)
			const finalSummary = micResult?.summary || systemResult?.summary || 'No summary available'
			
			console.log('🎉 DUAL AUDIO SUCCESS: Combined transcript created')
			
			// Save enhanced results from dual audio processing
			await db.notes.put({ 
				meetingId, 
				transcript: combinedTranscript, 
				createdAt: Date.now(), 
				summary: finalSummary
			})
			
			await db.meetings.update(meetingId, { 
				status: 'sent', 
				updatedAt: Date.now(),
				title: meetingTitle
			})
			
			console.log('✅ WHISPER OPTIMIZATION SUCCESS: Dual audio processing completed!')
			return
			
		} catch (error) {
			console.warn('⚠️ Dual processing failed, falling back to mixed audio:', error)
			// Fall through to mixed audio processing
		}
	}
	
	// Fallback: Process single audio file (mixed or available stream)
	const fallbackFile = audioFiles.mixed || audioFiles.microphone || audioFiles.system!
	console.log(`🔄 Processing fallback audio file: ${fallbackFile.name} (${(fallbackFile.size / 1024 / 1024).toFixed(2)} MB)`)
	
	try {
		const result = await transcribeAndSummarize(fallbackFile, { language })
		
		// Save the results to local database
		await db.notes.put({ 
			meetingId, 
			transcript: result.transcript.text, 
			createdAt: Date.now(), 
			summary: result.summary 
		})
		
		// Update meeting status and metadata
		await db.meetings.update(meetingId, { 
			status: 'sent', 
			updatedAt: Date.now(),
			title: meetingTitle
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
				throw new Error('Authentication failed. Check your API credentials.')
			} else if (e.message.includes('503') || e.message.includes('500')) {
				throw new Error('Backend server error. The AI service may be temporarily unavailable.')
			}
		}
		
		throw e
	}
}

// Helper function to combine transcripts with speaker labels
function combineTranscriptsWithSpeakers(micTranscript: string, systemTranscript: string): string {
	const lines: string[] = []
	
	if (micTranscript.trim()) {
		lines.push('## Speaker: USER (Microphone)')
		lines.push(micTranscript.trim())
		lines.push('')
	}
	
	if (systemTranscript.trim()) {
		lines.push('## Speaker: OTHERS (System Audio)')
		lines.push(systemTranscript.trim())
		lines.push('')
	}
	
	lines.push('---')
	lines.push('*This transcript was processed using Whisper dual-stream optimization for perfect speaker separation.*')
	
	return lines.join('\n')
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


