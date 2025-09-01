import React, { useState } from 'react'
import type { SpeakerEnhancedSummary, Speaker } from '../../../../lib/types'

interface MeetingSpeakersProps {
  note: any
  meeting: any
  search: string
}

export default function MeetingSpeakers({ note, meeting, search }: MeetingSpeakersProps) {
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null)
  
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

  // 🚨 Detect if we have JSON Schema enhanced summary with speakers
  const detectSpeakerData = (summary: string): SpeakerEnhancedSummary | null => {
    if (!summary) return null
    
    try {
      const parsed = JSON.parse(summary)
      
      if (
        parsed && 
        typeof parsed === 'object' &&
        Array.isArray(parsed.speakers) &&
        parsed.speakers.length > 0
      ) {
        return parsed as SpeakerEnhancedSummary
      }
    } catch (error) {
      // Not valid JSON, no speaker data
    }
    
    return null
  }

  const enhancedData = note?.summary ? detectSpeakerData(note.summary) : null
  const speakers = enhancedData?.speakers || []

  const getSpeakerColor = (speakerId: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA726', '#AB47BC', '#66BB6A']
    const index = parseInt(speakerId.replace('speaker_', '')) - 1
    return colors[index % colors.length] || '#6b7280'
  }

  const getEngagementIcon = (level: string) => {
    switch (level) {
      case 'high': return '🔥'
      case 'medium': return '💭'
      case 'low': return '😴'
      default: return '❓'
    }
  }

  const getCommunicationStyleIcon = (style: string) => {
    switch (style) {
      case 'assertive': return '💪'
      case 'collaborative': return '🤝'
      case 'analytical': return '🧠'
      case 'supportive': return '💝'
      case 'questioning': return '❓'
      default: return '💬'
    }
  }

  // No speaker data available
  if (!enhancedData || speakers.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>👥</div>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', color: '#374151' }}>
          No Speaker Data Available
        </h2>
        <p style={{ fontSize: '16px', marginBottom: '8px' }}>
          Speaker identification requires meetings processed with enhanced AI features.
        </p>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>
          Future meetings will automatically include speaker diarization and identification.
        </p>
        
        {/* Show participation summary if available */}
        {enhancedData?.speaker_participation && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
              Meeting Participation Summary
            </h3>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              <p>Total Speakers: {enhancedData.speaker_participation.total_speakers}</p>
              <p>Engagement Level: {getEngagementIcon(enhancedData.speaker_participation.engagement_level)} {enhancedData.speaker_participation.engagement_level}</p>
              <p>Participation Balance: 📊 {enhancedData.speaker_participation.participation_balance}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', lineHeight: '1.6' }}>
      {/* Speaker Overview Header */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '16px',
          color: '#1f2937'
        }}>
          🎤 Speaker Analysis ({speakers.length} {speakers.length === 1 ? 'Speaker' : 'Speakers'})
        </h2>
        
        {/* Participation Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            backgroundColor: '#f0f9ff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px' }}>Total Speakers</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c4a6e' }}>
              {enhancedData.speaker_participation.total_speakers} 👥
            </div>
          </div>

          <div style={{
            backgroundColor: '#f0fdf4',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Engagement</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#14532d' }}>
              {getEngagementIcon(enhancedData.speaker_participation.engagement_level)} {enhancedData.speaker_participation.engagement_level}
            </div>
          </div>

          <div style={{
            backgroundColor: '#fefce8',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #fde047'
          }}>
            <div style={{ fontSize: '12px', color: '#a16207', marginBottom: '4px' }}>Balance</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e' }}>
              📊 {enhancedData.speaker_participation.participation_balance}
            </div>
          </div>

          {enhancedData.speaker_participation.dominant_speaker && (
            <div style={{
              backgroundColor: '#fdf2f8',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #f9a8d4'
            }}>
              <div style={{ fontSize: '12px', color: '#be185d', marginBottom: '4px' }}>Dominant Speaker</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9d174d' }}>
                👑 {enhancedData.speaker_participation.dominant_speaker}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Speaker Cards */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {speakers.map((speaker, index) => (
          <div 
            key={speaker.speaker_id} 
            style={{
              backgroundColor: selectedSpeaker === speaker.speaker_id ? '#fef3c7' : '#f8fafc',
              padding: '24px',
              borderRadius: '12px',
              border: selectedSpeaker === speaker.speaker_id ? '2px solid #f59e0b' : '2px solid #e2e8f0',
              borderLeftColor: getSpeakerColor(speaker.speaker_id),
              borderLeftWidth: '5px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setSelectedSpeaker(
              selectedSpeaker === speaker.speaker_id ? null : speaker.speaker_id
            )}
            onMouseEnter={(e) => {
              if (selectedSpeaker !== speaker.speaker_id) {
                e.currentTarget.style.backgroundColor = '#f1f5f9'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSpeaker !== speaker.speaker_id) {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.borderColor = '#e2e8f0'
              }
            }}
          >
            {/* Speaker Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  color: getSpeakerColor(speaker.speaker_id),
                  margin: '0 0 6px 0'
                }}>
                  {speaker.display_name}
                  {speaker.custom_name && (
                    <span style={{ fontSize: '16px', color: '#6b7280', fontWeight: 'normal' }}>
                      {' '}({speaker.custom_name})
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '14px' }}>
                  <span style={{ 
                    backgroundColor: '#10b981', 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    📊 {speaker.talking_time_percentage.toFixed(1)}% talking time
                  </span>
                  <span style={{ 
                    backgroundColor: '#8b5cf6', 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    {getCommunicationStyleIcon(speaker.communication_style)} {speaker.communication_style}
                  </span>
                  <span style={{ 
                    backgroundColor: speaker.engagement_level === 'high' ? '#dc2626' : 
                                   speaker.engagement_level === 'medium' ? '#f59e0b' : '#6b7280', 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    {getEngagementIcon(speaker.engagement_level)} {speaker.engagement_level} engagement
                  </span>
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                opacity: selectedSpeaker === speaker.speaker_id ? 1 : 0.5,
                transition: 'opacity 0.3s ease'
              }}>
                {selectedSpeaker === speaker.speaker_id ? '🔽' : '▶️'}
              </div>
            </div>

            {/* Speaker Details (Expandable) */}
            {selectedSpeaker === speaker.speaker_id && (
              <div style={{ 
                marginTop: '20px', 
                padding: '20px', 
                backgroundColor: 'white', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                  💡 Key Contributions:
                </h4>
                <ul style={{ margin: '0 0 20px 0', paddingLeft: '20px', color: '#4b5563' }}>
                  {speaker.key_contributions.map((contribution, idx) => (
                    <li key={idx} style={{ marginBottom: '6px', fontSize: '14px', lineHeight: '1.5' }}>
                      {search ? highlightText(contribution, search) : contribution}
                    </li>
                  ))}
                </ul>

                {/* Speaking Statistics */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px',
                  marginTop: '16px'
                }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: getSpeakerColor(speaker.speaker_id) }}>
                      {speaker.talking_time_percentage.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Speaking Time</div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: getSpeakerColor(speaker.speaker_id) }}>
                      {getCommunicationStyleIcon(speaker.communication_style)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{speaker.communication_style}</div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: getSpeakerColor(speaker.speaker_id) }}>
                      {getEngagementIcon(speaker.engagement_level)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{speaker.engagement_level} engagement</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Speaker Insights Summary */}
      {enhancedData.speaker_insights && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f0f9ff',
          borderRadius: '8px',
          border: '1px solid #bae6fd'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0c4a6e', marginBottom: '16px' }}>
            📊 Conversation Dynamics
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>
                {enhancedData.speaker_insights.conversation_dynamics.total_speaker_transitions}
              </div>
              <div style={{ fontSize: '12px', color: '#0369a1' }}>Speaker Transitions</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                {enhancedData.speaker_insights.conversation_dynamics.average_speaking_duration.toFixed(1)}s
              </div>
              <div style={{ fontSize: '12px', color: '#0369a1' }}>Avg Speaking Duration</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
                {enhancedData.speaker_insights.conversation_dynamics.interruptions_count}
              </div>
              <div style={{ fontSize: '12px', color: '#0369a1' }}>Interruptions</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>
                {enhancedData.speaker_insights.conversation_dynamics.collaboration_score}/10
              </div>
              <div style={{ fontSize: '12px', color: '#0369a1' }}>Collaboration Score</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
