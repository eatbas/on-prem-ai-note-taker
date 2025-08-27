import React, { useEffect, useState, useRef } from 'react'
import { db, syncMeeting, updateMeetingTags, assembleFilesByAudioType, deleteMeetingLocally, deleteAudioChunksLocally } from '../../../services'
import { useToast, TagsManager } from '../../../components/common'
import { formatDuration } from '../../../utils'
import config from '../../../utils/envLoader'

// Import our new components
import MeetingHeader from '../components/MeetingHeader'
import MeetingSummary from '../components/MeetingSummary'
import MeetingTranscript from '../components/MeetingTranscript'
import MeetingAudio from '../components/MeetingAudio'

export default function MeetingView({ meetingId, onBack }: { meetingId: string; onBack?: () => void }) {
  // Core state
  const [meeting, setMeeting] = useState<any>(null)
  const [note, setNote] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'audio' | 'speakers'>('summary')
  const [isRemote, setIsRemote] = useState(false)
  const { showToast, ToastContainer } = useToast()

  // Audio state
  const [audioUrls, setAudioUrls] = useState<{
    microphone: string | null
    system: string | null
  }>({ microphone: null, system: null })
  const [activeAudioType, setActiveAudioType] = useState<'microphone' | 'system'>('microphone')
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [dualAudioInfo, setDualAudioInfo] = useState<any>(null)
  
  const micAudioRef = useRef<HTMLAudioElement>(null)
  const systemAudioRef = useRef<HTMLAudioElement>(null)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteOperation, setDeleteOperation] = useState<'audio' | 'meeting' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load meeting data
  useEffect(() => {
    loadMeeting()
  }, [meetingId])

  // Load audio data when audio tab is active
  useEffect(() => {
    if (activeTab === 'audio' && meeting && !dualAudioInfo) {
      loadAudioData()
    }
  }, [activeTab, meeting])

  const loadMeeting = async () => {
    try {
      const meetingData = await db.meetings.get(meetingId)
      if (meetingData) {
        setMeeting(meetingData)
        setIsRemote(meetingData.status !== 'local')
        
        // Load note
        const noteData = await db.notes.where('meetingId').equals(meetingId).first()
        if (noteData) {
          setNote(noteData)
        }
      }
    } catch (error) {
      console.error('Failed to load meeting:', error)
      showToast('Failed to load meeting', 'error')
    }
  }

  const loadAudioData = async () => {
    setIsLoadingAudio(true)
    try {
      const chunks = await db.chunks.where('meetingId').equals(meetingId).toArray()
      
      if (chunks.length > 0) {
        // Group chunks by audio type
        const micChunks = chunks.filter(c => c.audioType === 'microphone')
        const systemChunks = chunks.filter(c => c.audioType === 'system' || c.audioType === 'speaker')
        
        // Calculate statistics
        const micSize = micChunks.reduce((sum, c) => sum + c.blob.size, 0)
        const systemSize = systemChunks.reduce((sum, c) => sum + c.blob.size, 0)
        
        setDualAudioInfo({
          microphone: {
            chunks: micChunks.length,
            size: micSize,
            hasData: micSize > 0,
            whisperBenefit: micSize > 0 ? 'Available' : 'No data'
          },
          system: {
            chunks: systemChunks.length,
            size: systemSize,
            hasData: systemSize > 0,
            whisperBenefit: systemSize > 0 ? 'Available' : 'No data'
          },
          hasSeparateStreams: micChunks.length > 0 && systemChunks.length > 0
        })

        // Create audio URLs for playback
        if (micChunks.length > 0) {
          const micBlobs = micChunks.sort((a, b) => a.index - b.index).map(c => c.blob)
          const micFile = new File(micBlobs, 'microphone.webm', { type: 'audio/webm' })
          const micUrl = URL.createObjectURL(micFile)
          setAudioUrls(prev => ({ ...prev, microphone: micUrl }))
        }

        if (systemChunks.length > 0) {
          const systemBlobs = systemChunks.sort((a, b) => a.index - b.index).map(c => c.blob)
          const systemFile = new File(systemBlobs, 'system.webm', { type: 'audio/webm' })
          const systemUrl = URL.createObjectURL(systemFile)
          setAudioUrls(prev => ({ ...prev, system: systemUrl }))
        }
      }
    } catch (error) {
      console.error('Failed to load audio data:', error)
      showToast('Failed to load audio data', 'error')
    } finally {
      setIsLoadingAudio(false)
    }
  }

  const handleTitleChange = async (newTitle: string) => {
    if (!meeting || !newTitle.trim()) return
    
    try {
      await db.meetings.update(meetingId, { title: newTitle.trim() })
      setMeeting((prev: any) => ({ ...prev, title: newTitle.trim() }))
      showToast('Title updated', 'success')
    } catch (error) {
      console.error('Failed to update title:', error)
      showToast('Failed to update title', 'error')
    }
  }

  const handleSync = async () => {
    if (!meeting) return
    
    setSending(true)
    try {
      // 🚨 IMPORTANT: Immediately update meeting status to 'queued' to prevent duplicate processing
      // and show processing status in UI
      await db.meetings.update(meetingId, { 
        status: 'queued', 
        updatedAt: Date.now() 
      })
      
      // Force reload to show the updated status immediately
      await loadMeeting()
      
      // Now start the actual sync process
      await syncMeeting(meetingId)
      showToast('Meeting processed successfully', 'success')
      
      // Reload again to get the final status
      await loadMeeting()
    } catch (error) {
      console.error('Failed to process meeting:', error)
      showToast('Failed to process meeting', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleTagsUpdate = async (tags: string[]) => {
    if (!meeting) return
    
    try {
      await updateMeetingTags(meetingId, tags)
      setMeeting((prev: any) => ({ ...prev, tags }))
      showToast('Tags updated', 'success')
    } catch (error) {
      console.error('Failed to update tags:', error)
      showToast('Failed to update tags', 'error')
    }
  }

  const handleDelete = () => {
    setDeleteOperation('meeting')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteOperation) return
    
    setIsDeleting(true)
    try {
      if (deleteOperation === 'meeting') {
        await deleteMeetingLocally(meetingId)
        await deleteAudioChunksLocally(meetingId)
        showToast('Meeting deleted', 'success')
        if (onBack) onBack()
      } else if (deleteOperation === 'audio') {
        await deleteAudioChunksLocally(meetingId)
        showToast('Audio chunks deleted', 'success')
        setDualAudioInfo(null)
        setAudioUrls({ microphone: null, system: null })
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      showToast('Failed to delete', 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setDeleteOperation(null)
    }
  }

  const handleDownload = async (type: 'microphone' | 'system') => {
    try {
      const files = await assembleFilesByAudioType(meetingId)
      const file = type === 'microphone' ? files.microphone : files.speaker || files.system
      
      if (file) {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        showToast('Download started', 'success')
      } else {
        showToast('No audio file available', 'error')
      }
    } catch (error) {
      console.error('Failed to download:', error)
      showToast('Failed to download audio', 'error')
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return <MeetingSummary note={note} meeting={meeting} search={search} />
      case 'transcript':
        return <MeetingTranscript note={note} search={search} />
      case 'audio':
        return (
          <MeetingAudio
            audioUrls={audioUrls}
            activeAudioType={activeAudioType}
            setActiveAudioType={setActiveAudioType}
            micAudioRef={micAudioRef}
            systemAudioRef={systemAudioRef}
            dualAudioInfo={dualAudioInfo}
            isLoadingAudio={isLoadingAudio}
            onDownload={handleDownload}
          />
        )
      case 'speakers':
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <p>Speaker management coming soon...</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <MeetingHeader
        meeting={meeting}
        onBack={onBack}
        onTitleChange={handleTitleChange}
        onSync={handleSync}
        sending={sending}
        isRemote={isRemote}
        onDelete={handleDelete}
        search={search}
        onSearchChange={setSearch}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {renderTabContent()}
      </div>

      {/* Tags - positioned after meeting details */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '20px auto', 
        padding: '0 24px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ padding: '20px' }}>
          <TagsManager
            meetingId={meeting?.id}
            currentTags={meeting?.tags || []}
            onTagsUpdate={handleTagsUpdate}
            online={true}
            vpsUp={true}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '16px' }}>Confirm Delete</h3>
            <p style={{ marginBottom: '24px', color: '#6b7280' }}>
              Are you sure you want to delete this {deleteOperation}? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  )
}
