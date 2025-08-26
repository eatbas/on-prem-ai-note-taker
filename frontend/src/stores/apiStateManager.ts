import { getMeetings, getVpsHealth, getQueueStats, getProgressStats } from '../services'
import type { QueueStats, ProgressStats } from '../services'
import { electronApiOptimizer, isElectronApp, getOptimalPollingIntervals } from './electronApiOptimizer'

// Types for our centralized state
export interface ApiState {
  vpsHealth: {
    status: 'ok' | 'error' | 'checking'
    data: any | null
    lastUpdated: number
    error?: string
  }
  meetings: {
    data: any[]
    lastUpdated: number
    error?: string
    loading: boolean
  }
  queueStats: {
    data: QueueStats | null
    lastUpdated: number
    error?: string
  }
  progressStats: {
    data: ProgressStats | null
    lastUpdated: number
    error?: string
  }
  online: boolean
  isWindowFocused: boolean
}

type ApiDataType = keyof Omit<ApiState, 'online' | 'isWindowFocused'>
type StateUpdateCallback = (state: ApiState) => void

/**
 * Centralized API State Manager for Electron App
 * - Single source of truth for all API data
 * - Smart polling with backoff strategies
 * - Event-driven updates to components
 * - Electron-optimized (window focus, IPC, native timers)
 */
class ApiStateManager {
  private state: ApiState = {
    vpsHealth: { status: 'checking', data: null, lastUpdated: 0 },
    meetings: { data: [], lastUpdated: 0, loading: false },
    queueStats: { data: null, lastUpdated: 0 },
    progressStats: { data: null, lastUpdated: 0 },
    online: navigator.onLine,
    isWindowFocused: !document.hidden
  }

  private subscribers: Set<StateUpdateCallback> = new Set()
  private timers: Map<ApiDataType, number> = new Map()
  private retryAttempts: Map<ApiDataType, number> = new Map()
  
  // Polling configurations for different data types
  private readonly pollingConfig = {
    vpsHealth: { 
      interval: 30000,     // 30 seconds
      maxRetries: 5,
      backoffMultiplier: 2,
      maxInterval: 300000  // 5 minutes max
    },
    meetings: { 
      interval: 60000,     // 1 minute (less frequent since it's not critical)
      maxRetries: 3,
      backoffMultiplier: 1.5,
      maxInterval: 180000  // 3 minutes max
    },
    queueStats: { 
      interval: 20000,     // 20 seconds
      maxRetries: 3,
      backoffMultiplier: 1.5,
      maxInterval: 120000  // 2 minutes max
    },
    progressStats: { 
      interval: 30000,     // 30 seconds
      maxRetries: 3,
      backoffMultiplier: 1.5,
      maxInterval: 120000  // 2 minutes max
    }
  }

