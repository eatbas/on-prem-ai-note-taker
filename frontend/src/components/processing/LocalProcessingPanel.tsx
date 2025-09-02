/**
 * Local Processing Panel
 * 
 * Shows local Tauri Whisper capabilities and allows users to process meetings locally
 */

import React, { useState, useEffect, useCallback } from 'react'
import { 
  getLocalProcessingStatus,
  getProcessableMeetings,
  processLocalMeeting,
  autoProcessAllLocal
} from '../../services/offline/localProcessing'

interface LocalProcessingPanelProps {
  onMeetingProcessed?: (meetingId: string) => void
}

interface ProcessingStatus {
  available: boolean
  capabilities?: any
  models?: any[]
  languages?: Array<[string, string]>
  error?: string
}

interface ProcessingProgress {
  phase: string
  progress: number
  message: string
}

export default function LocalProcessingPanel({ onMeetingProcessed }: LocalProcessingPanelProps) {
  const [status, setStatus] = useState<ProcessingStatus>({ available: false })
  const [processableMeetings, setProcessableMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [currentProgress, setCurrentProgress] = useState<ProcessingProgress | null>(null)
  const [autoProcessing, setAutoProcessing] = useState(false)

  // Load status and meetings
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [statusResult, meetings] = await Promise.all([
        getLocalProcessingStatus(),
        getProcessableMeetings()
      ])
      
      setStatus(statusResult)
      setProcessableMeetings(meetings)
    } catch (error) {
      console.error('Failed to load local processing data:', error)
      setStatus({ available: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Process single meeting
  const handleProcessMeeting = async (meetingId: string, title?: string) => {
    try {
      setProcessing(true)
      setCurrentProgress({ phase: 'STARTING', progress: 0, message: 'Starting local processing...' })
      
      await processLocalMeeting(meetingId, title, (progress) => {
        setCurrentProgress(progress)
      })
      
      // Refresh data after processing
      await loadData()
      onMeetingProcessed?.(meetingId)
      
      setCurrentProgress({ phase: 'COMPLETED', progress: 100, message: 'Processing completed!' })
      
      // Clear progress after 2 seconds
      setTimeout(() => {
        setCurrentProgress(null)
      }, 2000)
      
    } catch (error) {
      console.error('Processing failed:', error)
      setCurrentProgress({ phase: 'ERROR', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` })
      
      setTimeout(() => {
        setCurrentProgress(null)
      }, 5000)
    } finally {
      setProcessing(false)
    }
  }

  // Auto-process all meetings
  const handleAutoProcessAll = async () => {
    try {
      setAutoProcessing(true)
      setCurrentProgress({ phase: 'STARTING', progress: 0, message: 'Starting batch processing...' })
      
      const result = await autoProcessAllLocal((progress) => {
        setCurrentProgress({
          phase: progress.phase,
          progress: (progress.completed / progress.total) * 100,
          message: progress.current ? `Processing: ${progress.current}` : progress.phase
        })
      })
      
      // Refresh data after processing
      await loadData()
      
      setCurrentProgress({ 
        phase: 'COMPLETED', 
        progress: 100, 
        message: `Batch complete: ${result.processed} processed, ${result.failed} failed` 
      })
      
      setTimeout(() => {
        setCurrentProgress(null)
      }, 3000)
      
    } catch (error) {
      console.error('Batch processing failed:', error)
      setCurrentProgress({ phase: 'ERROR', progress: 0, message: `Batch error: ${error instanceof Error ? error.message : String(error)}` })
      
      setTimeout(() => {
        setCurrentProgress(null)
      }, 5000)
    } finally {
      setAutoProcessing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6b7280' }}>
          🔍 Checking local AI capabilities...
        </div>
      </div>
    )
  }

  if (!status.available) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fef2f2', 
        border: '1px solid #fecaca',
        borderRadius: '8px',
        margin: '20px'
      }}>
        <h3 style={{ color: '#dc2626', margin: '0 0 12px 0' }}>
          ❌ Local Processing Unavailable
        </h3>
        <p style={{ color: '#7f1d1d', margin: '0 0 12px 0' }}>
          {status.error || 'Local Tauri Whisper service is not available'}
        </p>
        <button 
          onClick={loadData}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🔄 Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Status Header */}
      <div style={{ 
        backgroundColor: '#f0fdf4', 
        border: '1px solid #bbf7d0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#166534', margin: '0 0 12px 0', display: 'flex', alignItems: 'center' }}>
          ✅ Local AI Processing Available
        </h3>
        
        {status.capabilities && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#065f46', fontWeight: '600' }}>Best Model</div>
              <div style={{ fontSize: '14px', color: '#166534' }}>
                {status.capabilities.best_model || 'Unknown'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#065f46', fontWeight: '600' }}>Device</div>
              <div style={{ fontSize: '14px', color: '#166534' }}>
                {status.capabilities.device?.type || 'CPU'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#065f46', fontWeight: '600' }}>Languages</div>
              <div style={{ fontSize: '14px', color: '#166534' }}>
                {status.languages?.length || 0} supported
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Display */}
      {currentProgress && (
        <div style={{ 
          backgroundColor: '#fffbeb', 
          border: '1px solid #fed7aa',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
              {currentProgress.phase}
            </span>
            <span style={{ fontSize: '14px', color: '#92400e' }}>
              {currentProgress.progress.toFixed(0)}%
            </span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            backgroundColor: '#fed7aa', 
            borderRadius: '4px',
            marginBottom: '8px'
          }}>
            <div style={{ 
              width: `${currentProgress.progress}%`, 
              height: '100%', 
              backgroundColor: '#f59e0b', 
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#78350f' }}>
            {currentProgress.message}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleAutoProcessAll}
          disabled={autoProcessing || processing || processableMeetings.length === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: processableMeetings.length === 0 ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: processableMeetings.length === 0 ? 'not-allowed' : 'pointer',
            marginRight: '12px',
            opacity: autoProcessing || processing ? 0.6 : 1
          }}
        >
          {autoProcessing ? '⚡ Processing All...' : `🚀 Process All Local Meetings (${processableMeetings.length})`}
        </button>
        
        <button 
          onClick={loadData}
          disabled={processing || autoProcessing}
          style={{
            padding: '12px 24px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            opacity: processing || autoProcessing ? 0.6 : 1
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Meetings List */}
      {processableMeetings.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ fontSize: '18px', color: '#374151', margin: '0 0 8px 0' }}>
            All Meetings Processed!
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            No meetings require local processing. Start a new recording to see it here.
          </p>
        </div>
      ) : (
        <div>
          <h4 style={{ fontSize: '16px', color: '#374151', margin: '0 0 16px 0' }}>
            📋 Meetings Ready for Local Processing ({processableMeetings.length})
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {processableMeetings.map((meeting) => (
              <div key={meeting.id} style={{ 
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    {meeting.title || 'Untitled Meeting'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Created: {new Date(meeting.createdAt).toLocaleString()} • 
                    Status: {meeting.status} • 
                    Language: {meeting.language || 'auto'}
                  </div>
                </div>
                
                <button 
                  onClick={() => handleProcessMeeting(meeting.id, meeting.title)}
                  disabled={processing || autoProcessing}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: processing || autoProcessing ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: processing || autoProcessing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {processing ? '⚡ Processing...' : '🚀 Process'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
