import React from 'react'
import type { SpeakerEnhancedSummary, Speaker } from '../../../../lib/types'

interface SpeakerPreviewProps {
  summary?: string
  compact?: boolean
  maxSpeakers?: number
}

// Helper function to detect if we have speaker data
export function hasSpeakerData(summaryText: string): boolean {
  if (!summaryText) return false
  
  try {
    const parsed = JSON.parse(summaryText)
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.speakers) && parsed.speakers.length > 0
  } catch (error) {
    return false
  }
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

  const summaryData = detectSpeakerData(summary || '')
  
  if (!summaryData || !summaryData.speakers || summaryData.speakers.length === 0) {
    return null // 🚨 Hide if no speaker data
  }

  const speakers = summaryData.speakers.slice(0, maxSpeakers)

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getParticipationLevel = (speaker: any) => {
    const speakingTime = (speaker as any).totalSpeakingTime || 0
    if (speakingTime > 300) return 'high' // 5+ minutes
    if (speakingTime > 120) return 'medium' // 2+ minutes  
    if (speakingTime > 30) return 'low' // 30+ seconds
    return 'minimal'
  }

  const getParticipationColor = (level: string) => {
    switch (level) {
      case 'high': return '#10b981'
      case 'medium': return '#f59e0b'
      case 'low': return '#3b82f6'
      case 'minimal': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getParticipationEmoji = (level: string) => {
    switch (level) {
      case 'high': return '🗣️'
      case 'medium': return '💬'
      case 'low': return '🔇'
      case 'minimal': return '👤'
      default: return '❓'
    }
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <span>👥</span>
        <span>{speakers.length} speaker{speakers.length !== 1 ? 's' : ''}</span>
        {speakers.map((speaker, index) => {
          const level = getParticipationLevel(speaker)
          const emoji = getParticipationEmoji(level)
          return (
            <span
              key={index}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '1px 4px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                fontSize: '10px'
              }}
            >
              {emoji} {(speaker as any).name || `S${index + 1}`}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px',
      border: '1px solid #e2e8f0'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          👥 Speakers ({speakers.length})
        </span>
      </div>

      {/* Speaker List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '6px'
      }}>
        {speakers.map((speaker, index) => {
          const level = getParticipationLevel(speaker)
          const color = getParticipationColor(level)
          const emoji = getParticipationEmoji(level)
          
          return (
            <div
              key={index}
              style={{
                padding: '6px 8px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: `1px solid ${color}20`,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '500',
                color: '#1f2937'
              }}>
                <span>{emoji}</span>
                <span>{(speaker as any).name || `Speaker ${index + 1}`}</span>
              </div>
              
              {(speaker as any).role && (
                <div style={{
                  fontSize: '9px',
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  {(speaker as any).role}
                </div>
              )}
              
              <div style={{
                fontSize: '9px',
                color: color,
                fontWeight: '500'
              }}>
                {formatDuration((speaker as any).totalSpeakingTime)} • {level}
              </div>
            </div>
          )
        })}
      </div>

      {summaryData.speakers.length > maxSpeakers && (
        <div style={{
          marginTop: '6px',
          fontSize: '10px',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          +{summaryData.speakers.length - maxSpeakers} more speakers
        </div>
      )}
    </div>
  )
}