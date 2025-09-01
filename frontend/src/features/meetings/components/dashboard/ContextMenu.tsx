import React, { memo, useEffect } from 'react'

interface ContextMenuProps {
  visible: boolean
  x: number
  y: number
  meetingId: string
  meetingTitle: string
  onClose: () => void
  onRename: (meetingId: string) => void
  onDeleteAudio: (meetingId: string) => void
  onDeleteMeeting: (meetingId: string) => void
}

const ContextMenu = memo(function ContextMenu({
  visible,
  x,
  y,
  meetingId,
  meetingTitle,
  onClose,
  onRename,
  onDeleteAudio,
  onDeleteMeeting
}: ContextMenuProps) {
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (visible) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onClose()
      }
    }

    if (visible) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) {
    return null
  }

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 200)

  const menuItems = [
    {
      icon: '✏️',
      label: 'Rename Meeting',
      action: () => onRename(meetingId),
      color: '#374151',
      hoverColor: '#f3f4f6'
    },
    {
      icon: '🎵',
      label: 'Delete Audio Only',
      action: () => onDeleteAudio(meetingId),
      color: '#f59e0b',
      hoverColor: '#fef3c7',
      description: 'Keep meeting data, remove audio files'
    },
    {
      icon: '🗑️',
      label: 'Delete Meeting',
      action: () => onDeleteMeeting(meetingId),
      color: '#dc2626',
      hoverColor: '#fee2e2',
      description: 'Permanently delete everything',
      dangerous: true
    }
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          zIndex: 999
        }}
        onClick={onClose}
      />

      {/* Menu */}
      <div
        style={{
          position: 'fixed',
          top: adjustedY,
          left: adjustedX,
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 1000,
          minWidth: '220px',
          overflow: 'hidden',
          animation: 'contextMenuSlideIn 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            fontWeight: '500',
            marginBottom: '4px'
          }}>
            Meeting Actions
          </div>
          <div style={{
            fontSize: '14px',
            color: '#1f2937',
            fontWeight: '600',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {meetingTitle}
          </div>
        </div>

        {/* Menu Items */}
        <div style={{ padding: '8px 0' }}>
          {menuItems.map((item, index) => (
            <div key={index}>
              <div
                onClick={() => {
                  item.action()
                  onClose()
                }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = item.hoverColor
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span style={{ 
                  fontSize: '16px',
                  minWidth: '20px',
                  textAlign: 'center'
                }}>
                  {item.icon}
                </span>
                
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: item.dangerous ? item.color : '#1f2937',
                    marginBottom: item.description ? '2px' : 0
                  }}>
                    {item.label}
                  </div>
                  
                  {item.description && (
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      lineHeight: '1.3'
                    }}>
                      {item.description}
                    </div>
                  )}
                </div>

                {item.dangerous && (
                  <div style={{
                    fontSize: '10px',
                    color: '#dc2626',
                    backgroundColor: '#fee2e2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: '600'
                  }}>
                    DANGER
                  </div>
                )}
              </div>

              {/* Separator before dangerous actions */}
              {index === menuItems.length - 2 && (
                <div style={{
                  height: '1px',
                  backgroundColor: '#f3f4f6',
                  margin: '4px 0'
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #f3f4f6',
          backgroundColor: '#f8fafc',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#9ca3af',
            fontStyle: 'italic'
          }}>
            Right-click for quick actions
          </div>
        </div>
      </div>

      <style>{`
        @keyframes contextMenuSlideIn {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(-5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  )
})

export default ContextMenu
