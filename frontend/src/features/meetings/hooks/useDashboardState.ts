import type React from 'react'
import { useState, useCallback, useEffect } from 'react'
import { 
  listMeetings, 
  getMeetings, 
  syncMeeting as syncMeetingService, 
  updateMeeting, 
  deleteMeetingLocally, 
  deleteAudioChunksLocally, 
  deleteMeeting, 
  db,
  upsertVpsMeetings,
  retryFetchAndCacheMeetings,
  fillMissingMeetingDetails,
  enqueueOutbox
} from '../../../services'

export interface DashboardState {
  // Meetings data
  meetings: any[]
  vpsMeetings: any[]
  sendingMeetings: Set<string>
  
  // Loading states
  loading: boolean
  vpsLoading: boolean
  
  // Error states
  error: string | null
  vpsError: string | null
  
  // Pagination
  currentPage: number
  meetingsPerPage: number
  
  // Active tab
  activeTab: 'local' | 'llama' | 'workspace' | 'vps'
  activeWorkspaceSubTab: 'all' | number
  
  // Context menu
  contextMenu: {
    visible: boolean
    x: number
    y: number
    meetingId: string
    meetingTitle: string
  } | null
}

export function useDashboardState(
  text: string,
  tag: string,
  online: boolean,
  vpsUp: boolean | null
) {
  // Core state
  const [meetings, setMeetings] = useState<any[]>([])
  const [vpsMeetings, setVpsMeetings] = useState<any[]>([])
  const [sendingMeetings, setSendingMeetings] = useState<Set<string>>(new Set())
  
  // Loading states
  const [loading, setLoading] = useState(false)
  const [vpsLoading, setVpsLoading] = useState(false)
  
  // Error states
  const [error, setError] = useState<string | null>(null)
  const [vpsError, setVpsError] = useState<string | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const meetingsPerPage = 3
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'local' | 'llama' | 'workspace' | 'vps'>('local')
  const [activeWorkspaceSubTab, setActiveWorkspaceSubTab] = useState<'all' | number>('all')
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    meetingId: string
    meetingTitle: string
  } | null>(null)

  // Offline-first refresh meetings
  const refresh = useCallback(async () => {
    console.log('🔄 Dashboard refresh started (offline-first)')
    setLoading(true)
    setError(null)
    
    try {
      // ALWAYS load local meetings first for instant UI
      const localMeetings = await listMeetings({ text, tag, excludeRecordingInProgress: false })
      console.log('📁 Loaded local meetings:', localMeetings.length)
      setMeetings(localMeetings)

      if (online) {
        try {
          console.log('🌐 Attempting to fetch and cache VPS meetings...')
          const backendMeetings = await getMeetings()

          // Upsert everything into local DB for full offline cache
          await upsertVpsMeetings(backendMeetings)

          // Re-read from local DB (now includes server-only meetings)
          const allLocalMeetings = await listMeetings({ text, tag, excludeRecordingInProgress: false })
          console.log('🔄 Local meetings after VPS upsert:', allLocalMeetings.length)
          setMeetings(allLocalMeetings)

          setError(null)
          console.log('✅ Successfully cached VPS meetings')
        } catch (backendErr) {
          console.error('❌ VPS fetch failed:', backendErr)
          setError(`VPS connection failed: ${backendErr instanceof Error ? backendErr.message : 'Unknown error'}. Working offline with cached data.`)
        }
      } else {
        console.log('📱 Offline mode - showing cached data')
      }
    } catch (err) {
      console.error('❌ Failed to load meetings:', err)
      setError(`Failed to load meetings: ${err instanceof Error ? err.message : 'Unknown error'}`)
      try {
        setMeetings(await listMeetings({ text, tag, excludeRecordingInProgress: false }))
      } catch {
        setMeetings([])
      }
    } finally {
      setLoading(false)
      console.log('✅ Dashboard refresh completed')
    }
  }, [text, tag, online])

  // Refresh VPS meetings
  const refreshVpsMeetings = useCallback(async () => {
    if (!online || !vpsUp) return
    
    setVpsLoading(true)
    setVpsError(null)
    try {
      const vpsMeetingsData = await getMeetings()
      setVpsMeetings(vpsMeetingsData)
    } catch (err) {
      console.error('Failed to load VPS meetings:', err)
      setVpsError(`Failed to load VPS meetings: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setVpsLoading(false)
    }
  }, [online, vpsUp])

  // Sync meeting
  const syncMeeting = useCallback(async (meetingId: string, onProgress?: (progress: any) => void) => {
    try {
      setError(null)
      // Add loading state for this specific meeting
      setSendingMeetings(prev => new Set(prev).add(meetingId))
      
      // Update meeting status to 'queued' to prevent duplicate processing
      await db.meetings.update(meetingId, { 
        status: 'queued', 
        updatedAt: Date.now() 
      })
      
      // Force refresh the UI to show the updated status immediately
      await refresh()
      
      // Use async sync with progress tracking
      await syncMeetingService(meetingId, onProgress)
      
      // Refresh again to get the final status
      await refresh()
      
      return { success: true, message: 'Meeting sent successfully! 🎉' }
      
    } catch (err) {
      console.error('Sync failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to send meeting: ${errorMessage}`)
      
      // Force refresh to show error status
      await refresh()
      
      return { success: false, message: errorMessage }
      
    } finally {
      // Remove loading state
      setSendingMeetings(prev => {
        const newSet = new Set(prev)
        newSet.delete(meetingId)
        return newSet
      })
    }
  }, [refresh])

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, meetingId: string, meetingTitle: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      meetingId,
      meetingTitle
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Offline-first context menu actions
  const handleRenameMeeting = useCallback(async (meetingId: string): Promise<{ success: boolean; message: string }> => {
    const meeting = meetings.find(m => m.id === meetingId)
    if (!meeting) {
      closeContextMenu()
      return { success: false, message: 'Meeting not found' }
    }
    
    const newTitle = window.prompt('Enter new meeting title:', meeting.title)
    if (newTitle && newTitle.trim() && newTitle.trim() !== meeting.title) {
      try {
        // Always update local DB first (optimistic update)
        await db.meetings.update(meetingId, { title: newTitle.trim(), updatedAt: Date.now() })
        
        if (online && vpsUp) {
          // Try to update VPS immediately
          try {
            await updateMeeting(meetingId, newTitle.trim())
            console.log('✅ Successfully updated meeting title on VPS')
          } catch (vpsErr) {
            console.warn('VPS update failed, queuing for later:', vpsErr)
            await enqueueOutbox('rename_meeting', { meetingId, title: newTitle.trim() })
          }
        } else {
          // Queue for sync when online
          await enqueueOutbox('rename_meeting', { meetingId, title: newTitle.trim() })
          console.log('📤 Queued meeting rename for sync when online')
        }
        
        refresh()
        closeContextMenu()
        return { success: true, message: online && vpsUp ? 'Meeting renamed! ✏️' : 'Meeting renamed! Will sync when online. ✏️📤' }
      } catch (err) {
        console.error('Failed to rename meeting:', err)
        closeContextMenu()
        return { success: false, message: 'Failed to rename meeting. Please try again.' }
      }
    }
    closeContextMenu()
    return { success: false, message: '' }
  }, [meetings, refresh, closeContextMenu, online, vpsUp])

  const handleDeleteAudio = useCallback(async (meetingId: string): Promise<{ success: boolean; message: string }> => {
    // Note: Should use ConfirmationModal instead of browser confirm
    closeContextMenu()

    try {
      await deleteAudioChunksLocally(meetingId)
      refresh() // Refresh the list
      closeContextMenu()
      return { success: true, message: 'Audio deleted successfully! 🗑️' }
    } catch (err) {
      console.error('Failed to delete audio:', err)
      closeContextMenu()
      return { success: false, message: 'Failed to delete audio. Please try again.' }
    }
  }, [refresh, closeContextMenu])

  const handleDeleteMeeting = useCallback(async (meetingId: string): Promise<{ success: boolean; message: string }> => {
    const meeting = meetings.find(m => m.id === meetingId)
    if (!meeting) {
      closeContextMenu()
      return { success: false, message: 'Meeting not found' }
    }

    // Note: Should use ConfirmationModal instead of browser confirm
    closeContextMenu()

    try {
      // Always delete locally first
      await deleteMeetingLocally(meetingId)
      
      // Handle VPS deletion based on meeting status and connectivity
      if (meeting.status === 'synced' || meeting.status === 'sent') {
        if (online && vpsUp) {
          try {
            await deleteMeeting(meetingId)
            console.log('✅ Successfully deleted meeting from VPS')
          } catch (vpsErr) {
            console.warn('VPS deletion failed, queuing for later:', vpsErr)
            await enqueueOutbox('delete_meeting', { meetingId })
          }
        } else {
          // Queue for sync when online
          await enqueueOutbox('delete_meeting', { meetingId })
          console.log('📤 Queued meeting deletion for VPS sync when online')
        }
      }
      
      refresh()
      closeContextMenu()
      return { 
        success: true, 
        message: (online && vpsUp) ? 'Meeting deleted completely! 🗑️' : 'Meeting deleted locally! VPS deletion queued. 🗑️📤' 
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      closeContextMenu()
      return { success: false, message: 'Failed to delete meeting. Please try again.' }
    }
  }, [meetings, refresh, closeContextMenu, online, vpsUp])

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [text, tag])

  // Auto-refresh on dependencies change
  useEffect(() => {
    refresh()
  }, [text, tag, online])

  // Background detail filling when VPS is available
  useEffect(() => {
    if (!online || !vpsUp) return
    
    const controller = new AbortController()
    
    ;(async () => {
      try {
        console.log('🔍 Starting background detail filling...')
        // First ensure we have the latest meetings list
        await retryFetchAndCacheMeetings({ attempts: 1, signal: controller.signal })
        
        // Then fill missing details
        await fillMissingMeetingDetails({ 
          limit: 3, 
          signal: controller.signal,
          onProgress: (done, total) => {
            console.log(`📊 Detail filling progress: ${done}/${total}`)
          }
        })
        
        // Refresh UI with new details
        await refresh()
        console.log('✅ Background detail filling completed')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('🛑 Background detail filling aborted')
        } else {
          console.warn('⚠️ Background detail filling failed:', error)
        }
      }
    })()
    
    return () => controller.abort()
  }, [online, vpsUp, refresh])

  // Background retry when VPS comes back online
  useEffect(() => {
    if (!online) return
    if (vpsUp === false) {
      console.log('📡 VPS is down, starting background retry...')
      const controller = new AbortController()
      
      ;(async () => {
        try {
          await retryFetchAndCacheMeetings({ 
            attempts: 6, 
            baseDelayMs: 3000, 
            signal: controller.signal,
            onAttempt: (attempt, error) => {
              console.log(`🔄 Retry attempt ${attempt}/6 failed:`, error)
            }
          })
          await refresh()
          console.log('✅ VPS reconnection successful')
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            console.warn('⚠️ Background retry exhausted:', error)
          }
        }
      })()
      
      return () => controller.abort()
    }
  }, [online, vpsUp, refresh])

  // Refresh VPS meetings when VPS tab is selected
  useEffect(() => {
    if (activeTab === 'vps' && vpsUp && online) {
      refreshVpsMeetings()
    }
  }, [activeTab, vpsUp, online, refreshVpsMeetings])

  return {
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
    syncMeeting,
    handleContextMenu,
    closeContextMenu,
    handleRenameMeeting,
    handleDeleteAudio,
    handleDeleteMeeting
  }
}
