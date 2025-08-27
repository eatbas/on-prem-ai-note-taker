import React from 'react'

interface MeetingTranscriptProps {
  note: any
  search: string
}

export default function MeetingTranscript({ note, search }: MeetingTranscriptProps) {
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
    <div style={{ padding: '20px' }}>
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: 'bold', 
        marginBottom: '16px',
        color: '#1f2937'
      }}>
        📝 Transcript
      </h2>
      
      {note?.transcript ? (
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '24px', 
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          minHeight: '400px'
        }}>
          <div style={{ 
            fontSize: '16px', 
            lineHeight: '1.8', 
            color: '#374151',
            whiteSpace: 'pre-wrap',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {search ? highlightText(note.transcript, search) : note.transcript}
          </div>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          color: '#6b7280', 
          fontStyle: 'italic',
          padding: '80px 20px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎤</div>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', fontWeight: '600' }}>
            No transcript available
          </h3>
          <p style={{ fontSize: '16px', marginBottom: '16px' }}>
            Process this meeting to generate a transcript
          </p>
          <div style={{ 
            backgroundColor: '#fef3c7', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid #fbbf24',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
              💡 <strong>Tip:</strong> Use the "Process Meeting" button to automatically 
              transcribe your audio using AI
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
