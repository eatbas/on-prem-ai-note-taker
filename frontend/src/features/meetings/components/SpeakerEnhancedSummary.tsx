import React, { useState } from 'react'
import type { 
  SpeakerEnhancedSummary, 
  Speaker, 
  DiscussionPoint, 
  Decision, 
  ActionItem,
  ConversationFlow,
  SpeakerInsights
} from '../../../lib/types'

interface SpeakerEnhancedSummaryProps {
  summaryData: SpeakerEnhancedSummary
  rawSummary?: string
  search?: string
}

export default function SpeakerEnhancedSummaryComponent({ 
  summaryData, 
  rawSummary, 
  search = '' 
}: SpeakerEnhancedSummaryProps) {
  
  const [activeSection, setActiveSection] = useState<string>('overview')
  
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return '🚨'
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
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

  const sections = [
    { id: 'overview', label: '📋 Overview', icon: '📋' },
    { id: 'speakers', label: '🎤 Speakers', icon: '🎤' },
    { id: 'discussion', label: '💬 Discussion', icon: '💬' },
    { id: 'decisions', label: '✅ Decisions', icon: '✅' },
    { id: 'actions', label: '📝 Actions', icon: '📝' },
    { id: 'insights', label: '📊 Insights', icon: '📊' },
  ]

  return (
    <div style={{ padding: '20px', lineHeight: '1.6' }}>
      {/* Schema Validation Badge */}
      {summaryData.schema_validated && (
        <div style={{
          display: 'inline-block',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          🎯 JSON Schema Validated - Anti-Hallucination Active
        </div>
      )}

      {/* Section Navigation */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '30px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '16px'
      }}>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: activeSection === section.id ? '#3b82f6' : '#f1f5f9',
              color: activeSection === section.id ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {section.icon} {section.label}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      {activeSection === 'overview' && (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            📋 Meeting Overview
          </h2>
          
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '16px', color: '#374151', marginBottom: '0' }}>
              {search ? highlightText(summaryData.meeting_overview, search) : summaryData.meeting_overview}
            </p>
          </div>

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
                {summaryData.speaker_participation.total_speakers} 👥
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
                {getEngagementIcon(summaryData.speaker_participation.engagement_level)} {summaryData.speaker_participation.engagement_level}
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
                📊 {summaryData.speaker_participation.participation_balance}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'speakers' && (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            🎤 Speaker Analysis
          </h2>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {summaryData.speakers.map((speaker, index) => (
              <div key={speaker.speaker_id} style={{
                backgroundColor: '#f8fafc',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                borderLeftColor: getSpeakerColor(speaker.speaker_id),
                borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: getSpeakerColor(speaker.speaker_id),
                      margin: '0 0 4px 0'
                    }}>
                      {speaker.display_name}
                      {speaker.custom_name && (
                        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 'normal' }}>
                          {' '}({speaker.custom_name})
                        </span>
                      )}
                    </h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '14px' }}>
                      <span style={{ color: '#059669' }}>
                        📊 {speaker.talking_time_percentage.toFixed(1)}% talking time
                      </span>
                      <span style={{ color: '#7c3aed' }}>
                        {getCommunicationStyleIcon(speaker.communication_style)} {speaker.communication_style}
                      </span>
                      <span style={{ color: '#dc2626' }}>
                        {getEngagementIcon(speaker.engagement_level)} {speaker.engagement_level} engagement
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Contributions */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    💡 Key Contributions:
                  </h4>
                  <ul style={{ margin: '0', paddingLeft: '20px', color: '#4b5563' }}>
                    {speaker.key_contributions.map((contribution, idx) => (
                      <li key={idx} style={{ marginBottom: '4px', fontSize: '14px' }}>
                        {search ? highlightText(contribution, search) : contribution}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'discussion' && (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            💬 Key Discussion Points
          </h2>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            {summaryData.key_discussion_points.map((point, index) => (
              <div key={index} style={{
                backgroundColor: '#f8fafc',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    📌 {search ? highlightText(point.topic, search) : point.topic}
                  </h3>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: point.consensus_reached ? '#10b981' : '#f59e0b',
                    color: 'white'
                  }}>
                    {point.consensus_reached ? '✅ Consensus' : '⏳ Open'}
                  </span>
                </div>

                {/* Conversation Flow */}
                <div style={{ display: 'grid', gap: '8px' }}>
                  {point.conversation_flow.map((flow, flowIndex) => (
                    <div key={flowIndex} style={{
                      display: 'flex',
                      alignItems: 'start',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getSpeakerColor(
                          summaryData.speakers.find(s => s.display_name === flow.speaker)?.speaker_id || 'speaker_1'
                        ),
                        marginTop: '6px',
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                          <strong>{flow.speaker}</strong> {flow.contribution_type}
                        </div>
                        <div style={{ fontSize: '14px', color: '#374151' }}>
                          {search ? highlightText(flow.contribution, search) : flow.contribution}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'decisions' && (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            ✅ Decisions Made
          </h2>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {summaryData.decisions_made.map((decision, index) => (
              <div key={index} style={{
                backgroundColor: '#f0fdf4',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#166534', margin: 0 }}>
                    {search ? highlightText(decision.decision, search) : decision.decision}
                  </h3>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: decision.impact_level === 'high' ? '#dc2626' : 
                                   decision.impact_level === 'medium' ? '#f59e0b' : '#10b981',
                    color: 'white'
                  }}>
                    {decision.impact_level} impact
                  </span>
                </div>

                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
                  <strong>Proposed by:</strong> {decision.proposed_by}
                </div>

                {decision.supported_by.length > 0 && (
                  <div style={{ fontSize: '14px', color: '#059669', marginBottom: '8px' }}>
                    <strong>✅ Supported by:</strong> {decision.supported_by.join(', ')}
                  </div>
                )}

                {decision.opposed_by.length > 0 && (
                  <div style={{ fontSize: '14px', color: '#dc2626', marginBottom: '8px' }}>
                    <strong>❌ Opposed by:</strong> {decision.opposed_by.join(', ')}
                  </div>
                )}

                <div style={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                  <strong>Final Agreement:</strong> {decision.final_agreement}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'actions' && (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            📝 Action Items
          </h2>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {summaryData.action_items.map((item, index) => (
              <div key={index} style={{
                backgroundColor: '#fffbeb',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #fed7aa',
                borderLeft: `4px solid ${item.priority === 'critical' ? '#dc2626' : 
                                       item.priority === 'high' ? '#f59e0b' :
                                       item.priority === 'medium' ? '#10b981' : '#6b7280'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', margin: 0 }}>
                    {getPriorityIcon(item.priority)} {search ? highlightText(item.task, search) : item.task}
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#78716c' }}>
                  <span><strong>👤 Owner:</strong> {item.assigned_to}</span>
                  {item.mentioned_by && (
                    <span><strong>💬 Mentioned by:</strong> {item.mentioned_by}</span>
                  )}
                  {item.due_date && (
                    <span><strong>📅 Due:</strong> {item.due_date}</span>
                  )}
                </div>

                {item.context && (
                  <div style={{ fontSize: '14px', color: '#57534e', marginTop: '8px', fontStyle: 'italic' }}>
                    <strong>Context:</strong> {search ? highlightText(item.context, search) : item.context}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'insights' && summaryData.speaker_insights && (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            📊 Speaker Insights & Analytics
          </h2>
          
          {/* Conversation Dynamics */}
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
              🔄 Conversation Dynamics
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                  {summaryData.speaker_insights.conversation_dynamics.total_speaker_transitions}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Speaker Transitions</div>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                  {summaryData.speaker_insights.conversation_dynamics.average_speaking_duration.toFixed(1)}s
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Avg Speaking Duration</div>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {summaryData.speaker_insights.conversation_dynamics.interruptions_count}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Interruptions</div>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {summaryData.speaker_insights.conversation_dynamics.collaboration_score}/10
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Collaboration Score</div>
              </div>
            </div>
          </div>

          {/* Leadership Patterns */}
          {summaryData.speaker_insights.leadership_patterns.length > 0 && (
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                👑 Leadership Patterns
              </h3>
              
              <div style={{ display: 'grid', gap: '12px' }}>
                {summaryData.speaker_insights.leadership_patterns.map((pattern, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600', color: '#374151' }}>{pattern.speaker}</span>
                      <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '8px' }}>
                        {pattern.leadership_style}
                      </span>
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: pattern.influence_level === 'high' ? '#10b981' :
                                     pattern.influence_level === 'medium' ? '#f59e0b' : '#6b7280',
                      color: 'white'
                    }}>
                      {pattern.influence_level} influence
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meeting Effectiveness */}
          {summaryData.meeting_effectiveness && (
            <div style={{
              backgroundColor: '#f0fdf4',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              marginTop: '20px'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#166534', marginBottom: '16px' }}>
                🎯 Meeting Effectiveness
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Goal Achievement</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#14532d' }}>
                    {summaryData.meeting_effectiveness.goal_achievement.replace('_', ' ')}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Time Management</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#14532d' }}>
                    {summaryData.meeting_effectiveness.time_management}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Participation Quality</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#14532d' }}>
                    {summaryData.meeting_effectiveness.participation_quality}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Decision Clarity</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#14532d' }}>
                    {summaryData.meeting_effectiveness.decision_clarity.replace('_', ' ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw JSON View (for debugging/development) */}
      {rawSummary && (
        <details style={{ marginTop: '40px' }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontSize: '14px', 
            color: '#6b7280',
            fontWeight: '600'
          }}>
            🔍 View Raw JSON Summary (Developer)
          </summary>
          <pre style={{
            backgroundColor: '#1f2937',
            color: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            overflow: 'auto',
            marginTop: '8px'
          }}>
            {rawSummary}
          </pre>
        </details>
      )}
    </div>
  )
}
