import React from 'react'
import type { SpeakerEnhancedSummary, Speaker } from '../../../lib/types'

interface SpeakerPreviewProps {
  summary?: string
  compact?: boolean
  maxSpeakers?: number
}

export default function SpeakerPreview({ summary, compact = false, maxSpeakers = 3 }: SpeakerPreviewProps) {
  
  // 🚨 Detect if we have JSON Schema enhanced summary with speakers
  const detectSpeakerData = (summaryText: string): SpeakerEnhancedSummary | null => {
    if (!summaryText) return null
    
    try {
      const parsed = JSON.parse(summaryText)
      
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

  const enhancedData = summary ? detectSpeakerData(summary) : null
  const speakers = enhancedData?.speakers || []

  if (!enhancedData || speakers.length === 0) {
    return null // No speaker data to display
  }

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

  const displaySpeakers = speakers.slice(0, maxSpeakers)
  const hasMoreSpeakers = speakers.length > maxSpeakers

  if (compact) {
    // Compact view for dashboard cards
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: '#6b7280',
        marginTop: '4px'
      }}>
        <span style={{ 
          backgroundColor: '#f3f4f6', 
          padding: '2px 6px', 
          borderRadius: '8px',
          fontWeight: '600',
          color: '#374151'
        }}>
          🎤 {speakers.length} {speakers.length === 1 ? 'Speaker' : 'Speakers'}
        </span>
        
        <span style={{ 
          backgroundColor: enhancedData.speaker_participation.engagement_level === 'high' ? '#fee2e2' : 
                           enhancedData.speaker_participation.engagement_level === 'medium' ? '#fef3c7' : '#f3f4f6', 
          color: enhancedData.speaker_participation.engagement_level === 'high' ? '#dc2626' : 
                 enhancedData.speaker_participation.engagement_level === 'medium' ? '#d97706' : '#6b7280',
          padding: '2px 6px', 
          borderRadius: '8px',
          fontWeight: '600'
        }}>
          {getEngagementIcon(enhancedData.speaker_participation.engagement_level)} {enhancedData.speaker_participation.engagement_level}
        </span>

        <span style={{ 
          backgroundColor: '#f0f9ff', 
          color: '#0369a1',
          padding: '2px 6px', 
          borderRadius: '8px',
          fontWeight: '600'
        }}>
          📊 {enhancedData.speaker_participation.participation_balance}
        </span>
      </div>
    )
  }

  // Expanded view for detailed previews
  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      marginTop: '8px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#374151'
        }}>
          🎤 Speaker Analysis ({speakers.length} {speakers.length === 1 ? 'Speaker' : 'Speakers'})
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          display: 'flex',
          gap: '8px'
        }}>
          <span>{getEngagementIcon(enhancedData.speaker_participation.engagement_level)} {enhancedData.speaker_participation.engagement_level}</span>
          <span>📊 {enhancedData.speaker_participation.participation_balance}</span>
        </div>
      </div>

      {/* Speaker Pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {displaySpeakers.map((speaker) => (
          <div
            key={speaker.speaker_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'white',
              border: `1px solid ${getSpeakerColor(speaker.speaker_id)}`,
              borderRadius: '12px',
              padding: '4px 8px',
              fontSize: '12px'
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getSpeakerColor(speaker.speaker_id)
              }}
            />
            <span style={{ fontWeight: '600', color: '#374151' }}>
              {speaker.display_name}
            </span>
            <span style={{ color: '#6b7280' }}>
              {speaker.talking_time_percentage.toFixed(0)}%
            </span>
          </div>
        ))}
        
        {hasMoreSpeakers && (
          <div style={{
            padding: '4px 8px',
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#6b7280',
            fontWeight: '600'
          }}>
            +{speakers.length - maxSpeakers} more
          </div>
        )}
      </div>

      {/* Quick insights */}
      {enhancedData.speaker_participation.dominant_speaker && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          👑 <strong>Dominant:</strong> {enhancedData.speaker_participation.dominant_speaker}
        </div>
      )}
    </div>
  )
}

// 🚨 Utility function to check if a meeting has speaker data
export const hasSpeakerData = (summary?: string): boolean => {
  if (!summary) return false
  
  try {
    const parsed = JSON.parse(summary)
    return !!(
      parsed && 
      typeof parsed === 'object' &&
      Array.isArray(parsed.speakers) &&
      parsed.speakers.length > 0
    )
  } catch (error) {
    return false
  }
}
