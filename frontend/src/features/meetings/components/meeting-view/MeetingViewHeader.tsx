import React, { memo, useState } from 'react'

interface MeetingViewHeaderProps {
  meeting: any
  onBack?: () => void
  onTitleChange: (title: string) => void
  onSync: () => void
  sending: boolean
  isRemote: boolean
  onDelete: () => void
  search: string
  onSearchChange: (search: string) => void
  activeTab: 'summary' | 'transcript' | 'audio' | 'speakers'
  onTabChange: (tab: 'summary' | 'transcript' | 'audio' | 'speakers') => void
}

const MeetingViewHeader = memo(function MeetingViewHeader({
  meeting,
  onBack,
  onTitleChange,
  onSync,
  sending,
  isRemote,
  onDelete,
  search,
  onSearchChange,
  activeTab,
  onTabChange
}: MeetingViewHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(meeting?.title || '')

  const handleTitleSubmit = () => {
    if (titleValue.trim() && titleValue !== meeting?.title) {
      onTitleChange(titleValue.trim())
    }
    setIsEditingTitle(false)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusDisplay = () => {
    switch (meeting?.status) {
      case 'recording':
        return { icon: '🎙️', text: 'Recording in Progress', color: '#dc2626' }
      case 'local':
        return { icon: '🏠', text: 'Local Only', color: '#6b7280' }
      case 'queued':
        return { icon: '⏳', text: 'Queued for Processing', color: '#f59e0b' }
      case 'uploading':
        return { icon: '📤', text: 'Uploading', color: '#3b82f6' }
      case 'processing':
        return { icon: '🤖', text: 'AI Processing', color: '#7c3aed' }
      case 'synced':
      case 'sent':
        return { icon: '☁️', text: 'Synced to VPS', color: '#10b981' }
      default:
        return { icon: '❓', text: 'Unknown Status', color: '#6b7280' }
    }
  }

  const status = getStatusDisplay()

  const tabs = [
    { id: 'summary', label: 'Summary', icon: '📋' },
    { id: 'transcript', label: 'Transcript', icon: '📝' },
    { id: 'audio', label: 'Audio', icon: '🎵' },
    { id: 'speakers', label: 'Speakers', icon: '👥' }
  ]

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Left side - Back button and title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
            >
              ← Back to Dashboard
            </button>
          )}

          <div style={{ flex: 1 }}>
            {/* Title */}
            {isEditingTitle ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                autoFocus
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937',
                  border: '2px solid #3b82f6',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  backgroundColor: 'white',
                  outline: 'none',
                  width: '100%',
                  maxWidth: '500px'
                }}
              />
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937',
                  margin: 0,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {meeting?.title || 'Untitled Meeting'}
              </h1>
            )}

            {/* Metadata */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '8px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              <span>📅 {formatDate(meeting?.createdAt || Date.now())}</span>
              {meeting?.duration && (
                <span>⏱️ {Math.round(meeting.duration / 60)} minutes</span>
              )}
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: status.color,
                fontWeight: '500'
              }}>
                {status.icon} {status.text}
              </span>
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isRemote && meeting?.status !== 'synced' && meeting?.status !== 'sent' && (
            <button
              onClick={onSync}
              disabled={sending}
              style={{
                padding: '8px 16px',
                backgroundColor: sending ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {sending ? '⏳ Processing...' : '☁️ Sync to VPS'}
            </button>
          )}

          <button
            onClick={onDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
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
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px 16px'
      }}>
        <input
          type="text"
          placeholder="🔍 Search in meeting content, speakers, or transcript..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: '#f9fafb',
            outline: 'none',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.backgroundColor = 'white'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#d1d5db'
            e.currentTarget.style.backgroundColor = '#f9fafb'
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        borderBottom: '1px solid #e5e7eb'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as any)}
            style={{
              flex: 1,
              padding: '16px 24px',
              backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <span style={{ fontSize: '18px', marginRight: '8px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
})

export default MeetingViewHeader
