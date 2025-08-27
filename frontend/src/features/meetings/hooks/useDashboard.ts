import { useState, useEffect, useCallback } from 'react'
import { 
  listMeetings, 
  syncMeeting, 
  deleteMeetingLocally, 
  deleteAudioChunksLocally 
} from '../../../services'
import { useToast } from '../../../components/common'
import { useDebounce } from '../../../hooks/useDebounce'
import { useMeetings, useVpsHealth } from '../../../stores/apiStateManager'

export function useDashboard(refreshSignal?: number) {
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingMeetings, setSendingMeetings] = useState<Set<string>>(new Set())
  const { showToast } = useToast()

  // VPS data from centralized state
  const vpsMeetingsState = useMeetings()
  const vpsHealthState = useVpsHealth()
  const vpsUp = vpsHealthState.status === 'ok'

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await listMeetings()
      setMeetings(result)
    } catch (err) {
      console.error('Failed to load meetings:', err)
      setError('Failed to load meetings')
      showToast('Failed to load meetings', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const handleSync = useCallback(async (meetingId: string) => {
    setSendingMeetings(prev => new Set(prev).add(meetingId))
    
    try {
      await syncMeeting(meetingId)
      showToast('Meeting processed successfully', 'success')
      await loadMeetings() // Reload meetings to get updated status
    } catch (err) {
      console.error('Failed to process meeting:', err)
      showToast('Failed to process meeting', 'error')
    } finally {
      setSendingMeetings(prev => {
        const newSet = new Set(prev)
        newSet.delete(meetingId)
        return newSet
      })
    }
  }, [loadMeetings, showToast])

  const handleDelete = useCallback(async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) {
      return
    }

    try {
      await deleteMeetingLocally(meetingId)
      await deleteAudioChunksLocally(meetingId)
      await loadMeetings() // Reload to update the list
      showToast('Meeting deleted successfully', 'success')
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      showToast('Failed to delete meeting', 'error')
    }
  }, [loadMeetings, showToast])

  // Load meetings on mount and when refresh signal changes
  useEffect(() => {
    loadMeetings()
  }, [loadMeetings, refreshSignal])

  return {
    // Local meetings data
    meetings,
    loading,
    error,
    sendingMeetings,
    
    // VPS meetings data (with safety checks)
    vpsMeetings: vpsMeetingsState.data || [],
    vpsLoading: vpsMeetingsState.loading || false,
    vpsError: vpsMeetingsState.error || null,
    vpsUp,
    
    // Actions
    handleSync,
    handleDelete,
    loadMeetings
  }
}
