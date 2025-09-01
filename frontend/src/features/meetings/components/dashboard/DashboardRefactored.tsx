import React, { memo, Suspense, lazy } from 'react'
import { useUserWorkspace } from '../../../../hooks/useUserWorkspace'
import { useToast } from '../../../../components/common'
import { getComputerUsername } from '../../../../utils/usernameDetector'
import { useDashboardState } from '../../hooks/useDashboardState'

// Lazy load components for better performance
const AskLlama = lazy(() => import('../../../admin/pages/AskLlama'))

// Import dashboard components
import {
  LocalMeetingsTab,
  VpsMeetingsTab,
  WorkspaceMeetingsTab,
  ContextMenu,
  LoadingProgress
} from './index'

interface DashboardProps {
  onOpen: (meetingId: string) => void
  refreshSignal?: number
  text: string
  setText: (text: string) => void
  tag: string
  setTag: (tag: string) => void
  online: boolean
  vpsUp: boolean | null
  onTagsChange?: (tags: [string, number][]) => void
  isRecording?: boolean
  recordingMeetingId?: string | null
}

const Dashboard = memo(function Dashboard({
  onOpen,
  refreshSignal,
  text,
  setText,
  tag,
  setTag,
  online,
  vpsUp,
  onTagsChange,
  isRecording,
  recordingMeetingId
}: DashboardProps) {
  const { showToast, ToastContainer } = useToast()
  
  // User workspace data
  const {
    workspace: userWorkspace,
    hasWorkspace,
    workspaces: userWorkspaces,
    responsibleWorkspaces,
    totalWorkspaces,
    hasMultipleWorkspaces
  } = useUserWorkspace()

  // Dashboard state management
  const {
    // State
    meetings,
    vpsMeetings,
    sendingMeetings,
    loading,
    vpsLoading,
    error,
    vpsError,
    currentPage,
    meetingsPerPage,
    activeTab,
    activeWorkspaceSubTab,
    contextMenu,
    
    // Actions
    setCurrentPage,
    setActiveTab,
    setActiveWorkspaceSubTab,
    refresh,
    refreshVpsMeetings,
    syncMeeting: syncMeetingAction,
    handleContextMenu,
    closeContextMenu,
    handleRenameMeeting,
    handleDeleteAudio,
    handleDeleteMeeting
  } = useDashboardState(text, tag, online, vpsUp)

  // Handle refresh signal from parent
  React.useEffect(() => {
    if (typeof refreshSignal !== 'undefined') {
      console.log('🔄 Dashboard refresh triggered by signal:', refreshSignal)
      refresh()
      setCurrentPage(1)
    }
  }, [refreshSignal, refresh, setCurrentPage])

  // Enhanced sync with toast notifications
  const handleSync = async (meetingId: string) => {
    const result = await syncMeetingAction(meetingId, (progress: any) => {
      console.log(`📊 Dashboard Sync Progress for ${meetingId}: ${progress.progress}% - ${progress.message}`)
      showToast(`🔄 ${progress.progress}% - ${progress.message}`, 'info')
    })

    if (result.success) {
      showToast(result.message, 'success')
    } else {
      showToast(`Failed to sync meeting: ${result.message}`, 'error')
    }
  }

  // Enhanced context menu actions with toast notifications
  const handleContextMenuAction = async (action: string, meetingId: string) => {
    let result: { success: boolean; message: string } = { success: false, message: '' }

    switch (action) {
      case 'rename':
        result = await handleRenameMeeting(meetingId)
        break
      case 'deleteAudio':
        result = await handleDeleteAudio(meetingId)
        break
      case 'deleteMeeting':
        result = await handleDeleteMeeting(meetingId)
        break
      default:
        return
    }

    if (result.success && result.message) {
      showToast(result.message, 'success')
    } else if (!result.success && result.message) {
      showToast(result.message, 'error')
    }
  }

  // Get available tags from meetings for parent component
  const tags = React.useMemo(() => {
    const all: Record<string, number> = {}
    meetings.forEach(m => m.tags?.forEach((t: string) => (all[t] = (all[t] || 0) + 1)))
    return Object.entries(all).sort((a, b) => b[1] - a[1])
  }, [meetings])

  // Notify parent component when tags change
  React.useEffect(() => {
    if (onTagsChange) {
      onTagsChange(tags)
    }
  }, [tags, onTagsChange])

  // Tab configuration
  const tabs = [
    { id: 'local', label: '📁 Personal', icon: '🏠' },
    ...(hasWorkspace ? [{
      id: 'workspace',
      label: hasMultipleWorkspaces
        ? `🏢 Workspaces (${totalWorkspaces})`
        : `🏢 ${userWorkspace?.name || 'Workspace'}`,
      icon: '🏢'
    }] : []),
    { id: 'vps', label: '☁️ VPS Meetings', icon: '🌐' },
    { id: 'llama', label: '🤖 Ask AI Assistant', icon: '💬' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'local':
        return (
          <LocalMeetingsTab
            meetings={meetings}
            loading={loading}
            error={error}
            text={text}
            tag={tag}
            onOpen={onOpen}
            onSync={handleSync}
            onContextMenu={handleContextMenu}
            sendingMeetings={sendingMeetings}
            isRecording={isRecording}
            recordingMeetingId={recordingMeetingId}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            meetingsPerPage={meetingsPerPage}
          />
        )

      case 'vps':
        return (
          <VpsMeetingsTab
            vpsMeetings={vpsMeetings}
            vpsLoading={vpsLoading}
            vpsError={vpsError}
            vpsUp={vpsUp}
            online={online}
            onOpen={onOpen}
            onContextMenu={handleContextMenu}
            onRefreshVpsMeetings={refreshVpsMeetings}
          />
        )

      case 'workspace':
        return (
          <WorkspaceMeetingsTab
            meetings={meetings}
            loading={loading}
            hasWorkspace={hasWorkspace}
            hasMultipleWorkspaces={hasMultipleWorkspaces}
            userWorkspace={userWorkspace}
            userWorkspaces={userWorkspaces}
            responsibleWorkspaces={responsibleWorkspaces}
            totalWorkspaces={totalWorkspaces}
            activeWorkspaceSubTab={activeWorkspaceSubTab}
            setActiveWorkspaceSubTab={setActiveWorkspaceSubTab}
            onOpen={onOpen}
            onContextMenu={handleContextMenu}
          />
        )

      case 'llama':
        return (
          <Suspense fallback={
            <LoadingProgress
              message="Loading AI Assistant..."
              type="default"
            />
          }>
            <AskLlama online={online} vpsUp={vpsUp} />
          </Suspense>
        )

      default:
        return null
    }
  }

  return (
    <div>
      {/* Toast Container */}
      <ToastContainer />

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', marginBottom: '8px' }}>⚠️</div>
          <div style={{ color: '#dc2626', fontWeight: '600' }}>
            {error}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '24px',
        backgroundColor: 'white',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              flex: 1,
              padding: '16px 24px',
              backgroundColor: activeTab === tab.id ? '#3b82f6' : '#f8fafc',
              color: activeTab === tab.id ? 'white' : '#64748b',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRight: '1px solid #e2e8f0'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#e2e8f0'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#f8fafc'
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Personalized Greeting */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        marginBottom: '24px',
        textAlign: 'center',
        fontSize: '14px',
        color: '#475569',
        fontWeight: '500'
      }}>
        👋 Hello <strong style={{ color: '#3b82f6' }}>{getComputerUsername()}</strong>, we are ready to prepare the meeting notes for you in a secure and private way
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {renderTabContent()}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          meetingId={contextMenu.meetingId}
          meetingTitle={contextMenu.meetingTitle}
          onClose={closeContextMenu}
          onRename={(id) => handleContextMenuAction('rename', id)}
          onDeleteAudio={(id) => handleContextMenuAction('deleteAudio', id)}
          onDeleteMeeting={(id) => handleContextMenuAction('deleteMeeting', id)}
        />
      )}
    </div>
  )
})

export default Dashboard
