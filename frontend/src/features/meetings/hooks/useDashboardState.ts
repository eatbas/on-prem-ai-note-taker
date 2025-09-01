import type React from 'react'
import { useState, useCallback, useEffect } from 'react'
import { listMeetings, getMeetings, syncMeeting as syncMeetingService, updateMeeting, deleteMeetingLocally, deleteAudioChunksLocally, deleteMeeting, db } from '../../../services'

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

  // Refresh meetings
  const refresh = useCallback(async () => {
    console.log('🔄 Dashboard refresh started')
    setLoading(true)
    setError(null)
    
    try {
      if (online) {
        // Always load local meetings first
        const localMeetings = await listMeetings({ text, tag, excludeRecordingInProgress: false })
        console.log('📁 Loaded local meetings:', localMeetings.length)
        setMeetings(localMeetings)
        
        // Try to fetch from backend and only enrich local meetings
        try {
          console.log('🌐 Attempting to fetch from VPS backend...')
          const backendMeetings = await getMeetings()
          console.log('☁️ Loaded VPS meetings:', Array.isArray(backendMeetings) ? backendMeetings.length : 'Invalid response')
          
          const byId = new Map<string, any>()
          // Start with local meetings to preserve any unsent ones
          for (const m of localMeetings) byId.set(m.id, m)
          
          // Only merge if we have a valid array
          if (Array.isArray(backendMeetings)) {
            // Overlay with backend data but only for meetings existing locally
            for (const m of backendMeetings as any[]) {
              const existing = byId.get(m.id)
              if (!existing) continue // skip server-only meetings to avoid duplicates
              // Merge backend data with local data, preferring backend for processed content
              byId.set(m.id, { 
                ...existing, 
                ...m, 
                status: existing?.status === 'local' ? existing.status : m.status || 'sent',
                tags: existing?.tags || [],
                title: existing?.title || m.title
              })
            }
          }
          
          const mergedMeetings = Array.from(byId.values()).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
          console.log('🔄 Enriched local meetings with server data:', mergedMeetings.length)
          setMeetings(mergedMeetings)
          
          // Clear any previous errors on success
          setError(null)
          console.log('✅ Successfully loaded VPS meetings without errors')
          
        } catch (backendErr) {
          // Backend failed, but we still have local data
          console.error('❌ Backend fetch failed with error:', backendErr)
          setError(`Backend connection failed: ${backendErr instanceof Error ? backendErr.message : 'Unknown error'}. Showing local meetings only.`)
        }
      } else {
        // Use local data when offline
        console.log('📱 Offline mode - using local data only')
        setMeetings(await listMeetings({ text, tag, excludeRecordingInProgress: false }))
      }
    } catch (err) {
      console.error('❌ Failed to load meetings:', err)
      setError(`Failed to load meetings: ${err instanceof Error ? err.message : 'Unknown error'}`)
      // Try to load any local data as last resort
      try {
        setMeetings(await listMeetings({ text, tag, excludeRecordingInProgress: false }))
      } catch (localErr) {
        console.error('❌ Even local data failed:', localErr)
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

  // Context menu actions
  const handleRenameMeeting = useCallback(async (meetingId: string): Promise<{ success: boolean; message: string }> => {
    const meeting = meetings.find(m => m.id === meetingId)
    if (!meeting) {
      closeContextMenu()
      return { success: false, message: 'Meeting not found' }
    }
    
    const newTitle = window.prompt('Enter new meeting title:', meeting.title)
    if (newTitle && newTitle.trim() && newTitle.trim() !== meeting.title) {
      try {
        await updateMeeting(meetingId, newTitle.trim())
        // Update local database as well
        await db.meetings.update(meetingId, { title: newTitle.trim(), updatedAt: Date.now() })
        refresh() // Refresh the list
        closeContextMenu()
        return { success: true, message: 'Meeting renamed successfully! ✏️' }
      } catch (err) {
        console.error('Failed to rename meeting:', err)
        closeContextMenu()
        return { success: false, message: 'Failed to rename meeting. Please try again.' }
      }
    }
    closeContextMenu()
    return { success: false, message: '' }
  }, [meetings, refresh, closeContextMenu])

  const handleDeleteAudio = useCallback(async (meetingId: string): Promise<{ success: boolean; message: string }> => {
    if (!window.confirm('Are you sure you want to delete the audio for this meeting? The meeting notes, summary, and transcript will be preserved.')) {
      closeContextMenu()
      return { success: false, message: '' }
    }

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

    if (!window.confirm(`Are you sure you want to permanently delete "${meeting.title}"? This will remove all data including audio, transcript, summary, and notes both locally and from the server.`)) {
      closeContextMenu()
      return { success: false, message: '' }
    }

    try {
      // Delete from VPS if the meeting was sent
      if (meeting.status === 'sent') {
        try {
          await deleteMeeting(meetingId)
        } catch (vpsError) {
          console.warn('Failed to delete from VPS, proceeding with local deletion:', vpsError)
        }
      }
      
      // Delete locally
      await deleteMeetingLocally(meetingId)
      refresh() // Refresh the list
      closeContextMenu()
      return { success: true, message: 'Meeting deleted completely! 🗑️' }
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      closeContextMenu()
      return { success: false, message: 'Failed to delete meeting. Please try again.' }
    }
  }, [meetings, refresh, closeContextMenu])

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [text, tag])

  // Auto-refresh on dependencies change
  useEffect(() => {
    refresh()
  }, [text, tag, online])

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
