/**
 * 🚨 PHASE 3.2: Async Meeting Sync Service
 * 
 * This service provides non-blocking meeting sync to prevent VPS freezing.
 * Instead of waiting for completion, it immediately returns a job ID and
 * provides progress tracking capabilities.
 */

import { apiRequest } from './core'

export interface AsyncSyncResponse {
  job_id: string
  meeting_id: string
  status: string
  message: string
  progress_url: string
  estimated_duration_minutes: number
}

export interface JobStatus {
  id: string
  phase: string
  progress: number
  eta_seconds?: number
  message: string
  current: number
  total: number
  started_at?: string
  updated_at: string
  is_complete: boolean
  is_running: boolean
}

export interface JobProgress {
  jobId: string
  phase: string
  progress: number
  message: string
  isComplete: boolean
  isRunning: boolean
  error?: string
}

/**
 * Start async processing for a meeting
 */
export async function startAsyncMeetingSync(
  meetingId: string,
  audioFile: File,
  language: string = 'auto'
): Promise<AsyncSyncResponse> {
  const formData = new FormData()
  formData.append('audio_file', audioFile)
  formData.append('language', language)

  console.log(`🚀 Starting async sync for meeting ${meetingId}`)
  
  try {
    return await apiRequest<AsyncSyncResponse>(`/meetings/${meetingId}/process-async`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header for FormData - browser will set it with boundary
    })
  } catch (error: any) {
    // 🚨 PHASE 3.3: Handle rate limiting errors gracefully
    if (error.status === 429) {
      const rateLimitInfo = error.detail || error.response?.data?.detail
      if (rateLimitInfo) {
        throw new RateLimitError(rateLimitInfo)
      }
    }
    throw error
  }
}

/**
 * 🚨 PHASE 3.3: Rate limiting error class for better error handling
 */
export class RateLimitError extends Error {
  public retryAfter: number
  public rateLimitInfo: any
  public queueInfo: any
  
  constructor(errorDetail: any) {
    const message = errorDetail.message || 'Rate limit exceeded'
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = errorDetail.retry_after || 60
    this.rateLimitInfo = errorDetail.rate_limit_info || {}
    this.queueInfo = errorDetail.queue_info || {}
  }
}

/**
 * Get current job status
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return apiRequest<JobStatus>(`/jobs/${jobId}/status`)
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<{ cancelled: boolean; message: string }> {
  return apiRequest<{ cancelled: boolean; message: string }>(`/jobs/${jobId}/cancel`, {
    method: 'POST'
  })
}

/**
 * Poll job status until completion
 */
export async function pollJobStatus(
  jobId: string,
  onProgress?: (progress: JobProgress) => void,
  intervalMs: number = 2000
): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 300 // 10 minutes maximum (300 * 2s)
    
    const poll = async () => {
      try {
        attempts++
        
        if (attempts > maxAttempts) {
          reject(new Error('Job polling timeout - exceeded maximum wait time'))
          return
        }
        
        const status = await getJobStatus(jobId)
        
        // Update progress callback
        if (onProgress) {
          onProgress({
            jobId,
            phase: status.phase,
            progress: status.progress,
            message: status.message,
            isComplete: status.is_complete,
            isRunning: status.is_running
          })
        }
        
        // Check if job is complete
        if (status.is_complete) {
          if (status.phase === 'ERROR') {
            reject(new Error(`Job failed: ${status.message}`))
          } else {
            resolve(status)
          }
          return
        }
        
        // Continue polling if job is still running
        if (status.is_running) {
          setTimeout(poll, intervalMs)
        } else {
          reject(new Error(`Job stopped unexpectedly: ${status.message}`))
        }
        
      } catch (error) {
        console.error(`❌ Error polling job ${jobId}:`, error)
        
        // Retry on network errors, but fail on other errors
        if (attempts < 3) {
          setTimeout(poll, intervalMs)
        } else {
          reject(error)
        }
      }
    }
    
    // Start polling immediately
    poll()
  })
}

/**
 * Create an EventSource for real-time job progress updates (if supported)
 */
export function createJobProgressStream(
  jobId: string,
  onProgress: (progress: JobProgress) => void,
  onComplete: (status: JobStatus) => void,
  onError: (error: Error) => void
): EventSource | null {
  try {
    // Note: This would require the backend to support Server-Sent Events
    const eventSource = new EventSource(`/api/jobs/${jobId}/events`)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.error) {
          onError(new Error(data.error))
          return
        }
        
        const progress: JobProgress = {
          jobId,
          phase: data.phase,
          progress: data.progress,
          message: data.message,
          isComplete: data.is_complete,
          isRunning: data.is_running
        }
        
        if (data.is_complete) {
          onComplete(data)
          eventSource.close()
        } else {
          onProgress(progress)
        }
        
      } catch (parseError) {
        console.error('Failed to parse progress data:', parseError)
      }
    }
    
    eventSource.onerror = (event) => {
      console.error('EventSource error:', event)
      onError(new Error('Real-time progress stream failed'))
      eventSource.close()
    }
    
    return eventSource
    
  } catch (error) {
    console.error('Failed to create EventSource:', error)
    return null
  }
}

