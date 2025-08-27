// File assembly and download operations

import { getChunks } from './chunkOperations'

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
	console.log(`🎯 Assembling audio files by type for meeting ${meetingId}...`)
	
	const chunks = await getChunks(meetingId)
	console.log(`📋 Found ${chunks.length} total chunks`)
	
	const result: {
		microphone?: File
		system?: File
		speaker?: File
		mixed?: File
		hasSeparateStreams: boolean
	} = {
		hasSeparateStreams: false
	}
	
	// Group chunks by audio type
	const microphoneChunks = chunks.filter(c => c.audioType === 'microphone')
	const systemChunks = chunks.filter(c => c.audioType === 'system')
	const speakerChunks = chunks.filter(c => c.audioType === 'speaker')
	const mixedChunks = chunks.filter(c => c.audioType === 'mixed')
	
	console.log(`🎙️ Chunk breakdown:`, {
		microphone: microphoneChunks.length,
		system: systemChunks.length,
		speaker: speakerChunks.length,
		mixed: mixedChunks.length
	})
	
	// Check if we have separate streams (microphone AND system audio)
	result.hasSeparateStreams = microphoneChunks.length > 0 && systemChunks.length > 0
	
	// Assemble microphone audio file
	if (microphoneChunks.length > 0) {
		const micBlobs = microphoneChunks.map(c => c.blob)
		result.microphone = new File(micBlobs, `${meetingId}_microphone.webm`, { type: 'audio/webm' })
		console.log(`🎙️ Microphone audio file: ${microphoneChunks.length} chunks, ${(result.microphone.size / 1024).toFixed(2)} KB`)
	}
	
	// Assemble system audio file
	if (systemChunks.length > 0) {
		const systemBlobs = systemChunks.map(c => c.blob)
		result.system = new File(systemBlobs, `${meetingId}_system.webm`, { type: 'audio/webm' })
		console.log(`🔊 System audio file: ${systemChunks.length} chunks, ${(result.system.size / 1024).toFixed(2)} KB`)
	}
	
	// Assemble speaker audio file (for single-stream recordings)
	if (speakerChunks.length > 0) {
		const speakerBlobs = speakerChunks.map(c => c.blob)
		result.speaker = new File(speakerBlobs, `${meetingId}_speaker.webm`, { type: 'audio/webm' })
		console.log(`🗣️ Speaker audio file: ${speakerChunks.length} chunks, ${(result.speaker.size / 1024).toFixed(2)} KB`)
	}
	
	// Assemble mixed audio file (fallback)
	if (mixedChunks.length > 0) {
		const mixedBlobs = mixedChunks.map(c => c.blob)
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
