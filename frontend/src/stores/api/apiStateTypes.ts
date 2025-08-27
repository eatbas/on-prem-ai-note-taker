// Type definitions for API State Manager

import type { QueueStats, ProgressStats } from '../../services'
import { CrossPlatformTimerId } from '../../types'

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

export type ApiDataType = keyof Omit<ApiState, 'online' | 'isWindowFocused'>
export type StateUpdateCallback = (state: ApiState) => void

export interface PollingConfig {
  interval: number
  backoffMultiplier: number
  maxInterval: number
  maxRetries: number
}

export interface ApiStateManagerOptions {
  pollingConfigs?: Record<ApiDataType, PollingConfig>
  enablePolling?: boolean
}

// Default polling configurations
export const DEFAULT_POLLING_CONFIGS: Record<ApiDataType, PollingConfig> = {
  vpsHealth: { 
    interval: 30000, 
    backoffMultiplier: 1.5, 
    maxInterval: 300000, 
    maxRetries: 3 
  },
  meetings: { 
    interval: 10000, 
    backoffMultiplier: 1.2, 
    maxInterval: 60000, 
    maxRetries: 2 
  },
  queueStats: { 
    interval: 5000, 
    backoffMultiplier: 1.1, 
    maxInterval: 30000, 
    maxRetries: 2 
  },
  progressStats: { 
    interval: 8000, 
    backoffMultiplier: 1.2, 
    maxInterval: 45000, 
    maxRetries: 2 
  }
}

// Default initial state
export const DEFAULT_INITIAL_STATE: ApiState = {
  vpsHealth: {
    status: 'checking',
    data: null,
    lastUpdated: 0
  },
  meetings: {
    data: [],
    lastUpdated: 0,
    loading: false
  },
  queueStats: {
    data: null,
    lastUpdated: 0
  },
  progressStats: {
    data: null,
    lastUpdated: 0
  },
  online: navigator.onLine,
  isWindowFocused: document.hasFocus()
}