/**
 * Unified async sync function with progress tracking
 */
export async function syncMeetingAsync(
  meetingId: string,
  audioFile: File,
  language: string = 'auto',
  onProgress?: (progress: JobProgress) => void
): Promise<void> {
  try {
    console.log(`🚀 Starting async sync for meeting ${meetingId}`)
    
    // Start async processing
    const syncResponse = await startAsyncMeetingSync(meetingId, audioFile, language)
    
    console.log(`✅ Async sync started: Job ${syncResponse.job_id}`)
    console.log(`⏱️ Estimated duration: ${syncResponse.estimated_duration_minutes} minutes`)
    
    // Poll for completion
    await pollJobStatus(syncResponse.job_id, onProgress)
    
    console.log(`✅ Async sync completed for meeting ${meetingId}`)
    
  } catch (error) {
    console.error(`❌ Async sync failed for meeting ${meetingId}:`, error)
    throw error
  }
}

/**
 * Check VPS memory status before starting sync
 */
export async function checkVpsMemoryStatus(): Promise<{
  canProcess: boolean
  memoryUsage: number
  recommendation: string
}> {
  try {
    const memoryStats = await apiRequest<any>('/jobs/memory/stats')
    
    const processMemoryMb = memoryStats.memory?.process?.rss_mb || 0
    const isOverThreshold = memoryStats.memory?.thresholds?.is_warning || false
    
    return {
      canProcess: !isOverThreshold,
      memoryUsage: processMemoryMb,
      recommendation: isOverThreshold 
        ? 'VPS memory usage is high. Consider waiting or uploading a smaller file.'
        : 'Memory usage is normal. Safe to process.'
    }
  } catch (error) {
    console.warn('Failed to check VPS memory status:', error)
    // Assume it's safe if we can't check
    return {
      canProcess: true,
      memoryUsage: 0,
      recommendation: 'Memory status unknown, proceeding with caution.'
    }
  }
}

/**
 * 🚨 PHASE 3.3: Get current queue status and position
 */
export async function getQueueStatus(): Promise<{
  global_queue_position: number
  user_queue_position: number
  estimated_wait_minutes: number
  queue_status: string
  recommended_action: string
}> {
  try {
    const response = await apiRequest<any>('/meetings/queue/status')
    return response.queue_info
  } catch (error) {
    console.warn('Failed to get queue status:', error)
    return {
      global_queue_position: 0,
      user_queue_position: 0,
      estimated_wait_minutes: 0,
      queue_status: 'unknown',
      recommended_action: 'proceed'
    }
  }
}

/**
 * 🚨 PHASE 3.3: Get intelligent retry recommendation
 */
export async function getRetryRecommendation(lastError?: string): Promise<{
  retry_count: number
  recommended_wait_seconds: number
  recommended_wait_minutes: number
  next_retry_at: string
  message: string
}> {
  try {
    const params = lastError ? `?last_error=${encodeURIComponent(lastError)}` : ''
    const response = await apiRequest<any>(`/meetings/queue/retry-recommendation${params}`)
    return response.retry_info
  } catch (error) {
    console.warn('Failed to get retry recommendation:', error)
    return {
      retry_count: 0,
      recommended_wait_seconds: 30,
      recommended_wait_minutes: 1,
      next_retry_at: new Date(Date.now() + 30000).toISOString(),
      message: 'Please wait a moment before retrying.'
    }
  }
}

/**
 * 🚨 PHASE 3.3: Enhanced sync function with rate limiting support
 */
export async function syncMeetingWithRetry(
  meetingId: string,
  audioFile: File,
  language: string = 'auto',
  onProgress?: (progress: JobProgress) => void,
  onRateLimit?: (rateLimitInfo: any) => void
): Promise<void> {
  try {
    console.log(`🚀 Starting sync with rate limiting for meeting ${meetingId}`)
    
    // Check queue status first
    const queueStatus = await getQueueStatus()
    console.log(`📋 Queue status:`, queueStatus)
    
    if (queueStatus.global_queue_position > 5) {
      const retryInfo = await getRetryRecommendation()
      throw new RateLimitError({
        message: `Queue is busy (position ${queueStatus.global_queue_position}). ${retryInfo.message}`,
        retry_after: retryInfo.recommended_wait_seconds,
        queue_info: queueStatus,
        rate_limit_info: retryInfo
      })
    }
    
    // Proceed with async sync
    await syncMeetingAsync(meetingId, audioFile, language, onProgress)
    
    console.log(`✅ Sync completed successfully for meeting ${meetingId}`)
    
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.warn(`🚫 Rate limited for meeting ${meetingId}:`, error.message)
      
      if (onRateLimit) {
        onRateLimit({
          error: error.message,
          retryAfter: error.retryAfter,
          queueInfo: error.queueInfo,
          rateLimitInfo: error.rateLimitInfo
        })
      }
    }
    
    throw error
  }
}
