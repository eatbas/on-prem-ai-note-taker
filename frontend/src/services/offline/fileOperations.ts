// File assembly and download operations

import { getChunks } from './chunkOperations'

// Helper function to detect audio format from blob types
function detectAudioFormat(blobs: Blob[]): { mimeType: string; extension: string } {
  if (blobs.length === 0) {
    return { mimeType: 'audio/webm', extension: 'webm' }
  }
  
  // Check the first blob's type
  const firstBlobType = blobs[0].type
  
  if (firstBlobType.includes('wav')) {
    return { mimeType: 'audio/wav', extension: 'wav' }
  } else if (firstBlobType.includes('webm')) {
    return { mimeType: 'audio/webm', extension: 'webm' }
  } else if (firstBlobType.includes('ogg')) {
    return { mimeType: 'audio/ogg', extension: 'ogg' }
  } else {
    // Default fallback
    return { mimeType: 'audio/webm', extension: 'webm' }
  }
}

export async function assembleFileFromChunks(meetingId: string): Promise<File> {
	const parts = await getChunks(meetingId)
	const blobs = parts.map(p => p.blob)
	const { mimeType, extension } = detectAudioFormat(blobs)
	console.log(`🎵 Detected audio format for ${meetingId}: ${mimeType}`)
	return new File(blobs, `${meetingId}.${extension}`, { type: mimeType })
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
		const { mimeType, extension } = detectAudioFormat(micBlobs)
		result.microphone = new File(micBlobs, `${meetingId}_microphone.${extension}`, { type: mimeType })
		console.log(`🎙️ Microphone audio file: ${microphoneChunks.length} chunks, ${(result.microphone.size / 1024).toFixed(2)} KB, format: ${mimeType}`)
	}
	
	// Assemble system audio file
	if (systemChunks.length > 0) {
		const systemBlobs = systemChunks.map(c => c.blob)
		const { mimeType, extension } = detectAudioFormat(systemBlobs)
		result.system = new File(systemBlobs, `${meetingId}_system.${extension}`, { type: mimeType })
		console.log(`🔊 System audio file: ${systemChunks.length} chunks, ${(result.system.size / 1024).toFixed(2)} KB, format: ${mimeType}`)
	}
	
	// Assemble speaker audio file (for single-stream recordings)
	if (speakerChunks.length > 0) {
		const speakerBlobs = speakerChunks.map(c => c.blob)
		const { mimeType, extension } = detectAudioFormat(speakerBlobs)
		result.speaker = new File(speakerBlobs, `${meetingId}_speaker.${extension}`, { type: mimeType })
		console.log(`🗣️ Speaker audio file: ${speakerChunks.length} chunks, ${(result.speaker.size / 1024).toFixed(2)} KB, format: ${mimeType}`)
	}
	
	// Assemble mixed audio file (fallback)
	if (mixedChunks.length > 0) {
		const mixedBlobs = mixedChunks.map(c => c.blob)
		const { mimeType, extension } = detectAudioFormat(mixedBlobs)
		result.mixed = new File(mixedBlobs, `${meetingId}_mixed.${extension}`, { type: mimeType })
		console.log(`🔄 Mixed audio file: ${mixedChunks.length} chunks, ${(result.mixed.size / 1024).toFixed(2)} KB, format: ${mimeType}`)
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
