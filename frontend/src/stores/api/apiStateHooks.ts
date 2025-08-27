// React hooks for API State Manager

import { useEffect, useState } from 'react'
import { apiStateManager } from './index'
import type { ApiState } from './apiStateTypes'

/**
 * Hook to use VPS health data
 */
export function useVpsHealth() {
  const [vpsHealth, setVpsHealth] = useState(apiStateManager.getState().vpsHealth)

  useEffect(() => {
    const unsubscribe = apiStateManager.subscribe((state: ApiState) => {
      setVpsHealth(state.vpsHealth)
    })
    return unsubscribe
  }, [])

  return vpsHealth
}

/**
 * Hook to use meetings data
 */
export function useMeetings() {
  const [meetings, setMeetings] = useState(apiStateManager.getState().meetings)

  useEffect(() => {
    const unsubscribe = apiStateManager.subscribe((state: ApiState) => {
      setMeetings(state.meetings)
    })
    return unsubscribe
  }, [])

  const refreshMeetings = () => {
    apiStateManager.refreshData('meetings')
  }

  return { 
    ...meetings, 
    refresh: refreshMeetings 
  }
}

/**
 * Hook to use queue stats data
 */
export function useQueueStats() {
  const [queueStats, setQueueStats] = useState(apiStateManager.getState().queueStats)

  useEffect(() => {
    const unsubscribe = apiStateManager.subscribe((state: ApiState) => {
      setQueueStats(state.queueStats)
    })
    return unsubscribe
  }, [])

  const refreshStats = () => {
    apiStateManager.refreshData('queueStats')
  }

  return { 
    ...queueStats, 
    refresh: refreshStats 
  }
}

/**
 * Hook to use progress stats data
 */
export function useProgressStats() {
  const [progressStats, setProgressStats] = useState(apiStateManager.getState().progressStats)

  useEffect(() => {
    const unsubscribe = apiStateManager.subscribe((state: ApiState) => {
      setProgressStats(state.progressStats)
    })
    return unsubscribe
  }, [])

  const refreshStats = () => {
    apiStateManager.refreshData('progressStats')
  }

  return { 
    ...progressStats, 
    refresh: refreshStats 
  }
}

/**
 * Hook to use online status
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(apiStateManager.getState().online)

  useEffect(() => {
    const unsubscribe = apiStateManager.subscribe((state: ApiState) => {
      setOnline(state.online)
    })
    return unsubscribe
  }, [])

  return online
}
