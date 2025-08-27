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


