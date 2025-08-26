import { useState, useEffect } from 'react'

/**
 * Custom hook to detect if the page/tab is currently visible
 * Useful for pausing polling when user is not actively viewing the page
 * @returns {boolean} - true if page is visible, false if hidden
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}

/**
 * Custom hook to detect if user is actively using the page
 * Combines page visibility with recent user activity
 * @param activityTimeout - milliseconds to consider user inactive (default: 5 minutes)
 * @returns {boolean} - true if user is active and page is visible
 */
export function useUserActivity(activityTimeout: number = 300000): boolean {
  const isVisible = usePageVisibility()
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [isActive, setIsActive] = useState<boolean>(true)

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const updateActivity = () => {
      setLastActivity(Date.now())
      if (!isActive) setIsActive(true)
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    // Check activity periodically
    const activityCheck = setInterval(() => {
      const now = Date.now()
      const timeSinceActivity = now - lastActivity
      setIsActive(timeSinceActivity < activityTimeout)
    }, 60000) // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
      clearInterval(activityCheck)
    }
  }, [lastActivity, activityTimeout, isActive])

  return isVisible && isActive
}
