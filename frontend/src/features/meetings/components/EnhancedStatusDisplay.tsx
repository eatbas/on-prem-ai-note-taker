import React, { useState, useEffect, useRef } from 'react'
import { jobQueueManager, JobHistoryItem } from '../../../stores/jobQueueManager'

interface EnhancedStatusDisplayProps {
  meetingId: string
  status: string
  isProcessing?: boolean
}

export default function EnhancedStatusDisplay({ 
  meetingId, 
  status, 
  isProcessing = false 
}: EnhancedStatusDisplayProps) {
  const [jobInfo, setJobInfo] = useState<JobHistoryItem | null>(null)
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Subscribe to job queue updates
  useEffect(() => {
    const unsubscribe = jobQueueManager.subscribe((jobs) => {
      // Find job for this meeting
      const meetingJob = jobs.find(job => job.id.includes(meetingId))
      setJobInfo(meetingJob || null)
    })
    return unsubscribe
  }, [meetingId])

  // Handle click outside to close expanded view
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpanded(false)
      }
    }

    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expanded])

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'recording':
        return {
          icon: '🔴',
          label: 'Recording',
          color: '#dc2626',
          bgColor: '#fee2e2'
        }
      case 'queued':
        return {
          icon: '⏳',
          label: 'Processing',
          color: '#92400e',
          bgColor: '#fef3c7'
        }
      case 'sent':
        return {
          icon: '✅',
          label: 'Synced',
          color: '#166534',
          bgColor: '#dcfce7'
        }
      case 'local':
      default:
        return {
          icon: '📝',
          label: 'Local',
          color: '#dc2626',
          bgColor: '#fee2e2'
        }
    }
  }

  const getProgressStages = () => {
    if (status === 'queued' && jobInfo) {
      const progress = jobInfo.progress
      return [
        { 
          stage: 'Uploading to VPS', 
          progress: progress <= 30 ? progress : 30, 
          icon: '☁️',
          active: progress > 0,
          completed: progress >= 30
        },
        { 
          stage: 'AI Analysis Started', 
          progress: progress <= 30 ? 0 : progress <= 80 ? progress - 30 : 50, 
          icon: '🤖',
          active: progress > 30,
          completed: progress >= 80
        },
        { 
          stage: 'Analysis Complete', 
          progress: progress <= 80 ? 0 : progress - 80, 
          icon: '✅',
          active: progress > 80,
          completed: progress >= 100
        }
      ]
    }
    return []
  }

  const statusConfig = getStatusConfig(status)
  const progressStages = getProgressStages()

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Main Status Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: statusConfig.bgColor,
          color: statusConfig.color,
          cursor: status === 'queued' ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          border: status === 'queued' ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
          boxShadow: status === 'queued' ? '0 0 8px rgba(59, 130, 246, 0.2)' : 'none'
        }}
        onClick={() => status === 'queued' && setExpanded(!expanded)}
        title={status === 'queued' ? 'Click to view detailed progress' : statusConfig.label}
      >
        <span>{statusConfig.icon}</span>
        <span>{statusConfig.label}</span>
        {status === 'queued' && jobInfo && (
          <span style={{ fontSize: '10px', opacity: 0.7 }}>
            {Math.round(jobInfo.progress)}%
          </span>
        )}
        {status === 'queued' && (
          <span style={{ fontSize: '10px', opacity: 0.7 }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {/* Progress indicator for processing status */}
        {status === 'queued' && jobInfo && jobInfo.progress > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '2px',
            backgroundColor: '#3b82f6',
            width: `${jobInfo.progress}%`,
            transition: 'width 0.3s ease'
          }} />
        )}
        {/* Processing animation indicator */}
        {status === 'queued' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            right: '8px',
            transform: 'translateY(-50%)',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: jobInfo ? '#3b82f6' : '#9ca3af',
            animation: jobInfo ? 'pulse 2s infinite' : 'none'
          }} />
        )}
      </div>

      {/* Expanded Progress Details */}
      {expanded && status === 'queued' && jobInfo && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            right: '0',
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '280px'
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setExpanded(false)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            ✕
          </button>
          {/* Overall Progress */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                Overall Progress
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                {Math.round(jobInfo.progress)}%
              </span>
            </div>
            {/* Job started time */}
            <div style={{ 
              fontSize: '10px', 
              color: '#9ca3af', 
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              Started: {jobInfo.createdAt.toLocaleTimeString()}
            </div>
            {/* Current stage summary */}
            <div style={{ 
              fontSize: '11px', 
              color: '#374151', 
              marginBottom: '12px',
              textAlign: 'center',
              padding: '6px 8px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              🎯 {jobInfo.message || 'Processing...'}
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e5e7eb',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${jobInfo.progress}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease',
                borderRadius: '3px'
              }} />
            </div>
          </div>

          {/* Progress Stages */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Processing Stages
            </div>
                         {progressStages.map((stage, index) => (
               <div key={index} style={{ marginBottom: '8px' }}>
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: '4px'
                 }}>
                   <span style={{ 
                     fontSize: '11px', 
                     color: stage.completed ? '#10b981' : stage.active ? '#3b82f6' : '#6b7280', 
                     display: 'flex', 
                     alignItems: 'center', 
                     gap: '4px',
                     fontWeight: stage.active || stage.completed ? '600' : '400'
                   }}>
                     {stage.completed ? '✅' : stage.active ? '🔄' : stage.icon} {stage.stage}
                   </span>
                   <span style={{ 
                     fontSize: '11px', 
                     fontWeight: '500', 
                     color: stage.completed ? '#10b981' : stage.active ? '#3b82f6' : '#374151' 
                   }}>
                     {Math.round(stage.progress)}%
                   </span>
                 </div>
                 <div style={{
                   width: '100%',
                   height: '4px',
                   backgroundColor: '#f3f4f6',
                   borderRadius: '2px',
                   overflow: 'hidden'
                 }}>
                   <div style={{
                     width: `${Math.max(0, stage.progress)}%`,
                     height: '100%',
                     backgroundColor: stage.completed ? '#10b981' : stage.active ? '#3b82f6' : '#d1d5db',
                     transition: 'width 0.3s ease',
                     borderRadius: '2px'
                   }} />
                 </div>
               </div>
             ))}
          </div>

          {/* Current Status Message */}
          {jobInfo.message && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280', 
              fontStyle: 'italic',
              padding: '8px',
              backgroundColor: '#f9fafb',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              💬 {jobInfo.message}
            </div>
          )}

          {/* ETA if available */}
          {jobInfo.eta && jobInfo.eta > 0 && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280',
              marginTop: '8px',
              textAlign: 'center'
            }}>
              ⏱️ Estimated time remaining: {Math.round(jobInfo.eta / 60)} min
            </div>
          )}
        </div>
      )}
    </div>
  )
}
