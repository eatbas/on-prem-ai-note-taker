import React, { useMemo, useState, useCallback } from 'react'
import MeetingCardEnhanced from './MeetingCardEnhanced'
import { LoadingProgress } from './LoadingStates'

interface VpsMeetingsTabProps {
  vpsMeetings: any[]
  vpsLoading: boolean
  vpsError: string | null
  vpsUp: boolean | null
  online: boolean
  onOpen: (meetingId: string) => void
  onContextMenu: (e: React.MouseEvent, meetingId: string, meetingTitle: string) => void
  onRefreshVpsMeetings: () => void
}

const VpsMeetingsTab: React.FC<VpsMeetingsTabProps> = ({
  vpsMeetings,
  vpsLoading,
  vpsError,
  vpsUp,
  online,
  onOpen,
  onContextMenu,
  onRefreshVpsMeetings
}) => {
  const [openingMeetingId, setOpeningMeetingId] = useState<string | null>(null)

  // Enhanced onOpen with loading state
  const handleMeetingOpen = useCallback(async (meetingId: string) => {
    setOpeningMeetingId(meetingId)
    try {
      await onOpen(meetingId)
    } finally {
      setTimeout(() => setOpeningMeetingId(null), 300)
    }
  }, [onOpen])

  // Connection status display
  const getConnectionStatus = () => {
    if (vpsUp === null) {
      return { icon: '⏳', status: 'Checking...', color: '#f59e0b', bgColor: '#fef3c7' }
    }
    if (vpsUp) {
      return { icon: '🟢', status: 'Connected', color: '#059669', bgColor: '#dcfce7' }
    }
    return { icon: '🔴', status: 'Disconnected', color: '#dc2626', bgColor: '#fee2e2' }
  }

  const connectionStatus = getConnectionStatus()

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid #e2e8f0'
      }}>
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: '1.8rem',
          fontWeight: '600',
          color: '#1e293b'
        }}>
          ☁️ VPS Meetings
        </h2>
        <p style={{
          margin: '0',
          fontSize: '1.1rem',
          color: '#64748b',
          lineHeight: '1.6'
        }}>
          Meetings stored on the VPS server. These are synced from your local recordings.
        </p>
        
        {/* VPS Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginTop: '16px'
        }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: connectionStatus.bgColor,
            color: connectionStatus.color,
            borderRadius: '8px',
            border: `1px solid ${connectionStatus.color}30`
          }}>
            {connectionStatus.icon} VPS {connectionStatus.status}
          </span>
        </div>
      </div>

      {/* VPS Error */}
      {vpsError && (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fef2f2', 
          border: '2px solid #fecaca',
          borderRadius: '12px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
            VPS Connection Error
          </div>
          <div style={{ fontSize: '14px', color: '#7f1d1d' }}>
            {vpsError}
          </div>
        </div>
      )}

      {/* VPS Loading */}
      {vpsLoading && (
        <LoadingProgress 
          message="Loading VPS meetings..."
          type="loading"
        />
      )}

      {/* VPS connection down */}
      {!vpsUp && !vpsLoading && (
        <div style={{
          padding: '32px 20px',
          backgroundColor: '#fef3c7',
          border: '2px solid #fde68a',
          borderRadius: '16px',
          textAlign: 'center',
          color: '#92400e'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔌</div>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            marginBottom: '12px',
            color: '#92400e' 
          }}>
            VPS Connection Unavailable
          </h3>
          <p style={{ 
            margin: '0 0 20px 0', 
            fontSize: '16px',
            lineHeight: '1.5' 
          }}>
            The VPS server is currently unreachable. Please check your connection or contact your administrator.
          </p>
          <div style={{
            backgroundColor: '#fed7aa',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#7c2d12',
            marginBottom: '16px'
          }}>
            💡 <strong>Tip:</strong> Your local meetings are still available and will sync automatically when the VPS comes back online.
          </div>
        </div>
      )}

      {/* VPS connected but offline */}
      {vpsUp && !online && (
        <div style={{
          padding: '32px 20px',
          backgroundColor: '#fef3c7',
          border: '2px solid #fde68a',
          borderRadius: '16px',
          textAlign: 'center',
          color: '#92400e'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📶</div>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            marginBottom: '12px',
            color: '#92400e' 
          }}>
            You Are Currently Offline
          </h3>
          <p style={{ margin: '0', fontSize: '16px' }}>
            Please check your internet connection to view VPS meetings.
          </p>
        </div>
      )}

      {/* VPS meetings list */}
      {!vpsLoading && vpsMeetings.length > 0 && vpsUp && online && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'grid', 
            gap: '20px',
            marginBottom: '24px'
          }}>
            {vpsMeetings.map((meeting) => (
              <div key={meeting.id} style={{
                backgroundColor: '#f0f9ff',
                border: '2px solid #0ea5e9',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  ☁️ VPS Meeting
                </div>
                <div style={{ padding: '4px' }}>
                  <MeetingCardEnhanced
                    meeting={meeting}
                    onOpen={handleMeetingOpen}
                    onSync={() => {}} // VPS meetings can't be synced
                    onDelete={() => {}} // Will be handled by context menu
                    onContextMenu={onContextMenu}
                    sending={false}
                    isOpeningMeeting={openingMeetingId === meeting.id}
                    showWorkspaceBadge={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VPS meetings empty state */}
      {!vpsLoading && vpsMeetings.length === 0 && vpsUp && online && (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          backgroundColor: '#f0f9ff',
          borderRadius: '16px',
          border: '2px solid #bae6fd'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>☁️</div>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#0c4a6e',
            marginBottom: '12px' 
          }}>
            No VPS Meetings Found
          </h3>
          <p style={{ 
            fontSize: '16px', 
            color: '#0369a1',
            marginBottom: '20px',
            maxWidth: '400px',
            margin: '0 auto 20px'
          }}>
            Local meetings will appear here automatically after they are successfully synced to the VPS server.
          </p>
          <div style={{ 
            backgroundColor: '#dbeafe', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid #93c5fd',
            maxWidth: '500px',
            margin: '0 auto',
            textAlign: 'left'
          }}>
            <div style={{ 
              fontSize: '14px', 
              color: '#1e40af',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              📋 How to sync meetings to VPS:
            </div>
            <ol style={{ 
              fontSize: '13px', 
              color: '#1e40af', 
              margin: 0,
              paddingLeft: '16px'
            }}>
              <li>Record a meeting in the "Personal" tab</li>
              <li>Click the "Sync" button on any local meeting</li>
              <li>Wait for processing to complete</li>
              <li>Synced meetings will appear here</li>
            </ol>
          </div>
        </div>
      )}

      {/* Refresh button for VPS meetings */}
      {vpsUp && online && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '24px'
        }}>
          <button
            onClick={onRefreshVpsMeetings}
            disabled={vpsLoading}
            style={{
              padding: '12px 24px',
              backgroundColor: vpsLoading ? '#9ca3af' : '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: vpsLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!vpsLoading) {
                e.currentTarget.style.backgroundColor = '#0284c7'
              }
            }}
            onMouseLeave={(e) => {
              if (!vpsLoading) {
                e.currentTarget.style.backgroundColor = '#0ea5e9'
              }
            }}
          >
            <span style={{
              animation: vpsLoading ? 'spin 1s linear infinite' : 'none'
            }}>
              🔄
            </span>
            {vpsLoading ? 'Refreshing...' : 'Refresh VPS Meetings'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default VpsMeetingsTab