  constructor() {
    this.setupElectronOptimizations()
    this.setupNetworkListeners()
    this.startInitialPolling()
    
    console.log(`🚀 ApiStateManager initialized for ${isElectronApp ? 'Electron' : 'browser'} environment`)
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateUpdateCallback): () => void {
    this.subscribers.add(callback)
    // Immediately provide current state
    callback(this.state)
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Get current state (synchronous)
   */
  getState(): ApiState {
    return { ...this.state }
  }

  /**
   * Get specific data with freshness check
   */
  getData<T extends ApiDataType>(type: T, maxAge = 60000): ApiState[T] {
    const data = this.state[type]
    const isStale = Date.now() - data.lastUpdated > maxAge
    
    if (isStale && this.shouldPoll()) {
      // Trigger a refresh but return current data immediately
      this.pollData(type)
    }
    
    return data
  }

  /**
   * Force refresh specific data type
   */
  async refreshData(type: ApiDataType): Promise<void> {
    await this.pollData(type)
  }

  /**
   * Force refresh all data
   */
  async refreshAll(): Promise<void> {
    const promises = Object.keys(this.pollingConfig).map(type => 
      this.pollData(type as ApiDataType)
    )
    await Promise.allSettled(promises)
  }

  /**
   * Setup Electron-specific optimizations
   */
  private setupElectronOptimizations(): void {
    // Listen for window focus/blur events (works for both browser and Electron)
    window.addEventListener('focus', () => {
      console.log('🎯 Window focused - resuming active polling')
      this.updateState({ isWindowFocused: true })
      this.resumePolling()
    })

    window.addEventListener('blur', () => {
      console.log('🌙 Window blurred - reducing polling frequency')
      this.updateState({ isWindowFocused: false })
      this.adjustPollingForBackground()
    })

    // Electron-specific optimizations
    if (isElectronApp) {
      electronApiOptimizer.setupAppLifecycleListeners({
        onSuspend: () => {
          console.log('💤 App suspended - pausing all polling')
          this.pausePolling()
        },
        
        onResume: () => {
          console.log('⚡ App resumed - resuming polling')
          this.resumePolling()
        },
        
        onSleep: () => {
          console.log('😴 System sleep - pausing polling')
          this.pausePolling()
        },
        
        onWake: () => {
          console.log('🌅 System wake - refreshing all data')
          this.refreshAll()
        },
        
        onFocus: () => {
          console.log('🎯 Electron window focused')
          this.updateState({ isWindowFocused: true })
          this.resumePolling()
        },
        
        onBlur: () => {
          console.log('🌙 Electron window blurred')
          this.updateState({ isWindowFocused: false })
          this.adjustPollingForBackground()
        }
      })

      // Enable memory optimizations for Electron
      electronApiOptimizer.optimizeMemoryUsage()
    }
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Network online - resuming polling')
      this.updateState({ online: true })
      this.refreshAll() // Immediate refresh when coming online
    })

