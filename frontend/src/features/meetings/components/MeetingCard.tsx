import React from 'react'
import EnhancedStatusDisplay from './EnhancedStatusDisplay'

interface MeetingCardProps {
  meeting: any
  onOpen: (meetingId: string) => void
  onSync: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  sending: boolean
}

export default function MeetingCard({ 
  meeting, 
  onOpen, 
  onSync, 
  onDelete, 
  sending 
}: MeetingCardProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return '#22c55e'
      case 'processing': return '#f59e0b'
      case 'queued': return '#f59e0b'  // Show queued as processing
      case 'uploaded': return '#3b82f6'
      case 'recording': return '#dc2626'
      case 'sent': return '#22c55e'
      case 'local': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return '✅'
      case 'processing': return '⏳'
      case 'queued': return '⏳'  // Show queued as processing
      case 'uploaded': return '☁️'
      case 'recording': return '🎙️'
      case 'sent': return '☁️'
      case 'local': return '💾'
      default: return '❓'
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
        e.currentTarget.style.borderColor = '#d1d5db'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
        e.currentTarget.style.borderColor = '#e5e7eb'
      }}
      onClick={() => onOpen(meeting.id)}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            margin: '0 0 8px 0',
            color: '#1f2937',
            lineHeight: '1.3'
          }}>
            {meeting.title || 'Untitled Meeting'}
          </h3>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <EnhancedStatusDisplay 
              meetingId={meeting.id}
              status={meeting.status}
              isProcessing={meeting.status === 'queued'}
            />
            <span>•</span>
            <span>📅 {formatDate(meeting.createdAt)}</span>
            {meeting.duration && (
              <>
                <span>•</span>
                <span>⏱️ {formatDuration(meeting.duration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '8px',
          marginLeft: '16px'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSync(meeting.id)
            }}
            disabled={sending || meeting.status === 'queued' || meeting.status === 'sent'}
            style={{
              padding: '6px 12px',
              backgroundColor: (sending || meeting.status === 'queued' || meeting.status === 'sent') ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: (sending || meeting.status === 'queued' || meeting.status === 'sent') ? 'not-allowed' : 'pointer',
              opacity: (sending || meeting.status === 'queued' || meeting.status === 'sent') ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!sending && meeting.status !== 'queued' && meeting.status !== 'sent') {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
            onMouseLeave={(e) => {
              if (!sending && meeting.status !== 'queued' && meeting.status !== 'sent') {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }
            }}
          >
            {(sending || meeting.status === 'queued') ? '⏳' : meeting.status === 'sent' ? '✅' : '🔄'} {meeting.status === 'sent' ? 'Sent' : (sending || meeting.status === 'queued') ? 'Processing' : 'Process'}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(meeting.id)
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444'
            }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Content Preview */}
      {(meeting.summary || meeting.transcript) && (
        <div style={{ 
          marginBottom: '12px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          {meeting.summary ? (
            <div>
              <div style={{ 
                fontSize: '10px', 
                color: '#6b7280', 
                textTransform: 'uppercase', 
                fontWeight: '600',
                marginBottom: '4px'
              }}>
                📋 Summary
              </div>
              <p style={{ 
                fontSize: '13px', 
                color: '#374151', 
                margin: 0,
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {meeting.summary}
              </p>
            </div>
          ) : meeting.transcript && (
            <div>
              <div style={{ 
                fontSize: '10px', 
                color: '#6b7280', 
                textTransform: 'uppercase', 
                fontWeight: '600',
                marginBottom: '4px'
              }}>
                📝 Transcript Preview
              </div>
              <p style={{ 
                fontSize: '13px', 
                color: '#374151', 
                margin: 0,
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {meeting.transcript}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {meeting.tags && meeting.tags.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px',
          marginTop: '12px'
        }}>
          {meeting.tags.slice(0, 3).map((tag: string, index: number) => (
            <span
              key={index}
              style={{
                padding: '2px 8px',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              {tag}
            </span>
          ))}
          {meeting.tags.length > 3 && (
            <span style={{
              padding: '2px 8px',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              borderRadius: '12px',
              fontSize: '11px'
            }}>
              +{meeting.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Click indicator */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '12px',
        fontSize: '11px',
        color: '#9ca3af'
      }}>
        Click to view details →
      </div>
    </div>
  )
}
