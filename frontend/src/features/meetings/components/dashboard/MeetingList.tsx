import React from 'react'
import MeetingCardEnhanced from './MeetingCardEnhanced'

interface MeetingListProps {
  meetings: any[]
  onOpen: (meetingId: string) => void
  sendingMeetings: Set<string>
  onSync: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  meetingsPerPage: number
  text: string
  tag: string
  loading: boolean
  error: string | null
}

export default function MeetingList({
  meetings,
  onOpen,
  sendingMeetings,
  onSync,
  onDelete,
  currentPage,
  setCurrentPage,
  meetingsPerPage,
  text,
  tag,
  loading,
  error
}: MeetingListProps) {
  // Apply filters
  const filteredMeetings = meetings.filter(meeting => {
    const matchesText = !text || 
      meeting.title?.toLowerCase().includes(text.toLowerCase()) ||
      meeting.transcript?.toLowerCase().includes(text.toLowerCase()) ||
      meeting.summary?.toLowerCase().includes(text.toLowerCase())

    const matchesTag = !tag || meeting.tags?.some((t: string) => 
      t.toLowerCase().includes(tag.toLowerCase())
    )

    return matchesText && matchesTag
  })

  // Pagination
  const totalPages = Math.ceil(filteredMeetings.length / meetingsPerPage)
  const startIndex = (currentPage - 1) * meetingsPerPage
  const paginatedMeetings = filteredMeetings.slice(startIndex, startIndex + meetingsPerPage)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <p>Loading meetings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#ef4444',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        margin: '16px 0'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️</div>
        <p><strong>Error:</strong> {error}</p>
      </div>
    )
  }

  if (filteredMeetings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📂</div>
        <h3 style={{ fontSize: '20px', marginBottom: '8px', fontWeight: '600' }}>
          {text || tag ? 'No matching meetings found' : 'No meetings yet'}
        </h3>
        <p style={{ fontSize: '16px', marginBottom: '16px' }}>
          {text || tag 
            ? 'Try adjusting your search or tag filters'
            : 'Start recording your first meeting to see it here'
          }
        </p>
        {(text || tag) && (
          <div style={{ 
            backgroundColor: '#fef3c7', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid #fbbf24',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
              💡 <strong>Tip:</strong> Clear your search filters to see all meetings
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Meeting Cards */}
      <div style={{ 
        display: 'grid', 
        gap: '20px',
        marginBottom: '24px'
      }}>
        {paginatedMeetings.map((meeting) => (
                          <MeetingCardEnhanced
            key={meeting.id}
            meeting={meeting}
            onOpen={onOpen}
            onSync={onSync}
            onDelete={onDelete}
            sending={sendingMeetings.has(meeting.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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

      {/* Meeting count info */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '12px', 
        color: '#6b7280',
        marginTop: '16px'
      }}>
        Showing {paginatedMeetings.length} of {filteredMeetings.length} meetings
        {(text || tag) && ` (filtered from ${meetings.length} total)`}
      </div>
    </div>
  )
}
