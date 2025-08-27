// Event handling for API State Manager

import { isElectronApp } from '../electronApiOptimizer'
import { ApiStateManager } from './apiStateCore'
import { ApiPollingManager } from './apiStatePolling'

export class ApiEventManager {
  private stateManager: ApiStateManager
  private pollingManager: ApiPollingManager
  private isInitialized = false

  constructor(stateManager: ApiStateManager, pollingManager: ApiPollingManager) {
    this.stateManager = stateManager
    this.pollingManager = pollingManager
  }

  /**
   * Initialize event listeners
   */
  initialize(): void {
    if (this.isInitialized) return

    this.setupOnlineOfflineListeners()
    this.setupWindowFocusListeners()
    this.setupElectronListeners()

    this.isInitialized = true
    console.log('📡 API Event Manager initialized')
  }

  /**
   * Set up online/offline event listeners
   */
  private setupOnlineOfflineListeners(): void {
    const handleOnline = () => {
      console.log('🌐 Connection restored')
      this.stateManager.updateState({ online: true })
      this.pollingManager.resumePolling()
    }

    const handleOffline = () => {
      console.log('📴 Connection lost')
      this.stateManager.updateState({ online: false })
      this.pollingManager.pausePolling()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  /**
   * Set up window focus/blur event listeners
   */
  private setupWindowFocusListeners(): void {
    const handleFocus = () => {
      console.log('🎯 Window focused')
      this.stateManager.updateState({ isWindowFocused: true })
      this.pollingManager.adjustPollingForFocus(true)
    }

    const handleBlur = () => {
      console.log('😴 Window blurred')
      this.stateManager.updateState({ isWindowFocused: false })
      this.pollingManager.adjustPollingForFocus(false)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
  }

  /**
   * Set up Electron-specific event listeners
   */
  private setupElectronListeners(): void {
    if (!isElectronApp) return

    // TODO: Implement Electron window state change listeners
    // These would require updates to the Electron main process
    console.log('🖼️ Electron event listeners ready (implementation pending)')
    
    // For now, we'll rely on standard browser focus/blur events
    // which work in both browser and Electron environments
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    // Remove event listeners
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    window.removeEventListener('focus', this.handleFocus)
    window.removeEventListener('blur', this.handleBlur)

    this.isInitialized = false
    console.log('🧹 API Event Manager destroyed')
  }

  // Keep references to bound functions for cleanup
  private handleOnline = () => {
    console.log('🌐 Connection restored')
    this.stateManager.updateState({ online: true })
    this.pollingManager.resumePolling()
  }

  private handleOffline = () => {
    console.log('📴 Connection lost')
    this.stateManager.updateState({ online: false })
    this.pollingManager.pausePolling()
  }

  private handleFocus = () => {
    console.log('🎯 Window focused')
    this.stateManager.updateState({ isWindowFocused: true })
    this.pollingManager.adjustPollingForFocus(true)
  }

  private handleBlur = () => {
    console.log('😴 Window blurred')
    this.stateManager.updateState({ isWindowFocused: false })
    this.pollingManager.adjustPollingForFocus(false)
  }
}
