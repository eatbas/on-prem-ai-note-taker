import { db } from '../db'
import { getMeeting } from '../api'

type MeetingDetail = {
  id: string
  transcription?: string | null
  summary?: string | null
  title?: string
  updated_at?: string
  language?: string | null
}

function toTs(iso?: string | null): number {
  if (!iso) return Date.now()
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : Date.now()
}

/**
 * Fill missing meeting details by fetching from VPS
 */
export async function fillMissingMeetingDetails(options?: {
  limit?: number
  onProgress?: (done: number, total: number, id?: string) => void
  signal?: AbortSignal
}): Promise<number> {
  const limit = options?.limit ?? 4
  console.log('🔍 Starting to fill missing meeting details with concurrency:', limit)

  // Build candidate list: meetings without notes or with missing summary/transcript
  const [meetings, notes] = await Promise.all([
    db.meetings.toArray(),
    db.notes.toArray()
  ])
  
  const noteById = new Map(notes.map(n => [n.meetingId, n]))

  const candidates = meetings
    .filter(m => {
      const n = noteById.get(m.id)
      // Include if no note exists, or if note exists but missing summary or transcript
      return !n || !n.summary || !n.transcript
    })
    .map(m => m.id)

  console.log('📋 Found candidates for detail fetching:', candidates.length)

  if (candidates.length === 0) {
    console.log('✅ No missing details to fetch')
    return 0
  }

  let done = 0
  const queue = [...candidates]
  const workers: Promise<void>[] = []

  const worker = async () => {
    while (queue.length > 0) {
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      
      const id = queue.shift()!
      console.log(`📡 Fetching details for meeting: ${id}`)
      
      try {
        const detail = (await getMeeting(id)) as MeetingDetail
        const hasAnyContent = !!(detail.summary || detail.transcription)
        
        if (hasAnyContent) {
          console.log(`💾 Storing details for meeting: ${id}`)
          
          // Update or create note
          await db.notes.put({
            meetingId: id,
            transcript: detail.transcription || '',
            summary: detail.summary || undefined,
            createdAt: Date.now()
          })
          
          // Update meeting metadata if available
          const updateData: any = { updatedAt: toTs(detail.updated_at) }
          if (detail.title) updateData.title = detail.title
          if (detail.language) updateData.language = detail.language
          
          await db.meetings.update(id, updateData)
          
          console.log(`✅ Successfully stored details for meeting: ${id}`)
        } else {
          console.log(`ℹ️ No content available for meeting: ${id}`)
        }
      } catch (error) {
        console.warn(`❌ Failed to fetch details for meeting ${id}:`, error)
        // Continue with other meetings - individual failures shouldn't stop the process
      } finally {
        done++
        options?.onProgress?.(done, candidates.length, id)
      }
    }
  }

  // Start concurrent workers
  const concurrency = Math.max(1, Math.min(limit, candidates.length))
  console.log(`🚀 Starting ${concurrency} workers for detail fetching`)
  
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker())
  }

  await Promise.all(workers)
  
  console.log(`✅ Completed detail fetching: ${done}/${candidates.length} processed`)
  return done
}

/**
 * Get meetings that need detail fetching
 */
export async function getMeetingsNeedingDetails(): Promise<string[]> {
  const [meetings, notes] = await Promise.all([
    db.meetings.toArray(),
    db.notes.toArray()
  ])
  
  const noteById = new Map(notes.map(n => [n.meetingId, n]))
  
  return meetings
    .filter(m => {
      const n = noteById.get(m.id)
      return !n || !n.summary || !n.transcript
    })
    .map(m => m.id)
}
