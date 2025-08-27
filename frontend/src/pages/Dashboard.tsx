import React, { useState } from 'react'
import AskLlama from './AskLlama'
import AudioRecordingTester from '../components/recording/AudioRecordingTester'
import { useToast } from '../components/common'

// Import the new components
import MeetingList from '../features/meetings/components/MeetingList'
import DashboardTabs from '../features/meetings/components/DashboardTabs'
import SearchAndFilters from '../features/meetings/components/SearchAndFilters'
import { useDashboard } from '../features/meetings/hooks/useDashboard'

interface DashboardProps {
  onOpen: (meetingId: string) => void
  refreshSignal?: number
  text: string
  setText: (text: string) => void
  tag: string
  setTag: (tag: string) => void
  online: boolean
  onTagsChange?: (tags: [string, number][]) => void
  isRecording?: boolean
  recordingMeetingId?: string | null
}

export default function Dashboard({ 
  onOpen, 
  refreshSignal,
  text,
  setText,
  tag,
  setTag,
  online,
  onTagsChange,
  isRecording,
  recordingMeetingId
}: DashboardProps) {
  // State
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'local' | 'vps' | 'llama' | 'audio-test'>('local')
  const meetingsPerPage = 3

  // Custom hook for dashboard logic
  const {
    meetings,
    loading,
    error,
    sendingMeetings,
    vpsMeetings,
    vpsLoading,
    vpsError,
    vpsUp,
    handleSync,
    handleDelete
  } = useDashboard(refreshSignal)

  const { ToastContainer } = useToast()

  // Calculate available tags from meetings
  const availableTags: [string, number][] = React.useMemo(() => {
    const tagCounts = new Map<string, number>()
    meetings.forEach(meeting => {
      meeting.tags?.forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })
    
    const tags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])
    
    // Notify parent component about tag changes
    if (onTagsChange) {
      onTagsChange(tags)
    }
    
    return tags
  }, [meetings, onTagsChange])

  const handleClearFilters = () => {
    setText('')
    setTag('')
    setCurrentPage(1)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'local':
        return (
          <MeetingList
            meetings={meetings}
            onOpen={onOpen}
            sendingMeetings={sendingMeetings}
            onSync={handleSync}
            onDelete={handleDelete}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            meetingsPerPage={meetingsPerPage}
            text={text}
            tag={tag}
            loading={loading}
            error={error}
          />
        )

      case 'vps':
        return (
          <MeetingList
            meetings={vpsMeetings}
            onOpen={onOpen}
            sendingMeetings={new Set()}
            onSync={() => {}} // VPS meetings don't need sync
            onDelete={() => {}} // VPS meetings don't support delete from here
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            meetingsPerPage={meetingsPerPage}
            text={text}
            tag={tag}
            loading={vpsLoading}
            error={vpsError}
          />
        )

      case 'llama':
        return <AskLlama />

      case 'audio-test':
        return <AudioRecordingTester />

      default:
        return null
    }
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto',
      padding: '0 20px'
    }}>
      {/* Dashboard Header */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '32px' 
      }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Meeting Dashboard
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#6b7280', 
          margin: 0 
        }}>
          Manage your AI-powered meeting notes and recordings
        </p>
      </div>

      {/* Recording Status */}
      {isRecording && recordingMeetingId && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#dc2626'
          }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                animation: 'pulse 1.5s infinite'
              }}
            />
            🎙️ Recording in progress...
          </div>
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            margin: '8px 0 0 0' 
          }}>
            Meeting ID: {recordingMeetingId}
          </p>
        </div>
      )}

      {/* Tabs */}
      <DashboardTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        localMeetingsCount={meetings.length}
        vpsMeetingsCount={vpsMeetings.length}
        vpsUp={vpsUp}
      />

      {/* Search and Filters - only show for meeting tabs */}
      {(activeTab === 'local' || activeTab === 'vps') && (
        <SearchAndFilters
          text={text}
          setText={setText}
          tag={tag}
          setTag={setTag}
          availableTags={availableTags}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Tab Content */}
      {renderTabContent()}

      {/* Connection Status */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '16px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: online ? '#22c55e' : '#ef4444'
            }} />
            Internet: {online ? 'Connected' : 'Offline'}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: vpsUp ? '#22c55e' : '#ef4444'
            }} />
            AI Server: {vpsUp ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  )
}
