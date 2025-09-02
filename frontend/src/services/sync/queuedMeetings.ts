import { db } from '../db'
import { syncMeeting } from '../offline'

/**
 * Process all queued meetings when coming back online
 */
export async function processQueuedMeetings(): Promise<void> {
  console.log('🔄 Processing queued meetings...')
  
  const meetings = await db.meetings
    .where('status')
    .anyOf(['queued', 'local'])
    .toArray()
  
  console.log('📋 Found meetings to sync:', meetings.length)
  
  if (meetings.length === 0) {
    console.log('✅ No queued meetings to process')
    return
  }
  
  let processed = 0
  let failed = 0
  
  for (const meeting of meetings) {
    try {
      console.log(`📡 Syncing meeting: ${meeting.id} (${meeting.title})`)
      
      // Check if meeting has audio chunks
      const chunkCount = await db.chunks
        .where('meetingId')
        .equals(meeting.id)
        .count()
      
      if (chunkCount === 0) {
        console.warn(`⚠️ Meeting ${meeting.id} has no audio chunks, skipping sync`)
        // Update status to indicate no content to sync
        await db.meetings.update(meeting.id, {
          status: 'local',
          updatedAt: Date.now()
        })
        continue
      }
      
      // Attempt to sync the meeting
      await syncMeeting(meeting.id, (progress) => {
        console.log(`📊 Sync progress for ${meeting.id}: ${progress.progress}% - ${progress.message}`)
      })
      
      processed++
      console.log(`✅ Successfully synced meeting: ${meeting.id}`)
      
    } catch (error) {
      failed++
      console.error(`❌ Failed to sync meeting ${meeting.id}:`, error)
      
      // Revert status to allow retry later
      await db.meetings.update(meeting.id, {
        status: 'local',
        last_sync_attempt: Date.now(),
        updatedAt: Date.now()
      })
    }
  }
  
  console.log(`✅ Queued meeting processing completed: ${processed} succeeded, ${failed} failed`)
}

/**
 * Get count of meetings waiting to be synced
 */
export async function getQueuedMeetingsCount(): Promise<number> {
  return await db.meetings
    .where('status')
    .anyOf(['queued', 'local'])
    .count()
}

/**
 * Get meetings that failed sync recently (for retry logic)
 */
export async function getFailedSyncMeetings(maxAgeMs: number = 30 * 60 * 1000): Promise<any[]> {
  const cutoff = Date.now() - maxAgeMs
  
  const meetings = await db.meetings
    .where('status')
    .equals('local')
    .and(meeting => {
      return meeting.last_sync_attempt && meeting.last_sync_attempt > cutoff
    })
    .toArray()
  
  return meetings
}

/**
 * Retry failed sync meetings with exponential backoff
 */
export async function retryFailedSyncMeetings(): Promise<void> {
  console.log('🔄 Retrying failed sync meetings...')
  
  const failedMeetings = await getFailedSyncMeetings()
  
  if (failedMeetings.length === 0) {
    console.log('✅ No failed sync meetings to retry')
    return
  }
  
  console.log(`📋 Found ${failedMeetings.length} failed sync meetings to retry`)
  
  for (const meeting of failedMeetings) {
    try {
      console.log(`🔄 Retrying sync for meeting: ${meeting.id}`)
      
      // Update status to queued for retry
      await db.meetings.update(meeting.id, {
        status: 'queued',
        updatedAt: Date.now()
      })
      
      await syncMeeting(meeting.id)
      console.log(`✅ Successfully retried sync for meeting: ${meeting.id}`)
      
    } catch (error) {
      console.error(`❌ Retry failed for meeting ${meeting.id}:`, error)
      // Keep as local for next retry attempt
    }
  }
}
