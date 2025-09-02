/**
 * Local Processing Service
 * 
 * This service provides offline-first meeting processing using local Tauri Whisper
 * instead of the remote VPS. It integrates with the existing meeting pipeline.
 */

import { db } from '../db'
import { getMeeting } from './meetingOperations'
import { assembleFileFromChunks, assembleFilesByAudioType } from './fileOperations'
import { tauriWhisperService, type LocalProcessingResult } from '../tauriWhisper'

/**
 * Process a meeting locally using Tauri Whisper
 * This is the LOCAL alternative to syncMeeting() and autoProcessMeetingRecording()
 */
export async function processLocalMeeting(
  meetingId: string, 
  title?: string,
  onProgress?: (progress: { phase: string; progress: number; message: string }) => void
): Promise<void> {
  console.log(`🚀 Processing meeting ${meetingId} locally with Tauri Whisper...`)
  
  const meeting = await getMeeting(meetingId)
  if (!meeting) {
    throw new Error('Meeting not found')
  }

  // Check if already processed
  if (meeting.status === 'synced') {
    console.log(`✅ Meeting ${meetingId} already processed. Skipping.`)
    return
  }

  if (meeting.status === 'queued') {
    console.log(`⏳ Meeting ${meetingId} already being processed. Skipping.`)
    return
  }

  // Mark as processing
  await db.meetings.update(meetingId, { 
    status: 'queued', 
    updatedAt: Date.now() 
  })

  try {
    // Step 1: Initialize Whisper
    onProgress?.({ phase: 'INITIALIZING', progress: 5, message: 'Initializing local AI...' })
    await tauriWhisperService.initialize()

    // Step 2: Assemble audio file
    onProgress?.({ phase: 'PREPARING', progress: 15, message: 'Preparing audio file...' })
    let file = await assembleFileFromChunks(meetingId)
    
    if (file.size === 0) {
      throw new Error('No audio data found for this meeting')
    }

    console.log(`📁 Audio file prepared: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)

    // Step 3: Transcribe and process
    onProgress?.({ phase: 'TRANSCRIBING', progress: 30, message: 'Transcribing with local AI...' })
    
    const language = meeting.language || 'auto'
    console.log(`🎤 Starting transcription with language: ${language}`)
    
    const result = await tauriWhisperService.transcribeAndSummarize(file, { language })
    
    onProgress?.({ phase: 'SUMMARIZING', progress: 80, message: 'Generating summary...' })

    // Step 4: Save results
    onProgress?.({ phase: 'SAVING', progress: 90, message: 'Saving results...' })
    
    await db.notes.put({ 
      meetingId, 
      transcript: result.transcript.text, 
      createdAt: Date.now(), 
      summary: result.summary 
    })

    // Update meeting with results
    const updateData: any = { 
      status: 'synced', 
      updatedAt: Date.now(),
      // Store processing metadata
      processing_method: 'local_tauri',
      processing_time_ms: result.processing_time_ms,
      detected_language: result.transcript.language,
      confidence: result.transcript.confidence
    }

    if (title && title.trim()) {
      updateData.title = title.trim()
    }

    await db.meetings.update(meetingId, updateData)

    onProgress?.({ phase: 'COMPLETED', progress: 100, message: 'Local processing completed!' })
    
    console.log(`✅ Meeting ${meetingId} processed locally in ${(result.processing_time_ms / 1000).toFixed(2)}s`)

  } catch (error) {
    console.error(`❌ Local processing failed for meeting ${meetingId}:`, error)
    
    // Reset status to local on failure
    await db.meetings.update(meetingId, { 
      status: 'local', 
      updatedAt: Date.now() 
    })
    
    onProgress?.({ phase: 'ERROR', progress: 0, message: `Processing failed: ${error}` })
    throw error
  }
}

/**
 * Process multiple meetings locally in batch
 */
export async function processLocalMeetingsBatch(
  meetingIds: string[],
  onProgress?: (overall: { completed: number; total: number; current?: string }) => void
): Promise<void> {
  console.log(`🔄 Processing ${meetingIds.length} meetings locally...`)
  
  for (let i = 0; i < meetingIds.length; i++) {
    const meetingId = meetingIds[i]
    
    onProgress?.({ completed: i, total: meetingIds.length, current: meetingId })
    
    try {
      await processLocalMeeting(meetingId)
      console.log(`✅ Batch progress: ${i + 1}/${meetingIds.length} - ${meetingId} completed`)
    } catch (error) {
      console.error(`❌ Batch progress: ${i + 1}/${meetingIds.length} - ${meetingId} failed:`, error)
      // Continue with next meeting even if one fails
    }
  }
  
  onProgress?.({ completed: meetingIds.length, total: meetingIds.length })
  console.log(`🎉 Batch processing completed: ${meetingIds.length} meetings`)
}

/**
 * Check if a meeting can be processed locally
 */
export async function canProcessLocally(meetingId: string): Promise<{ canProcess: boolean; reason?: string }> {
  try {
    const meeting = await getMeeting(meetingId)
    if (!meeting) {
      return { canProcess: false, reason: 'Meeting not found' }
    }

    if (meeting.status === 'synced') {
      return { canProcess: false, reason: 'Already processed' }
    }

    const file = await assembleFileFromChunks(meetingId)
    if (file.size === 0) {
      return { canProcess: false, reason: 'No audio data available' }
    }

    // Check if Whisper is available
    const isAvailable = await tauriWhisperService.testLocalProcessing()
    if (!isAvailable) {
      return { canProcess: false, reason: 'Local Whisper service not available' }
    }

    return { canProcess: true }
  } catch (error) {
    return { canProcess: false, reason: `Error: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Get local processing capabilities and status
 */
export async function getLocalProcessingStatus(): Promise<{
  available: boolean
  capabilities?: any
  models?: any[]
  languages?: Array<[string, string]>
  error?: string
}> {
  try {
    console.log('🔍 Checking local processing status...')
    
    // Check if we're in Tauri environment first
    if (typeof window === 'undefined' || !(window as any).__TAURI__) {
      console.log('ℹ️ Local processing not available - not running in Tauri environment')
      return { available: false, error: 'Local processing only available in desktop app' }
    }
    
    // Test if Tauri Whisper is working
    const testResult = await tauriWhisperService.testLocalProcessing()
    if (!testResult) {
      return { available: false, error: 'Local Whisper test failed' }
    }

    // Get capabilities
    const [capabilities, models, languages] = await Promise.all([
      tauriWhisperService.checkCapabilities().catch(() => null),
      tauriWhisperService.getAvailableModels().catch(() => []),
      tauriWhisperService.getSupportedLanguages().catch(() => [])
    ])

    return {
      available: true,
      capabilities,
      models,
      languages
    }
  } catch (error) {
    console.log('ℹ️ Failed to check local processing status:', error)
    // Don't return error for environment issues
    if (error instanceof Error && error.message.includes('Tauri environment')) {
      return { available: false, error: 'Local processing only available in desktop app' }
    }
    return { available: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Get all meetings that can be processed locally
 */
export async function getProcessableMeetings(): Promise<any[]> {
  const meetings = await db.meetings
    .where('status')
    .anyOf(['local', 'recording'])
    .toArray()

  const processableMeetings = []
  
  for (const meeting of meetings) {
    const { canProcess } = await canProcessLocally(meeting.id)
    if (canProcess) {
      processableMeetings.push(meeting)
    }
  }

  return processableMeetings
}

/**
 * Auto-process all eligible meetings locally
 */
export async function autoProcessAllLocal(
  onProgress?: (progress: { phase: string; completed: number; total: number; current?: string }) => void
): Promise<{ processed: number; failed: number; skipped: number }> {
  console.log('🚀 Starting auto-process for all local meetings...')
  
  const meetings = await getProcessableMeetings()
  console.log(`📋 Found ${meetings.length} meetings eligible for local processing`)
  
  let processed = 0
  let failed = 0
  let skipped = 0
  
  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i]
    
    onProgress?.({ 
      phase: 'PROCESSING', 
      completed: i, 
      total: meetings.length, 
      current: meeting.title || meeting.id 
    })
    
    try {
      await processLocalMeeting(meeting.id, meeting.title)
      processed++
      console.log(`✅ Auto-processed: ${meeting.title || meeting.id}`)
    } catch (error) {
      failed++
      console.error(`❌ Auto-process failed for ${meeting.title || meeting.id}:`, error)
    }
  }
  
  onProgress?.({ 
    phase: 'COMPLETED', 
    completed: meetings.length, 
    total: meetings.length 
  })
  
  const summary = { processed, failed, skipped }
  console.log('🎉 Auto-processing summary:', summary)
  
  return summary
}

// Export main functions for easy imports
export { 
  processLocalMeeting as processLocalMeetingRecording,
  canProcessLocally as canProcessMeetingLocally
}
