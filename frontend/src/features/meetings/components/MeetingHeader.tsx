import React, { useState } from 'react'
import { TagsManager } from '../../../components/common'

interface MeetingHeaderProps {
  meeting: any
  onBack?: () => void
  onTitleChange: (title: string) => void
  onSync: () => void
  sending: boolean
  isRemote: boolean
  onTagsUpdate: (tags: string[]) => void
  onDelete: () => void
  search: string
  onSearchChange: (search: string) => void
  activeTab: 'summary' | 'transcript' | 'audio' | 'speakers'
  onTabChange: (tab: 'summary' | 'transcript' | 'audio' | 'speakers') => void
}

export default function MeetingHeader({
  meeting,
  onBack,
  onTitleChange,
  onSync,
  sending,
  isRemote,
  onTagsUpdate,
  onDelete,
  search,
  onSearchChange,
  activeTab,
  onTabChange
}: MeetingHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleTitleEdit = () => {
    setNewTitle(meeting?.title || '')
    setEditingTitle(true)
  }

  const handleTitleSave = () => {
    onTitleChange(newTitle)
    setEditingTitle(false)
  }

  const handleTitleCancel = () => {
    setEditingTitle(false)
    setNewTitle('')
  }

  return (
    <div style={{ 
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      padding: '20px 24px'
    }}>
      {/* Header Row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        {/* Left Side - Back Button and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ← Back
            </button>
          )}
          
          {/* Title */}
          <div style={{ flex: 1 }}>
            {editingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    border: '2px solid #3b82f6',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    backgroundColor: '#ffffff',
                    minWidth: '300px'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave()
                    if (e.key === 'Escape') handleTitleCancel()
                  }}
                />
                <button
                  onClick={handleTitleSave}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleTitleCancel}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <h1 
                style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: '#1f2937',
                  margin: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={handleTitleEdit}
              >
                {meeting?.title || 'Loading...'}
                <span style={{ fontSize: '16px', color: '#6b7280' }}>✏️</span>
              </h1>
            )}
          </div>
        </div>

        {/* Right Side - Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onSync}
            disabled={sending}
            style={{
              padding: '8px 16px',
              backgroundColor: sending ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.6 : 1
            }}
          >
            {sending ? '⏳ Processing...' : (isRemote ? '🔄 Re-process' : '📤 Process Meeting')}
          </button>
          
          <button
            onClick={onDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Tags */}
      <div style={{ marginBottom: '20px' }}>
        <TagsManager
          meetingId={meeting?.id}
          currentTags={meeting?.tags || []}
          onTagsUpdate={onTagsUpdate}
          online={true}
          vpsUp={true}
        />
      </div>

      {/* Search and Tabs */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Search */}
        <div style={{ flex: 1, maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="🔍 Search in meeting..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '4px'
        }}>
          {[
            { key: 'summary', label: '📋 Summary' },
            { key: 'transcript', label: '📝 Transcript' },
            { key: 'audio', label: '🎵 Audio' },
            { key: 'speakers', label: '👥 Speakers' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key as any)}
              style={{
                padding: '8px 16px',
                backgroundColor: activeTab === tab.key ? '#ffffff' : 'transparent',
                color: activeTab === tab.key ? '#1f2937' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: activeTab === tab.key ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
