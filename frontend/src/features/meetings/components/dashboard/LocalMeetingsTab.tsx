import React, { useMemo, useState, useCallback } from 'react'
import MeetingCardEnhanced from './MeetingCardEnhanced'
import { DashboardLoadingState } from './LoadingStates'
import { SpeakerSearchEngine } from '../../utils/speakerSearch'

interface LocalMeetingsTabProps {
  meetings: any[]
  loading: boolean
  error: string | null
  text: string
  tag: string
  onOpen: (meetingId: string) => void
  onSync: (meetingId: string) => void
  onContextMenu: (e: React.MouseEvent, meetingId: string, meetingTitle: string) => void
  sendingMeetings: Set<string>
  isRecording?: boolean
  recordingMeetingId?: string | null
  currentPage: number
  setCurrentPage: (page: number) => void
  meetingsPerPage: number
}

const LocalMeetingsTab: React.FC<LocalMeetingsTabProps> = ({
  meetings,
  loading,
  error,
  text,
  tag,
  onOpen,
  onSync,
  onContextMenu,
  sendingMeetings,
  isRecording = false,
  recordingMeetingId = null,
  currentPage,
  setCurrentPage,
  meetingsPerPage
}) => {
  const [openingMeetingId, setOpeningMeetingId] = useState<string | null>(null)

  // Process meetings with search and recording status
  const processedMeetings = useMemo(() => {
    // First, mark recording status
    let processed = meetings.map(m => {
      // Mark the currently recording meeting
      if (isRecording && recordingMeetingId === m.id) {
        return { ...m, status: 'recording', title: m.title || 'Meeting in Progress...' }
      }
      return m
    })

    // Apply speaker-aware enhanced search if search term exists
    if (text && text.trim()) {
      processed = SpeakerSearchEngine.filterAndSortMeetings(processed, text.trim())
    }

    // Sort by priority: recording first, then by search relevance or date
    return processed.sort((a, b) => {
      // Recording meeting always goes first
      if (a.status === 'recording') return -1
      if (b.status === 'recording') return 1
      
      // If we have search scores, sort by relevance
      if (a._searchScore && b._searchScore) {
        return b._searchScore - a._searchScore
      }
      
      // Otherwise sort by creation date (newest first)
      return (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0)
    })
  }, [meetings, isRecording, recordingMeetingId, text])

  // Filter by tag
  const filteredMeetings = useMemo(() => {
    if (!tag) return processedMeetings
    return processedMeetings.filter(meeting => 
      meeting.tags?.some((t: string) => 
        t.toLowerCase().includes(tag.toLowerCase())
      )
    )
  }, [processedMeetings, tag])

  // Pagination calculations
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredMeetings.length / meetingsPerPage)
    const startIndex = (currentPage - 1) * meetingsPerPage
    const endIndex = startIndex + meetingsPerPage
    const currentMeetings = filteredMeetings.slice(startIndex, endIndex)
    
    return {
      totalPages,
      startIndex,
      endIndex,
      currentMeetings
    }
  }, [filteredMeetings, currentPage, meetingsPerPage])

  const { totalPages, startIndex, endIndex, currentMeetings } = paginationData

  // Enhanced onOpen with loading state
  const handleMeetingOpen = useCallback(async (meetingId: string) => {
    setOpeningMeetingId(meetingId)
    try {
      await onOpen(meetingId)
    } finally {
      // Small delay to show loading state
      setTimeout(() => setOpeningMeetingId(null), 300)
    }
  }, [onOpen])

  // Auto-adjust page if current page is beyond available pages
  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage, setCurrentPage])

  // Loading state
  if (loading) {
    return <DashboardLoadingState meetingsCount={meetingsPerPage} />
  }

  // Error state
  if (error) {
    return (
      <div style={{ 
        padding: '32px 20px', 
        backgroundColor: '#fef2f2', 
        border: '2px solid #fecaca',
        borderRadius: '12px',
        textAlign: 'center',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#dc2626', 
          marginBottom: '8px' 
        }}>
          Failed to Load Meetings
        </h3>
        <p style={{ color: '#dc2626', marginBottom: '16px' }}>
          {error}
        </p>
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#7f1d1d'
        }}>
          💡 Try refreshing the page or check your connection
        </div>
      </div>
    )
  }

  // Empty state
  if (filteredMeetings.length === 0) {
    const hasFilters = text || tag
    
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '60px 20px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        border: '2px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>
          {hasFilters ? '🔍' : '📂'}
        </div>
        <h3 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          color: '#1f2937',
          marginBottom: '12px' 
        }}>
          {hasFilters ? 'No matching meetings found' : 'No meetings yet'}
        </h3>
        <p style={{ 
          fontSize: '16px', 
          color: '#6b7280',
          marginBottom: '20px',
          maxWidth: '400px',
          margin: '0 auto 20px'
        }}>
          {hasFilters 
            ? 'Try adjusting your search terms or tag filters to find what you\'re looking for.'
            : 'Start recording your first meeting to see it appear here. Your meetings will be automatically saved locally and synced to the cloud when available.'
          }
        </p>
        
        {hasFilters && (
          <div style={{ 
            backgroundColor: '#fef3c7', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid #fbbf24',
            maxWidth: '400px',
            margin: '0 auto',
            textAlign: 'left'
          }}>
            <div style={{ 
              fontSize: '14px', 
              color: '#92400e',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              💡 Search Tips:
            </div>
            <ul style={{ 
              fontSize: '13px', 
              color: '#92400e', 
              margin: 0,
              paddingLeft: '16px'
            }}>
              <li>Search works across titles, summaries, and transcripts</li>
              <li>Speaker names and conversations are also searchable</li>
              <li>Includes both local and cloud-synced meetings</li>
              <li>Use tags to organize and filter your meetings</li>
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Progress indicator for recording */}
      {isRecording && recordingMeetingId && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#dc2626'
            }}>
              🎙️ Recording in Progress
            </span>
          </div>
          <div style={{
            fontSize: '14px',
            color: '#7f1d1d'
          }}>
            Your meeting is being recorded and will appear below when finished
          </div>
        </div>
      )}

      {/* Meeting Cards */}
      <div style={{ 
        display: 'grid', 
        gap: '20px',
        marginBottom: '24px'
      }}>
        {currentMeetings.map((meeting) => (
          <MeetingCardEnhanced
            key={meeting.id}
            meeting={meeting}
            onOpen={handleMeetingOpen}
            onSync={onSync}
            onDelete={() => {}} // Will be handled by context menu
            onContextMenu={onContextMenu}
            sending={sendingMeetings.has(meeting.id)}
            isOpeningMeeting={openingMeetingId === meeting.id}
            showWorkspaceBadge={true}
          />
        ))}
      </div>

      {/* Pagination */}
      {filteredMeetings.length > meetingsPerPage && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '12px',
          marginTop: '32px',
          padding: '20px 0'
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === 1 ? '#f3f4f6' : '#3b82f6',
              color: currentPage === 1 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            ← Previous
          </button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <span>Page</span>
            <span style={{ 
              fontWeight: 'bold', 
              color: '#1f2937',
              padding: '4px 8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px'
            }}>
              {currentPage}
            </span>
            <span>of {totalPages}</span>
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#3b82f6',
              color: currentPage === totalPages ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Meeting Stats */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '12px', 
        color: '#6b7280',
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ marginBottom: '4px' }}>
          📊 Showing {currentMeetings.length} of {filteredMeetings.length} meetings
          {(text || tag) && ` (filtered from ${meetings.length} total)`}
        </div>
        {meetings.length > 0 && (
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            Total meetings: {meetings.length} (local + cloud-synced) • 
            This page: {startIndex + 1}-{Math.min(endIndex, filteredMeetings.length)}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default LocalMeetingsTab
