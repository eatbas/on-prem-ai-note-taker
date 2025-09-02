import { db } from '../db'
import { getMeetings } from '../api'

type VpsMeeting = {
  id: string
  title: string
  created_at: string
  updated_at: string
  transcription?: string | null
  summary?: string | null
  duration?: number | null
  language?: string | null
  tags?: string[] | null
  workspace_id?: number | null
  is_personal: boolean
}

function toTs(iso?: string | null): number {
  if (!iso) return Date.now()
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : Date.now()
}

/**
 * Upsert VPS meetings into local database for offline access
 */
export async function upsertVpsMeetings(rawMeetings: any[]): Promise<number> {
  console.log('🔄 Upserting VPS meetings to local cache:', rawMeetings.length)
  
  const meetings = (Array.isArray(rawMeetings) ? rawMeetings : []) as VpsMeeting[]

  const localMeetings = meetings.map(m => ({
    id: m.id,
    title: m.title ?? 'Untitled',
    createdAt: toTs(m.created_at),
    updatedAt: toTs(m.updated_at),
    tags: Array.isArray(m.tags) ? m.tags : [],
    status: 'synced' as const,
    language: (m.language as any) ?? 'auto',
    duration: typeof m.duration === 'number' ? m.duration : undefined,
    workspace_id: m.workspace_id ?? undefined,
    is_personal: !!m.is_personal,
    vps_id: m.id,
    last_sync_attempt: Date.now()
  }))

  const notes = meetings
    .filter(m => m.summary || m.transcription)
    .map(m => ({
      meetingId: m.id,
      transcript: m.transcription || '',
      summary: m.summary || undefined,
      createdAt: Date.now()
    }))

  // Bulk upsert for performance
  if (localMeetings.length > 0) {
    await db.meetings.bulkPut(localMeetings)
    console.log('✅ Upserted meetings to local DB:', localMeetings.length)
  }
  
  if (notes.length > 0) {
    await db.notes.bulkPut(notes)
    console.log('✅ Upserted notes to local DB:', notes.length)
  }

  // Update cache metadata
  await db.cache_metadata.put({
    key: 'meetings_list',
    lastSync: Date.now(),
    version: 1
  })

  return localMeetings.length
}

/**
 * Retry fetching and caching meetings with exponential backoff
 */
export async function retryFetchAndCacheMeetings(params?: {
  attempts?: number
  baseDelayMs?: number
  onAttempt?: (attempt: number, error?: unknown) => void
  signal?: AbortSignal
}): Promise<number> {
  const attempts = params?.attempts ?? 5
  const baseDelayMs = params?.baseDelayMs ?? 2000

  console.log('🔄 Starting retry fetch with', attempts, 'attempts')

  for (let i = 1; i <= attempts; i++) {
    if (params?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    
    try {
      console.log(`📡 Attempt ${i}/${attempts} to fetch VPS meetings`)
      const vpsMeetings = await getMeetings()
      const count = await upsertVpsMeetings(vpsMeetings)
      console.log('✅ Successfully cached VPS meetings on attempt', i)
      return count
    } catch (e) {
      console.warn(`❌ Attempt ${i}/${attempts} failed:`, e)
      params?.onAttempt?.(i, e)
      
      if (i === attempts) {
        console.error('🚫 All retry attempts exhausted')
        throw e
      }
      
      const delay = baseDelayMs * Math.pow(2, i - 1)
      console.log(`⏳ Waiting ${delay}ms before retry...`)
      
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay)
        params?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }
  }
  
  return 0
}

/**
 * Check if cache is stale and needs refresh
 */
export async function isCacheStale(maxAgeMs: number = 5 * 60 * 1000): Promise<boolean> {
  const metadata = await db.cache_metadata.get('meetings_list')
  if (!metadata) return true
  
  const age = Date.now() - metadata.lastSync
  return age > maxAgeMs
}