    window.addEventListener('offline', () => {
      console.log('📴 Network offline - pausing polling')
      this.updateState({ online: false })
      this.pausePolling()
    })
  }

  /**
   * Start initial polling for all data types
   */
  private startInitialPolling(): void {
    if (!this.shouldPoll()) return

    Object.keys(this.pollingConfig).forEach(type => {
      this.startPolling(type as ApiDataType)
    })
  }

  /**
   * Start polling for specific data type
   */
  private startPolling(type: ApiDataType): void {
    if (!this.shouldPoll()) return

    // Clear existing timer
    const existingTimer = this.timers.get(type)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Initial poll
    this.pollData(type)

    // Setup recurring polling with Electron-optimized intervals
    const config = this.pollingConfig[type]
    const retries = this.retryAttempts.get(type) || 0
    const baseInterval = Math.min(
      config.interval * Math.pow(config.backoffMultiplier, retries),
      config.maxInterval
    )

    // Get Electron-optimized intervals
    const intervals = getOptimalPollingIntervals(baseInterval)
    const currentInterval = this.state.isWindowFocused ? 
      intervals.active : 
      intervals.background

    console.log(`⏱️ Setting ${type} polling interval: ${currentInterval}ms (${this.state.isWindowFocused ? 'active' : 'background'})`)

    const timer = setTimeout(() => {
      this.startPolling(type) // Recursive polling
    }, currentInterval)

    this.timers.set(type, timer)
  }

  /**
   * Poll specific data type
   */
  private async pollData(type: ApiDataType): Promise<void> {
    if (!this.shouldPoll()) return

    try {
      let result: any = null

      switch (type) {
        case 'vpsHealth':
          result = await getVpsHealth()
          this.updateState({
            vpsHealth: {
              status: 'ok',
              data: result,
              lastUpdated: Date.now()
            }
          })
          break

        case 'meetings':
          this.updateState({
            meetings: { ...this.state.meetings, loading: true }
          })
          result = await getMeetings()
          this.updateState({
            meetings: {
              data: result,
              lastUpdated: Date.now(),
              loading: false
            }
          })
          break

        case 'queueStats':
          result = await getQueueStats()
          this.updateState({
            queueStats: {
              data: result,
              lastUpdated: Date.now()
            }
          })
          break

        case 'progressStats':
          result = await getProgressStats()
          this.updateState({
            progressStats: {
              data: result,
              lastUpdated: Date.now()
            }
          })
          break
      }

      // Reset retry count on success
      this.retryAttempts.set(type, 0)
      console.log(`✅ ${type} updated successfully`)

    } catch (error) {
      const retries = this.retryAttempts.get(type) || 0
      const config = this.pollingConfig[type]
      
      if (retries < config.maxRetries) {
        this.retryAttempts.set(type, retries + 1)
        console.warn(`⚠️ ${type} failed (attempt ${retries + 1}/${config.maxRetries}):`, error)
      } else {
        console.error(`❌ ${type} failed after ${config.maxRetries} attempts:`, error)
        this.retryAttempts.set(type, 0) // Reset for next cycle
      }

      // Update state with error
      const errorUpdate: Partial<ApiState> = {}
      if (type === 'vpsHealth') {
        errorUpdate.vpsHealth = {
          status: 'error',
          data: null,
          lastUpdated: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      } else {
        (errorUpdate as any)[type] = {
          ...this.state[type],
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      this.updateState(errorUpdate)
    }
  }

  /**
   * Check if we should poll based on current conditions
   */
  private shouldPoll(): boolean {
    // In Electron, we have better lifecycle management, so we can be more aggressive
    if (isElectronApp) {
      return this.state.online // Electron handles focus/background better
    }
    
    // Browser fallback - more conservative
    return this.state.online && this.state.isWindowFocused
  }

  /**
   * Pause all polling
   */
  private pausePolling(): void {
    this.timers.forEach((timer, type) => {
      clearTimeout(timer)
      this.timers.delete(type)
      console.log(`⏸️ Paused polling for ${type}`)
    })
  }

  /**
   * Resume polling for all data types
   */
  private resumePolling(): void {
    if (!this.shouldPoll()) return
    
    this.startInitialPolling()
  }

  /**
   * Adjust polling frequency for background mode
   */
  private adjustPollingForBackground(): void {
    // In background, only poll VPS health at reduced frequency
    this.pausePolling()
    
    if (this.state.online) {
      const timer = setTimeout(() => {
        this.pollData('vpsHealth')
        this.adjustPollingForBackground() // Continue background polling
      }, 120000) // 2 minutes for background polling
      
      this.timers.set('vpsHealth', timer)
    }
  }

  /**
   * Update state and notify subscribers
   */
  private updateState(update: Partial<ApiState>): void {
    this.state = { ...this.state, ...update }
    this.notifySubscribers()
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state)
      } catch (error) {
        console.error('Error in state subscriber:', error)
      }
    })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.pausePolling()
    this.subscribers.clear()
    
    // Clean up Electron optimizations
    if (isElectronApp) {
      electronApiOptimizer.cleanup()
    }
    
    console.log('🧹 ApiStateManager destroyed')
  }
}

// Create singleton instance
export const apiStateManager = new ApiStateManager()

// Export hooks for easy component integration
export function useApiState(): ApiState {
  const [state, setState] = React.useState<ApiState>(apiStateManager.getState())
  
  React.useEffect(() => {
    const unsubscribe = apiStateManager.subscribe(setState)
    return unsubscribe
  }, [])
  
  return state
}

export function useVpsHealth() {
  const state = useApiState()
  return {
    ...state.vpsHealth,
    refresh: () => apiStateManager.refreshData('vpsHealth')
  }
}

export function useMeetings() {
  const state = useApiState()
  return {
    ...state.meetings,
    refresh: () => apiStateManager.refreshData('meetings')
  }
}

export function useQueueStats() {
  const state = useApiState()
  return {
    ...state.queueStats,
    refresh: () => apiStateManager.refreshData('queueStats')
  }
}

export function useProgressStats() {
  const state = useApiState()
  return {
    ...state.progressStats,
    refresh: () => apiStateManager.refreshData('progressStats')
  }
}

// For React import
import React from 'react'
