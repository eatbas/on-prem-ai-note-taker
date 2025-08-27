import React from 'react'

interface MeetingSummaryProps {
  note: any
  meeting: any
  search: string
}

export default function MeetingSummary({ note, meeting, search }: MeetingSummaryProps) {
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text
    
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} style={{ backgroundColor: '#ffeb3b', color: '#000' }}>
          {part}
        </span>
      ) : part
    )
  }

  return (
    <div style={{ padding: '20px', lineHeight: '1.6' }}>
      {/* Summary Section */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '16px',
          color: '#1f2937'
        }}>
          📋 Summary
        </h2>
        {note?.summary ? (
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <p style={{ 
              fontSize: '16px', 
              color: '#374151',
              whiteSpace: 'pre-wrap'
            }}>
              {search ? highlightText(note.summary, search) : note.summary}
            </p>
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            color: '#6b7280', 
            fontStyle: 'italic',
            padding: '40px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <p>No summary available yet</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Process this meeting to generate a summary
            </p>
          </div>
        )}
      </div>

      {/* Meeting Details */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '12px',
          color: '#1f2937'
        }}>
          📊 Meeting Details
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: '16px', 
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Created
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              {meeting ? new Date(meeting.createdAt).toLocaleString() : 'Unknown'}
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: '16px', 
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Language
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              {meeting?.language || 'Auto-detect'}
            </div>
          </div>
          
          {meeting?.duration && (
            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: '16px', 
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Duration
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                {Math.floor(meeting.duration / 60)}m {meeting.duration % 60}s
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
