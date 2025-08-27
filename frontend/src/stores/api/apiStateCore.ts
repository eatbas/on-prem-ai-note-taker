// Core API State Manager class

import { getMeetings, getVpsHealth, getQueueStats, getProgressStats } from '../../services'
import { electronApiOptimizer, isElectronApp, getOptimalPollingIntervals } from '../electronApiOptimizer'
import { CrossPlatformTimerId } from '../../types'
import { 
  ApiState, 
  ApiDataType, 
  StateUpdateCallback, 
  PollingConfig,
  ApiStateManagerOptions,
  DEFAULT_POLLING_CONFIGS,
  DEFAULT_INITIAL_STATE
} from './apiStateTypes'

export class ApiStateManager {
  private state: ApiState
  private subscribers = new Set<StateUpdateCallback>()
  private timers = new Map<ApiDataType, CrossPlatformTimerId>()
  private retryAttempts = new Map<ApiDataType, number>()
  private pollingConfigs: Record<ApiDataType, PollingConfig>
  private isPollingEnabled: boolean

  constructor(options: ApiStateManagerOptions = {}) {
    this.state = { ...DEFAULT_INITIAL_STATE }
    this.pollingConfigs = { ...DEFAULT_POLLING_CONFIGS, ...options.pollingConfigs }
    this.isPollingEnabled = options.enablePolling ?? true

    console.log('🚀 ApiStateManager initialized with configs:', this.pollingConfigs)
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
    const dataTypes: ApiDataType[] = ['vpsHealth', 'meetings', 'queueStats', 'progressStats']
    await Promise.all(dataTypes.map(type => this.pollData(type)))
  }

  /**
   * Update state and notify subscribers
   */
  updateState(update: Partial<ApiState>): void {
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
   * Check if we should poll (online and polling enabled)
   */
  shouldPoll(): boolean {
    const result = this.state.online && this.isPollingEnabled
    console.log(`🤔 shouldPoll(): online=${this.state.online}, enabled=${this.isPollingEnabled}, result=${result}`)
    return result
  }

  /**
   * Poll specific data type
   */
  async pollData(type: ApiDataType): Promise<void> {
    if (!this.shouldPoll()) return

    try {
      let result: any = null

      switch (type) {
        case 'vpsHealth':
          console.log('🏥 Polling VPS health...')
          result = await getVpsHealth()
          console.log('✅ VPS health result:', result)
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

      // Reset retry attempts on success
      this.retryAttempts.set(type, 0)

      // Note: Electron optimizations are handled via lifecycle events
      // No need for explicit success/failure recording here

    } catch (error: any) {
      console.error(`❌ Error polling ${type}:`, error)
      
      const retries = this.retryAttempts.get(type) || 0
      this.retryAttempts.set(type, retries + 1)

      // Update state with error
      const errorUpdate: Partial<ApiState> = {}
      if (type === 'vpsHealth') {
        console.log('❌ VPS health check failed:', error.message)
        errorUpdate.vpsHealth = {
          status: 'error',
          data: null,
          lastUpdated: Date.now(),
          error: error.message
        }
      } else {
        ;(errorUpdate as any)[type] = {
          ...this.state[type],
          error: error.message,
          lastUpdated: Date.now()
        }
      }

      this.updateState(errorUpdate)

      // Note: Electron error handling is managed via lifecycle events
      // No need for explicit failure recording here
    }
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

  /**
   * Pause all polling
   */
  pausePolling(): void {
    this.timers.forEach((timer, type) => {
      clearTimeout(timer)
      console.log(`⏸️ Paused polling for ${type}`)
    })
    this.timers.clear()
  }
}
