// Combined API State Manager with all functionality

import { ApiStateManager } from './apiStateCore'
import { ApiPollingManager } from './apiStatePolling'
import { ApiEventManager } from './apiStateEvents'
import { 
  ApiStateManagerOptions, 
  DEFAULT_POLLING_CONFIGS,
  DEFAULT_INITIAL_STATE 
} from './apiStateTypes'

/**
 * Complete API State Manager with polling and event handling
 */
export class CombinedApiStateManager extends ApiStateManager {
  private pollingManager: ApiPollingManager
  private eventManager: ApiEventManager

  constructor(options: ApiStateManagerOptions = {}) {
    super(options)
    
    this.pollingManager = new ApiPollingManager(this, this.getPollingConfigs())
    this.eventManager = new ApiEventManager(this, this.pollingManager)
  }

  /**
   * Get polling configurations (exposed for polling manager)
   */
  private getPollingConfigs() {
    return { ...DEFAULT_POLLING_CONFIGS }
  }

  /**
   * Initialize the complete API state management system
   */
  initialize(): void {
    console.log('🚀 Initializing Combined API State Manager...')
    console.log('🌐 Current state:', { online: this.getState().online })
    
    // Initialize event listeners
    this.eventManager.initialize()
    
    // Start initial polling if online
    if (this.shouldPoll()) {
      console.log('✅ shouldPoll() passed, starting polling...')
      this.pollingManager.startPolling()
    } else {
      console.log('❌ shouldPoll() failed, not starting polling')
    }
    
    console.log('✅ Combined API State Manager initialized')
  }

  /**
   * Start polling for all data types
   */
  startPolling(): void {
    this.pollingManager.startPolling()
  }

  /**
   * Pause all polling
   */
  pausePolling(): void {
    this.pollingManager.pausePolling()
  }

  /**
   * Resume polling
   */
  resumePolling(): void {
    this.pollingManager.resumePolling()
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.pollingManager.destroy()
    this.eventManager.destroy()
    super.destroy()
    
    console.log('🧹 Combined API State Manager destroyed')
  }
}

// Create singleton instance
const apiStateManager = new CombinedApiStateManager({
  enablePolling: true
})

// Initialize when first imported
console.log('📦 API State Manager module loaded, calling initialize()...')
apiStateManager.initialize()

// Export singleton and types
export { apiStateManager }
export type { ApiState, ApiDataType, StateUpdateCallback } from './apiStateTypes'
export { DEFAULT_POLLING_CONFIGS, DEFAULT_INITIAL_STATE } from './apiStateTypes'

// Export React hooks
export { 
  useVpsHealth, 
  useMeetings, 
  useQueueStats, 
  useProgressStats, 
  useOnlineStatus 
} from './apiStateHooks'
