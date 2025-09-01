import React, { useState, memo } from 'react'
import SpeakerPreview, { hasSpeakerData } from '../speakers/SpeakerPreview'
import EnhancedStatusDisplay from '../status/EnhancedStatusDisplay'
import { MeetingLoadingCard } from './LoadingStates'

interface MeetingCardEnhancedProps {
  meeting: any
  onOpen: (meetingId: string) => void
  onSync: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  onContextMenu?: (e: React.MouseEvent, meetingId: string, meetingTitle: string) => void
  sending: boolean
  isOpeningMeeting?: boolean
  showWorkspaceBadge?: boolean
}

const MeetingCardEnhanced = memo(function MeetingCardEnhanced({ 
  meeting, 
  onOpen, 
  onSync, 
  onDelete,
  onContextMenu,
  sending,
  isOpeningMeeting = false,
  showWorkspaceBadge = true
}: MeetingCardEnhancedProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [clickProgress, setClickProgress] = useState(0)

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

  const handleMeetingClick = async () => {
    if (isOpeningMeeting) return

    // Show immediate feedback
    setClickProgress(20)
    
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setClickProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      await onOpen(meeting.id)
      setClickProgress(100)
    } catch (error) {
      setClickProgress(0)
      clearInterval(progressInterval)
    } finally {
      setTimeout(() => setClickProgress(0), 500)
    }
  }

  const handleContextMenuClick = (e: React.MouseEvent) => {
    if (onContextMenu) {
      onContextMenu(e, meeting.id, meeting.title)
    }
  }

  // Show loading state when opening meeting
  if (isOpeningMeeting) {
    return <MeetingLoadingCard message={`Opening "${meeting.title}"...`} />
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
        boxShadow: isHovered ? '0 8px 25px rgba(0, 0, 0, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        borderColor: isHovered ? '#d1d5db' : '#e5e7eb',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleMeetingClick}
      onContextMenu={handleContextMenuClick}
    >
      {/* Progress Bar for Click */}
      {clickProgress > 0 && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${clickProgress}%`,
          height: '3px',
          backgroundColor: '#3b82f6',
          transition: 'width 0.2s ease',
          zIndex: 1
        }} />
      )}

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

          {/* Workspace Badge */}
          {showWorkspaceBadge && (
            <div style={{ marginBottom: '8px' }}>
              {meeting.is_personal === false && meeting.workspace_id ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  backgroundColor: '#f0f9ff',
                  color: '#0369a1',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  border: '1px solid #0ea5e9'
                }}>
                  🏢 Workspace Meeting
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  border: '1px solid #e2e8f0'
                }}>
                  👤 Personal Meeting
                </span>
              )}
            </div>
          )}
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <EnhancedStatusDisplay 
              status={meeting.status}
              compact={true}
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

          {/* Search Context Display */}
          {meeting._searchContext && (
            <div style={{
              fontSize: '12px',
              color: '#059669',
              backgroundColor: '#d1fae5',
              padding: '4px 8px',
              borderRadius: '12px',
              marginTop: '8px',
              display: 'inline-block',
              fontWeight: '500'
            }}>
              🔍 {meeting._searchContext}
            </div>
          )}
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
            disabled={sending || ['queued', 'uploading', 'processing', 'synced'].includes(meeting.status)}
            style={{
              padding: '6px 12px',
              backgroundColor: (sending || ['queued', 'uploading', 'processing', 'synced'].includes(meeting.status)) 
                ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: (sending || ['queued', 'uploading', 'processing', 'synced'].includes(meeting.status)) 
                ? 'not-allowed' : 'pointer',
              opacity: (sending || ['queued', 'uploading', 'processing', 'synced'].includes(meeting.status)) 
                ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {meeting.status === 'synced' ? '✅ Synced' :
             meeting.status === 'processing' ? '🤖 Processing' :
             meeting.status === 'uploading' ? '📤 Uploading' :
             meeting.status === 'queued' ? '⏳ Queued' :
             sending ? '⏳ Processing' : '📤 Sync'}
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
                📋 {hasSpeakerData(meeting.summary) ? 'Enhanced Summary with Speaker Intelligence' : 'Summary'}
              </div>
              {hasSpeakerData(meeting.summary) ? (
                <SpeakerPreview 
                  summary={meeting.summary} 
                  compact={true}
                />
              ) : (
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
              )}
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
        color: isHovered ? '#3b82f6' : '#9ca3af',
        fontWeight: isHovered ? '500' : '400',
        transition: 'all 0.2s ease'
      }}>
        {clickProgress > 0 ? `Loading ${clickProgress}%...` : 'Click to view details →'}
      </div>
    </div>
  )
})

export default MeetingCardEnhanced
