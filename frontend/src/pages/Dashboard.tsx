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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const meetingsPerPage = 3

  // Handle window resize for responsive design
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    return tags
  }, [meetings])

  // Notify parent component about tag changes (separate from useMemo to avoid render-time state updates)
  React.useEffect(() => {
    if (onTagsChange) {
      onTagsChange(availableTags)
    }
  }, [availableTags, onTagsChange])

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
      maxWidth: isMobile ? '100%' : '1200px', 
      margin: '0 auto',
      padding: isMobile ? '0 8px' : '0 20px'
    }}>


      {/* Recording Status */}
      {isRecording && recordingMeetingId && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '12px',
          padding: isMobile ? '12px' : '16px',
          marginBottom: isMobile ? '16px' : '24px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: isMobile ? '14px' : '16px',
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
            fontSize: isMobile ? '12px' : '14px', 
            color: '#6b7280', 
            margin: '8px 0 0 0',
            wordBreak: 'break-all'
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
