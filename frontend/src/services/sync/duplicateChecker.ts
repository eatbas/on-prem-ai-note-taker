/**
 * Duplicate Meeting Prevention Service
 * 
 * This service prevents uploading meetings that already exist on the VPS,
 * reducing server load and avoiding unnecessary processing.
 */

import { apiRequest } from '../api/core'
import { db } from '../db'

export interface SyncedMeetingInfo {
  id: string
  updated_at: string
  title?: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  vpsUpdatedAt?: string
  localUpdatedAt?: number
  shouldSync: boolean
  reason: string
}

/**
 * Check if a meeting already exists on VPS
 */
export async function checkMeetingExists(meetingId: string): Promise<boolean> {
  try {
    console.log(`🔍 Checking if meeting ${meetingId} exists on VPS...`)
    
    const response = await apiRequest<{ exists: boolean }>(`/meetings/check/${meetingId}`)
    
    console.log(`📝 Meeting ${meetingId} exists on VPS: ${response.exists}`)
    return response.exists
    
  } catch (error) {
    console.log(`ℹ️ Failed to check meeting existence for ${meetingId} (this is normal if offline):`, error)
    // If we can't check, assume it doesn't exist and allow sync
    return false
  }
}

/**
 * Get list of all synced meeting IDs from VPS
 */
export async function getSyncedMeetingIds(scope?: 'personal' | 'workspace' | 'all'): Promise<SyncedMeetingInfo[]> {
  try {
    console.log(`📊 Fetching synced meeting IDs from VPS (scope: ${scope || 'all'})...`)
    
    const params = scope ? `?scope=${scope}` : ''
    const meetings = await apiRequest<SyncedMeetingInfo[]>(`/meetings/synced${params}`)
    
    console.log(`✅ Found ${meetings.length} synced meetings on VPS`)
    return meetings
    
  } catch (error) {
    console.log(`ℹ️ Failed to fetch synced meeting IDs (this is normal if offline or not authenticated):`, error)
    // Return empty array instead of throwing - this is a non-critical operation
    return []
  }
}

/**
 * Comprehensive duplicate check with recommendations
 */
export async function performDuplicateCheck(meetingId: string): Promise<DuplicateCheckResult> {
  try {
    // Get local meeting info
    const localMeeting = await db.meetings.get(meetingId)
    if (!localMeeting) {
      return {
        isDuplicate: false,
        shouldSync: false,
        reason: 'Meeting not found locally'
      }
    }

    // Check if already marked as synced
    if (localMeeting.status === 'synced') {
      return {
        isDuplicate: true,
        shouldSync: false,
        reason: 'Meeting already marked as synced locally'
      }
    }

    // Check VPS for existence
    const existsOnVps = await checkMeetingExists(meetingId)
    
    if (!existsOnVps) {
      return {
        isDuplicate: false,
        shouldSync: true,
        reason: 'Meeting not found on VPS, safe to sync'
      }
    }

    // Meeting exists on VPS - this is a duplicate
    return {
      isDuplicate: true,
      shouldSync: false,
      localUpdatedAt: localMeeting.updatedAt,
      reason: 'Meeting already exists on VPS'
    }

  } catch (error) {
    console.error(`❌ Duplicate check failed for ${meetingId}:`, error)
    // On error, assume it's safe to sync
    return {
      isDuplicate: false,
      shouldSync: true,
      reason: 'Duplicate check failed, assuming safe to sync'
    }
  }
}

/**
 * Mark a meeting as synced and optionally clean up local data
 */
export async function markMeetingAsSynced(meetingId: string, vpsId?: string): Promise<void> {
  try {
    console.log(`✅ Marking meeting ${meetingId} as synced`)
    
    await db.meetings.update(meetingId, {
      status: 'synced',
      vps_id: vpsId || meetingId,
      updatedAt: Date.now()
    })
    
    console.log(`📝 Meeting ${meetingId} marked as synced with VPS ID: ${vpsId || meetingId}`)
    
  } catch (error) {
    console.error(`❌ Failed to mark meeting ${meetingId} as synced:`, error)
    throw error
  }
}

/**
 * Cleanup meetings that are confirmed to be synced on VPS
 * This runs on app startup to clean up any inconsistent state
 */
export async function cleanupSyncedMeetings(): Promise<void> {
  try {
    console.log('🧹 Starting cleanup of synced meetings...')
    
    // Get all local meetings that might need cleanup
    const localMeetings = await db.meetings.where('status').anyOf(['synced', 'processing', 'uploading']).toArray()
    
    if (localMeetings.length === 0) {
      console.log('✨ No meetings need cleanup')
      return
    }
    
    console.log(`🔍 Checking ${localMeetings.length} meetings for cleanup...`)
    
    // Get all synced meetings from VPS
    const syncedMeetings = await getSyncedMeetingIds()
    const syncedIds = new Set(syncedMeetings.map(m => m.id))
    
    let cleanedCount = 0
    
    for (const meeting of localMeetings) {
      if (syncedIds.has(meeting.id)) {
        // Meeting exists on VPS, mark as synced
        await markMeetingAsSynced(meeting.id, meeting.vps_id)
        cleanedCount++
        console.log(`✅ Cleaned up meeting: ${meeting.title} (${meeting.id})`)
      } else if (meeting.status === 'synced') {
        // Marked as synced locally but not found on VPS - might be orphaned
        console.warn(`⚠️ Meeting ${meeting.id} marked as synced but not found on VPS`)
        // Optionally revert to local status for re-sync
        await db.meetings.update(meeting.id, { status: 'local' })
      }
    }
    
    console.log(`🧹 Cleanup completed: ${cleanedCount} meetings processed`)
    
  } catch (error) {
    console.error('❌ Failed to cleanup synced meetings:', error)
  }
}
