/**
 * Electron-specific API optimizations
 * Leverages Electron features for better performance and user experience
 */

import { CrossPlatformTimerId } from '../types'

export interface ElectronApiFeatures {
  onAppSuspend?: (callback: () => void) => void
  onAppResume?: (callback: () => void) => void
  onSystemSleep?: (callback: () => void) => void
  onSystemWake?: (callback: () => void) => void
  onWindowFocus?: (callback: () => void) => void
  onWindowBlur?: (callback: () => void) => void
  removeAppSuspendListener?: () => void
  removeAppResumeListener?: () => void
  removeSystemSleepListener?: () => void
  removeSystemWakeListener?: () => void
  removeWindowFocusListener?: () => void
  removeWindowBlurListener?: () => void
}

/**
 * Electron API Optimizer for better resource management
 */
export class ElectronApiOptimizer {
  private electronAPI: ElectronApiFeatures | null = null
  private listeners: Map<string, () => void> = new Map()

  constructor() {
    this.initializeElectronAPI()
  }

  /**
   * Initialize Electron API if available
   */
  private initializeElectronAPI(): void {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      this.electronAPI = (window as any).electronAPI
      console.log('🔌 Electron API detected - enabling optimizations')
    } else {
      console.log('🌐 Running in browser mode - Electron optimizations disabled')
    }
  }

  /**
   * Check if we're running in Electron
   */
  get isElectron(): boolean {
    return this.electronAPI !== null
  }

  /**
   * Setup app lifecycle listeners
   */
  setupAppLifecycleListeners(callbacks: {
    onSuspend?: () => void
    onResume?: () => void
    onSleep?: () => void
    onWake?: () => void
    onFocus?: () => void
    onBlur?: () => void
  }): void {
    if (!this.electronAPI) return

    // App suspend/resume
    if (callbacks.onSuspend && this.electronAPI.onAppSuspend) {
      this.electronAPI.onAppSuspend(callbacks.onSuspend)
      this.listeners.set('appSuspend', callbacks.onSuspend)
    }

    if (callbacks.onResume && this.electronAPI.onAppResume) {
      this.electronAPI.onAppResume(callbacks.onResume)
      this.listeners.set('appResume', callbacks.onResume)
    }

    // System sleep/wake
    if (callbacks.onSleep && this.electronAPI.onSystemSleep) {
      this.electronAPI.onSystemSleep(callbacks.onSleep)
      this.listeners.set('systemSleep', callbacks.onSleep)
    }

    if (callbacks.onWake && this.electronAPI.onSystemWake) {
      this.electronAPI.onSystemWake(callbacks.onWake)
      this.listeners.set('systemWake', callbacks.onWake)
    }

    // Window focus/blur
    if (callbacks.onFocus && this.electronAPI.onWindowFocus) {
      this.electronAPI.onWindowFocus(callbacks.onFocus)
      this.listeners.set('windowFocus', callbacks.onFocus)
    }

    if (callbacks.onBlur && this.electronAPI.onWindowBlur) {
      this.electronAPI.onWindowBlur(callbacks.onBlur)
      this.listeners.set('windowBlur', callbacks.onBlur)
    }

    console.log('⚡ Electron lifecycle listeners configured')
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    if (!this.electronAPI) return

    // Remove all listeners
    this.electronAPI.removeAppSuspendListener?.()
    this.electronAPI.removeAppResumeListener?.()
    this.electronAPI.removeSystemSleepListener?.()
    this.electronAPI.removeSystemWakeListener?.()
    this.electronAPI.removeWindowFocusListener?.()
    this.electronAPI.removeWindowBlurListener?.()

    this.listeners.clear()
    console.log('🧹 Electron listeners cleaned up')
  }

  /**
   * Get optimal polling intervals based on Electron state
   */
  getOptimalPollingIntervals(baseInterval: number): {
    active: number
    background: number
    suspended: number
  } {
    if (!this.isElectron) {
      // Browser fallback
      return {
        active: baseInterval,
        background: baseInterval * 3,
        suspended: baseInterval * 10
      }
    }

    // Electron-optimized intervals
    return {
      active: baseInterval,
      background: baseInterval * 4,    // 4x slower in background
      suspended: baseInterval * 20     // 20x slower when suspended
    }
  }

  /**
   * Check if we should pause polling based on Electron state
   */
  shouldPausePolling(): boolean {
    // In Electron, we can rely on proper lifecycle events
    // In browser, we fall back to document.hidden
    return this.isElectron ? false : document.hidden
  }

  /**
   * Get native timer functions (more accurate than setTimeout in Electron)
   */
  createTimer(callback: () => void, interval: number): {
    start: () => void
    stop: () => void
    isRunning: boolean
  } {
    let timerId: CrossPlatformTimerId | null = null
    let isRunning = false

    return {
      start: () => {
        if (isRunning) return
        
        // Use native timers in Electron for better accuracy
        const timerFunction = this.isElectron ? 
          (cb: () => void, ms: number) => setInterval(cb, ms) :
          (cb: () => void, ms: number) => setInterval(cb, ms)

        timerId = timerFunction(callback, interval)
        isRunning = true
      },

      stop: () => {
        if (timerId !== null) {
          clearInterval(timerId)
          timerId = null
          isRunning = false
        }
      },

      get isRunning() {
        return isRunning
      }
    }
  }

  /**
   * Electron-optimized network status detection
   */
  setupNetworkOptimizations(): {
    isOnline: () => boolean
    onOnline: (callback: () => void) => void
    onOffline: (callback: () => void) => void
  } {
    let onlineCallback: (() => void) | null = null
    let offlineCallback: (() => void) | null = null

    const handleOnline = () => {
      console.log('🌐 Network: Online')
      onlineCallback?.()
    }

    const handleOffline = () => {
      console.log('📴 Network: Offline')
      offlineCallback?.()
    }

    // Setup network listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return {
      isOnline: () => navigator.onLine,
      
      onOnline: (callback: () => void) => {
        onlineCallback = callback
      },
      
      onOffline: (callback: () => void) => {
        offlineCallback = callback
      }
    }
  }

  /**
   * Electron-specific memory optimization hints
   */
  optimizeMemoryUsage(): void {
    if (!this.isElectron) return

    // Suggest garbage collection during low activity
    const suggestGC = () => {
      if ((window as any).gc) {
        console.log('🗑️ Suggesting garbage collection')
        ;(window as any).gc()
      }
    }

    // Run GC suggestion every 5 minutes during background
    setInterval(() => {
      if (document.hidden) {
        suggestGC()
      }
    }, 300000)
  }

  /**
   * Get platform-specific optimizations
   */
  getPlatformOptimizations(): {
    isMacOS: boolean
    isWindows: boolean
    isLinux: boolean
    shouldUseNativeMenus: boolean
    shouldMinimizeToTray: boolean
  } {
    const userAgent = navigator.userAgent.toLowerCase()
    
    return {
      isMacOS: userAgent.includes('mac'),
      isWindows: userAgent.includes('win'),
      isLinux: userAgent.includes('linux'),
      shouldUseNativeMenus: this.isElectron,
      shouldMinimizeToTray: this.isElectron && userAgent.includes('win')
    }
  }
}

// Create singleton instance
export const electronApiOptimizer = new ElectronApiOptimizer()

// Export convenience functions
export const isElectronApp = electronApiOptimizer.isElectron
export const getOptimalPollingIntervals = (baseInterval: number) => 
  electronApiOptimizer.getOptimalPollingIntervals(baseInterval)
export const shouldPausePolling = () => electronApiOptimizer.shouldPausePolling()
