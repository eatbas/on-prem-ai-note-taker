import React, { useEffect, useState, useRef, memo } from 'react'
import { db, syncMeeting, updateMeetingTags, assembleFilesByAudioType, deleteMeetingLocally, deleteAudioChunksLocally } from '../../../services'
import { useToast, TagsManager } from '../../../components/common'
import { LoadingSpinner, ErrorDisplay } from '../components/shared'

// Import meeting view components
import {
  MeetingViewHeader,
  MeetingSummary,
  MeetingTranscript,
  MeetingAudio
} from '../components/meeting-view'
import { MeetingSpeakers } from '../components/speakers'
import DeleteConfirmationModal from '../components/meeting-view/DeleteConfirmationModal'

interface MeetingViewProps {
  meetingId: string
  onBack?: () => void
}

const MeetingView = memo(function MeetingView({ meetingId, onBack }: MeetingViewProps) {
  // Core state
  const [meeting, setMeeting] = useState<any>(null)
  const [note, setNote] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'audio' | 'speakers'>('summary')
  const [isRemote, setIsRemote] = useState(false)
  const { showToast, ToastContainer } = useToast()

  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [audioInfo, setAudioInfo] = useState<any>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)

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
    if (activeTab === 'audio' && meeting && !audioInfo) {
      loadAudioData()
    }
  }, [activeTab, meeting])

  const loadMeeting = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const meetingData = await db.meetings.get(meetingId)
      if (meetingData) {
        setMeeting(meetingData)
        setIsRemote(meetingData.status !== 'local')
        
        // Load note
        const noteData = await db.notes.where('meetingId').equals(meetingId).first()
        if (noteData) {
          setNote(noteData)
        }
      } else {
        setError('Meeting not found')
        showToast('Meeting not found', 'error')
      }
    } catch (error) {
      console.error('Failed to load meeting:', error)
      setError(error instanceof Error ? error.message : 'Failed to load meeting')
      showToast('Failed to load meeting', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAudioData = async () => {
    setIsLoadingAudio(true)
    try {
      const chunks = await db.chunks.where('meetingId').equals(meetingId).toArray()
      
      if (chunks.length > 0) {
        // Handle mixed audio chunks (optimized for Whisper) or fallback to separate streams
        const mixedChunks = chunks.filter(c => c.audioType === 'mixed')
        const micChunks = chunks.filter(c => c.audioType === 'microphone')
        const systemChunks = chunks.filter(c => c.audioType === 'system' || c.audioType === 'speaker')
        
        // Prioritize mixed chunks (best for Whisper), then microphone, then system
        const primaryChunks = mixedChunks.length > 0 ? mixedChunks : 
                             micChunks.length > 0 ? micChunks : systemChunks
        const allChunks = chunks.filter(c => 
          c.audioType === 'mixed' || 
          c.audioType === 'microphone' || 
          c.audioType === 'system' || 
          c.audioType === 'speaker'
        )
        
        if (primaryChunks.length > 0) {
          // Calculate statistics for all chunks combined
          const totalSize = allChunks.reduce((sum, c) => sum + c.blob.size, 0)
          
          setAudioInfo({
            chunks: allChunks.length,
            size: totalSize,
            hasData: totalSize > 0,
            mixedChunks: mixedChunks.length,
            microphoneChunks: micChunks.length,
            systemChunks: systemChunks.length,
            audioType: mixedChunks.length > 0 ? 'mixed' : 
                      micChunks.length > 0 ? 'microphone' : 'system'
          })

          // Use proper audio file assembly for playback
          try {
            console.log(`🎵 Assembling audio file for playback...`)
            if (mixedChunks.length > 0) {
              console.log(`🎵 Using mixed audio (mic+system) - optimal for Whisper (${primaryChunks.length} chunks)`)
            } else if (micChunks.length > 0) {
              console.log(`🎵 Using microphone audio (${primaryChunks.length} chunks)`)
            } else {
              console.log(`🎵 Using system audio (${primaryChunks.length} chunks)`)
            }
            
            // Use the proper file assembly function that handles audio format correctly
            const audioFiles = await assembleFilesByAudioType(meetingId)
            
            // Get the best available audio file for playback
            let audioFile: File | null = null
            if (audioFiles.mixed) {
              audioFile = audioFiles.mixed
              console.log(`🎙️ Using mixed audio file for playback: ${(audioFile.size / 1024).toFixed(2)} KB`)
            } else if (audioFiles.microphone) {
              audioFile = audioFiles.microphone
              console.log(`🎤 Using microphone audio file for playback: ${(audioFile.size / 1024).toFixed(2)} KB`)
            } else if (audioFiles.system || audioFiles.speaker) {
              audioFile = audioFiles.system || audioFiles.speaker!
              console.log(`🔊 Using system audio file for playback: ${(audioFile.size / 1024).toFixed(2)} KB`)
            }
            
            if (audioFile) {
              const url = URL.createObjectURL(audioFile)
              setAudioUrl(url)
              console.log(`✅ Audio file ready for playback: ${audioFile.name}`)
            } else {
              console.error('❌ No valid audio file found for playback')
              showToast('No valid audio file found', 'error')
            }
            
          } catch (audioError) {
            console.error('❌ Failed to assemble audio file:', audioError)
            showToast('Failed to prepare audio for playback', 'error')
            
            // Fallback to simple blob concatenation (may not work well)
            const audioBlobs = primaryChunks.sort((a, b) => a.index - b.index).map(c => c.blob)
            const firstBlob = audioBlobs[0]
            const detectedType = firstBlob.type || 'audio/webm'
            const fileExtension = detectedType.includes('wav') ? 'wav' : 'webm'
            const audioFile = new File(audioBlobs, `audio.${fileExtension}`, { type: detectedType })
            const url = URL.createObjectURL(audioFile)
            setAudioUrl(url)
            console.log(`⚠️ Using fallback audio concatenation`)
          }
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
      // Update meeting status to 'queued' to prevent duplicate processing
      await db.meetings.update(meetingId, { 
        status: 'queued', 
        updatedAt: Date.now() 
      })
      
      // Force reload to show the updated status immediately
      await loadMeeting()
      
      // Use async sync with progress tracking
      await syncMeeting(meetingId, (progress: any) => {
        console.log(`📊 Sync Progress: ${progress.progress}% - ${progress.message}`)
        showToast(`Processing: ${progress.progress}% - ${progress.message}`, 'info')
      })
      
      showToast('Meeting processed successfully', 'success')
      
      // Reload to get the final status
      await loadMeeting()
    } catch (error) {
      console.error('Failed to process meeting:', error)
      
      // Show specific error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to process meeting'
      showToast(errorMessage, 'error')
      
      // Reload to show error status
      await loadMeeting()
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

  const handleDeleteAudio = () => {
    setDeleteOperation('audio')
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
        setAudioInfo(null)
        setAudioUrl(null)
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

  const handleDownload = async () => {
    try {
      const files = await assembleFilesByAudioType(meetingId)
      // Prioritize microphone audio, fallback to system audio
      const file = files.microphone || files.speaker || files.system
      
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
            audioUrl={audioUrl}
            audioRef={audioRef}
            audioInfo={audioInfo}
            isLoadingAudio={isLoadingAudio}
            onDownload={handleDownload}
          />
        )
      case 'speakers':
        return <MeetingSpeakers note={note} meeting={meeting} search={search} />
      default:
        return null
    }
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="large" message="Loading meeting..." />
      </div>
    )
  }

  // Error state
  if (error || !meeting) {
    return (
      <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '400px', padding: '20px' }}>
          <ErrorDisplay
            title="Meeting Not Found"
            message={error || 'The requested meeting could not be found.'}
            onRetry={onBack ? () => onBack() : undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <MeetingViewHeader
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

      {/* Tags Section */}
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
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        deleteOperation={deleteOperation}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ToastContainer />
    </div>
  )
})

export default MeetingView
