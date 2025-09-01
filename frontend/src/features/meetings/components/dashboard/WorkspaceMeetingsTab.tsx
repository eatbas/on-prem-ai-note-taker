import React, { useMemo, useState, useCallback } from 'react'
import MeetingCardEnhanced from './MeetingCardEnhanced'
import { DashboardLoadingState } from './LoadingStates'

interface WorkspaceMeetingsTabProps {
  meetings: any[]
  loading: boolean
  hasWorkspace: boolean
  hasMultipleWorkspaces: boolean
  userWorkspace: any
  userWorkspaces: any[]
  responsibleWorkspaces: any[]
  totalWorkspaces: number
  activeWorkspaceSubTab: 'all' | number
  setActiveWorkspaceSubTab: (tab: 'all' | number) => void
  onOpen: (meetingId: string) => void
  onContextMenu: (e: React.MouseEvent, meetingId: string, meetingTitle: string) => void
}

const WorkspaceMeetingsTab: React.FC<WorkspaceMeetingsTabProps> = ({
  meetings,
  loading,
  hasWorkspace,
  hasMultipleWorkspaces,
  userWorkspace,
  userWorkspaces,
  responsibleWorkspaces,
  totalWorkspaces,
  activeWorkspaceSubTab,
  setActiveWorkspaceSubTab,
  onOpen,
  onContextMenu
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

  // Filter workspace meetings based on active sub-tab
  const workspaceMeetings = useMemo(() => {
    if (activeWorkspaceSubTab === 'all') {
      // Show all workspace meetings
      return meetings.filter(meeting => 
        userWorkspaces.some(w => w.id === meeting.workspace_id) && !meeting.is_personal
      )
    } else {
      // Show meetings for specific workspace
      return meetings.filter(meeting => 
        meeting.workspace_id === activeWorkspaceSubTab && !meeting.is_personal
      )
    }
  }, [meetings, userWorkspaces, activeWorkspaceSubTab])

  if (loading) {
    return <DashboardLoadingState meetingsCount={3} />
  }

  // No workspace assigned
  if (!hasWorkspace) {
    return (
      <div style={{
        padding: '60px 20px',
        backgroundColor: '#fef3c7',
        border: '2px solid #fde68a',
        borderRadius: '16px',
        textAlign: 'center',
        color: '#92400e'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏢</div>
        <h3 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          marginBottom: '12px',
          color: '#92400e' 
        }}>
          No Workspace Assigned
        </h3>
        <p style={{ 
          fontSize: '16px', 
          marginBottom: '20px',
          lineHeight: '1.5' 
        }}>
          You need to be assigned to a workspace to view and create workspace meetings.
        </p>
        <div style={{
          backgroundColor: '#fed7aa',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#7c2d12',
          textAlign: 'left',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>
            📞 What to do:
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>Contact your administrator</li>
            <li>Request workspace access</li>
            <li>Check back after assignment</li>
          </ul>
        </div>
      </div>
    )
  }

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
          🏢 {hasMultipleWorkspaces ? 'Your Workspaces' : (userWorkspace?.name || 'Workspace')} Meetings
        </h2>
        <p style={{
          margin: '0',
          fontSize: '1.1rem',
          color: '#64748b',
          lineHeight: '1.6'
        }}>
          {hasMultipleWorkspaces 
            ? `You're part of ${totalWorkspaces} workspaces. Switch between them to view specific meetings.`
            : 'Meetings shared with your workspace team. All workspace members can view these recordings.'
          }
        </p>
        
        {/* Workspace Info */}
        {hasMultipleWorkspaces && responsibleWorkspaces.length > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <span style={{
              fontSize: '14px',
              color: '#64748b',
              fontWeight: '500'
            }}>
              👑 You're responsible for: {responsibleWorkspaces.map(w => w.name).join(', ')}
            </span>
          </div>
        )}
        {!hasMultipleWorkspaces && userWorkspace && (
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
              backgroundColor: '#dcfce7',
              color: '#166534',
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              🏢 {userWorkspace.name}
            </span>
          </div>
        )}
      </div>

      {/* Workspace Sub-tabs */}
      {hasWorkspace && hasMultipleWorkspaces && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '24px',
          backgroundColor: 'white',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}>
          {/* ALL tab */}
          <button
            onClick={() => setActiveWorkspaceSubTab('all')}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: activeWorkspaceSubTab === 'all' ? '#3b82f6' : '#f8fafc',
              color: activeWorkspaceSubTab === 'all' ? 'white' : '#64748b',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderRight: '1px solid #e2e8f0'
            }}
            onMouseEnter={(e) => {
              if (activeWorkspaceSubTab !== 'all') {
                e.currentTarget.style.backgroundColor = '#e2e8f0'
              }
            }}
            onMouseLeave={(e) => {
              if (activeWorkspaceSubTab !== 'all') {
                e.currentTarget.style.backgroundColor = '#f8fafc'
              }
            }}
          >
            📋 ALL
          </button>
          
          {/* Individual workspace tabs */}
          {userWorkspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => setActiveWorkspaceSubTab(workspace.id)}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: activeWorkspaceSubTab === workspace.id ? '#3b82f6' : '#f8fafc',
                color: activeWorkspaceSubTab === workspace.id ? 'white' : '#64748b',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRight: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (activeWorkspaceSubTab !== workspace.id) {
                  e.currentTarget.style.backgroundColor = '#e2e8f0'
                }
              }}
              onMouseLeave={(e) => {
                if (activeWorkspaceSubTab !== workspace.id) {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                }
              }}
            >
              <span>🏢</span>
              <span>{workspace.name}</span>
              {workspace.is_responsible && <span style={{ fontSize: '10px' }}>👑</span>}
            </button>
          ))}
        </div>
      )}

      {/* Workspace Meetings List */}
      {workspaceMeetings.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          backgroundColor: '#f9fafb',
          borderRadius: '16px',
          border: '2px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📝</div>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '12px' 
          }}>
            No Workspace Meetings Found
          </h3>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            marginBottom: '20px',
            maxWidth: '400px',
            margin: '0 auto 20px'
          }}>
            {activeWorkspaceSubTab === 'all' 
              ? 'No meetings found in any of your workspaces'
              : `No meetings found in ${userWorkspaces.find(w => w.id === activeWorkspaceSubTab)?.name || 'this workspace'}`
            }
          </p>
          <div style={{ 
            backgroundColor: '#f0f9ff', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid #bae6fd',
            maxWidth: '500px',
            margin: '0 auto',
            textAlign: 'left'
          }}>
            <div style={{ 
              fontSize: '14px', 
              color: '#0369a1',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              💼 How to create workspace meetings:
            </div>
            <ol style={{ 
              fontSize: '13px', 
              color: '#0369a1', 
              margin: 0,
              paddingLeft: '16px'
            }}>
              <li>Start recording from the main dashboard</li>
              <li>Select "Workspace" instead of "Personal"</li>
              <li>Choose your workspace during recording</li>
              <li>Meeting will be shared with workspace team</li>
            </ol>
          </div>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: '20px',
          marginBottom: '24px'
        }}>
          {workspaceMeetings.map((meeting) => (
            <div key={meeting.id} style={{
              backgroundColor: '#f0f9ff',
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              {/* Workspace Badge */}
              {activeWorkspaceSubTab === 'all' && (
                <div style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  🏢 {userWorkspaces.find(w => w.id === meeting.workspace_id)?.name || 'Unknown Workspace'}
                </div>
              )}
              
              <div style={{ padding: '4px' }}>
                <MeetingCardEnhanced
                  meeting={meeting}
                  onOpen={handleMeetingOpen}
                  onSync={() => {}} // Workspace meetings handled differently
                  onDelete={() => {}} // Will be handled by context menu
                  onContextMenu={onContextMenu}
                  sending={false}
                  isOpeningMeeting={openingMeetingId === meeting.id}
                  showWorkspaceBadge={false} // Already shown above
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workspace Meeting Stats */}
      {workspaceMeetings.length > 0 && (
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#6b7280',
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ marginBottom: '4px' }}>
            🏢 Showing {workspaceMeetings.length} workspace meeting{workspaceMeetings.length !== 1 ? 's' : ''}
            {activeWorkspaceSubTab !== 'all' && (
              <span> from {userWorkspaces.find(w => w.id === activeWorkspaceSubTab)?.name}</span>
            )}
          </div>
          {hasMultipleWorkspaces && (
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
              Total workspaces: {totalWorkspaces} • 
              Your workspaces: {userWorkspaces.length} • 
              Responsible for: {responsibleWorkspaces.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WorkspaceMeetingsTab
