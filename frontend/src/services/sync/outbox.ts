import { db, OutboxItem } from '../db'
import { updateMeeting, deleteMeeting } from '../api'

/**
 * Enqueue a mutation for offline-first operation
 */
export async function enqueueOutbox(
  type: 'rename_meeting' | 'update_tags' | 'delete_meeting',
  payload: any
): Promise<number> {
  console.log('📤 Enqueuing outbox operation:', { type, payload })
  
  const item: OutboxItem = {
    type,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending'
  }
  
  const id = await db.outbox.add(item)
  console.log('✅ Enqueued outbox item with ID:', id)
  return id
}

/**
 * Process all pending outbox items
 */
export async function processOutbox(): Promise<void> {
  console.log('🔄 Processing outbox queue...')
  
  const items = await db.outbox
    .where('status')
    .anyOf(['pending', 'error'])
    .orderBy('createdAt')
    .toArray()
  
  console.log('📋 Found outbox items to process:', items.length)
  
  if (items.length === 0) {
    console.log('✅ Outbox is empty')
    return
  }
  
  for (const item of items) {
    await processOutboxItem(item)
  }
  
  console.log('✅ Outbox processing completed')
}

/**
 * Process a single outbox item
 */
async function processOutboxItem(item: OutboxItem): Promise<void> {
  if (!item.id) return
  
  console.log(`📡 Processing outbox item ${item.id}:`, item.type)
  
  try {
    // Mark as processing
    await db.outbox.update(item.id, {
      status: 'processing',
      attempts: item.attempts + 1
    })
    
    // Execute the operation
    switch (item.type) {
      case 'rename_meeting': {
        const { meetingId, title } = item.payload
        console.log(`✏️ Renaming meeting ${meetingId} to "${title}"`)
        
        await updateMeeting(meetingId, title)
        
        // Update local DB to ensure consistency
        await db.meetings.update(meetingId, {
          title,
          updatedAt: Date.now()
        })
        
        break
      }
      
      case 'update_tags': {
        const { meetingId, tags } = item.payload
        console.log(`🏷️ Updating tags for meeting ${meetingId}:`, tags)
        
        // Note: If you add a tags API endpoint, call it here
        // For now, just update locally (tags are already updated when enqueued)
        await db.meetings.update(meetingId, {
          tags,
          updatedAt: Date.now()
        })
        
        break
      }
      
      case 'delete_meeting': {
        const { meetingId } = item.payload
        console.log(`🗑️ Deleting meeting ${meetingId}`)
        
        try {
          // Try to delete from server (may fail if meeting doesn't exist)
          await deleteMeeting(meetingId)
        } catch (error) {
          console.warn('Failed to delete from server (may not exist):', error)
          // Continue with local deletion
        }
        
        // Clean up local data
        await db.meetings.delete(meetingId)
        await db.notes.delete(meetingId)
        await db.chunks.where('meetingId').equals(meetingId).delete()
        
        break
      }
      
      default:
        console.warn('Unknown outbox operation type:', item.type)
        break
    }
    
    // Mark as completed
    await db.outbox.update(item.id, {
      status: 'done'
    })
    
    console.log(`✅ Successfully processed outbox item ${item.id}`)
    
  } catch (error: any) {
    console.error(`❌ Failed to process outbox item ${item.id}:`, error)
    
    // Mark as error with details
    await db.outbox.update(item.id, {
      status: 'error',
      lastError: error?.message || String(error)
    })
    
    // Don't throw - continue processing other items
  }
}

/**
 * Get count of pending outbox items
 */
export async function getPendingOutboxCount(): Promise<number> {
  return await db.outbox
    .where('status')
    .anyOf(['pending', 'processing'])
    .count()
}

/**
 * Clear completed outbox items (cleanup)
 */
export async function clearCompletedOutboxItems(): Promise<number> {
  const deleted = await db.outbox
    .where('status')
    .equals('done')
    .delete()
  
  console.log('🧹 Cleared completed outbox items:', deleted)
  return deleted
}

/**
 * Retry failed outbox items
 */
export async function retryFailedOutboxItems(): Promise<void> {
  console.log('🔄 Retrying failed outbox items...')
  
  const failedItems = await db.outbox
    .where('status')
    .equals('error')
    .toArray()
  
  if (failedItems.length === 0) {
    console.log('✅ No failed items to retry')
    return
  }
  
  // Reset failed items to pending for retry
  for (const item of failedItems) {
    if (item.id) {
      await db.outbox.update(item.id, {
        status: 'pending',
        lastError: undefined
      })
    }
  }
  
  console.log(`🔄 Reset ${failedItems.length} failed items for retry`)
  
  // Process them
  await processOutbox()
}
