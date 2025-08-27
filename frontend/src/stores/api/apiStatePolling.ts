// Polling management for API State Manager

import { isElectronApp, getOptimalPollingIntervals } from '../electronApiOptimizer'
import { CrossPlatformTimerId } from '../../types'
import { ApiDataType, PollingConfig } from './apiStateTypes'
import { ApiStateManager } from './apiStateCore'

export class ApiPollingManager {
  private timers = new Map<ApiDataType, CrossPlatformTimerId>()
  private retryAttempts = new Map<ApiDataType, number>()
  private pollingConfigs: Record<ApiDataType, PollingConfig>
  private stateManager: ApiStateManager

  constructor(stateManager: ApiStateManager, pollingConfigs: Record<ApiDataType, PollingConfig>) {
    this.stateManager = stateManager
    this.pollingConfigs = pollingConfigs
  }

  /**
   * Start polling for all data types
   */
  startPolling(): void {
    if (!this.stateManager.shouldPoll()) return

    const dataTypes: ApiDataType[] = ['vpsHealth', 'meetings', 'queueStats', 'progressStats']
    dataTypes.forEach(type => {
      this.startPollingForType(type)
    })

    console.log('🔄 Started polling for all data types')
  }

  /**
   * Start polling for specific data type
   */
  startPollingForType(type: ApiDataType): void {
    if (!this.stateManager.shouldPoll()) return

    // Clear existing timer
    const existingTimer = this.timers.get(type)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const config = this.pollingConfigs[type]
    const retries = this.retryAttempts.get(type) || 0
    const baseInterval = Math.min(
      config.interval * Math.pow(config.backoffMultiplier, retries),
      config.maxInterval
    )

    // Get Electron-optimized intervals
    const intervals = getOptimalPollingIntervals(baseInterval)
    const state = this.stateManager.getState()
    const currentInterval = state.isWindowFocused ? 
      intervals.active : 
      intervals.background

    console.log(`⏱️ Setting ${type} polling interval: ${currentInterval}ms (${state.isWindowFocused ? 'active' : 'background'})`)

    const timer = setTimeout(() => {
      this.startPollingForType(type) // Recursive polling
    }, currentInterval)

    this.timers.set(type, timer)
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

  /**
   * Resume polling with current configs
   */
  resumePolling(): void {
    console.log('▶️ Resuming polling...')
    this.startPolling()
  }

  /**
   * Adjust polling for window focus state
   */
  adjustPollingForFocus(isWindowFocused: boolean): void {
    console.log(`🎯 Adjusting polling for window ${isWindowFocused ? 'focused' : 'blurred'}`)
    
    if (isWindowFocused) {
      // Resume normal polling when window becomes focused
      this.resumePolling()
    } else {
      // Reduce polling when window loses focus
      this.adjustPollingForBackground()
    }
  }

  /**
   * Adjust polling for background operation
   */
  adjustPollingForBackground(): void {
    this.pausePolling()
    
    const state = this.stateManager.getState()
    if (state.online) {
      const timer = setTimeout(() => {
        this.stateManager.pollData('vpsHealth')
        this.adjustPollingForBackground() // Continue background polling
      }, 120000) // 2 minutes for background polling
      
      this.timers.set('vpsHealth', timer)
    }
  }

  /**
   * Reset retry attempts for a data type
   */
  resetRetries(type: ApiDataType): void {
    this.retryAttempts.set(type, 0)
  }

  /**
   * Increment retry attempts for a data type
   */
  incrementRetries(type: ApiDataType): number {
    const current = this.retryAttempts.get(type) || 0
    const updated = current + 1
    this.retryAttempts.set(type, updated)
    return updated
  }

  /**
   * Get current retry count for a data type
   */
  getRetryCount(type: ApiDataType): number {
    return this.retryAttempts.get(type) || 0
  }

  /**
   * Cleanup polling manager
   */
  destroy(): void {
    this.pausePolling()
    this.retryAttempts.clear()
  }
}
