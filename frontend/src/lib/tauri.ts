// Tauri API utilities - Desktop App Only

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI__?: {
      core: { invoke: Function }
      event: { listen: Function }
    }
  }
}

/**
 * Check if we're running in Tauri
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined
}

/**
 * Get Tauri API functions
 * This app is TAURI-ONLY, no web/electron support
 */
export const getTauriAPI = async () => {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    
    return { invoke, listen }
  } catch (error) {
    console.error('Failed to import Tauri APIs:', error)
    
    // Fallback to window.__TAURI__ (injected by Tauri runtime)
    if (typeof window !== 'undefined' && window.__TAURI__) {
      return {
        invoke: window.__TAURI__.core.invoke,
        listen: window.__TAURI__.event.listen
      }
    }
    
    throw new Error(`Tauri API not available: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Invoke Tauri commands safely
 */
export const invoke = async (cmd: string, args?: any): Promise<any> => {
  try {
    const { invoke: tauriInvoke } = await getTauriAPI()
    return await tauriInvoke(cmd, args)
  } catch (error) {
    console.error(`Failed to invoke command '${cmd}':`, error)
    throw error
  }
}

/**
 * Listen to Tauri events
 */
export const listen = async (event: string, handler: (event: any) => void) => {
  try {
    const { listen: tauriListen } = await getTauriAPI()
    return await tauriListen(event, handler)
  } catch (error) {
    console.error(`Failed to listen to event '${event}':`, error)
    throw error
  }
}

/**
 * Log platform information for debugging
 */
export const logPlatformInfo = (): void => {
  console.log('🚀 dgMeets - Tauri Desktop App')
  console.log('Platform: Native Desktop (Tauri)')
  console.log('Environment Variables:', {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    APP_MODE: import.meta.env.VITE_APP_MODE,
    TAURI_BACKEND_URL: import.meta.env.TAURI_BACKEND_URL,
  })
  
  // Check if Tauri APIs are available
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    console.log('✅ Tauri APIs: Available')
  } else {
    console.log('❌ Tauri APIs: Not Available')
  }
}