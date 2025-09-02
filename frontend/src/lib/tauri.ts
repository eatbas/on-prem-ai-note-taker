// Tauri detection and platform utilities

/**
 * Check if we're running in Tauri
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined
}

/**
 * Check if we're running in Electron
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && (window as any).electronAPI !== undefined
}

/**
 * Check if we're running in a regular web browser
 */
export const isWeb = (): boolean => {
  return !isTauri() && !isElectron()
}

/**
 * Get the current platform type
 */
export const getPlatform = (): 'tauri' | 'electron' | 'web' => {
  if (isTauri()) return 'tauri'
  if (isElectron()) return 'electron'
  return 'web'
}

/**
 * Safe Tauri API imports - only import when needed
 */
export const getTauriAPI = async () => {
  if (!isTauri()) {
    throw new Error('Tauri not available')
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    
    return { invoke, listen }
  } catch (error) {
    console.error('Failed to import Tauri APIs:', error)
    // Fallback for development
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return {
        invoke: (window as any).__TAURI__.core.invoke,
        listen: (window as any).__TAURI__.event.listen
      }
    }
    throw error
  }
}

/**
 * Safely invoke Tauri commands
 */
export const safeInvoke = async (cmd: string, args?: any): Promise<any> => {
  if (!isTauri()) {
    throw new Error('Tauri not available')
  }

  try {
    // Try modern API first
    const { invoke } = await getTauriAPI()
    return await invoke(cmd, args)
  } catch (error) {
    // Fallback to window API
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return await (window as any).__TAURI__.core.invoke(cmd, args)
    }
    console.error(`Failed to invoke Tauri command '${cmd}':`, error)
    throw error
  }
}

/**
 * Get platform-specific capabilities
 */
export const getPlatformCapabilities = () => {
  const platform = getPlatform()
  
  return {
    platform,
    hasNativeSystemAudio: platform === 'tauri',
    hasElectronSystemAudio: platform === 'electron',
    hasWebAudio: true, // All platforms support basic web audio
    hasFileSystem: platform !== 'web',
    hasNotifications: platform !== 'web',
    hasSystemTray: platform !== 'web',
    hasFloatingWindows: platform !== 'web'
  }
}

/**
 * Log platform information
 */
export const logPlatformInfo = () => {
  const capabilities = getPlatformCapabilities()
  
  console.log('🖥️  Platform Information:')
  console.log('   Platform:', capabilities.platform)
  console.log('   Native System Audio:', capabilities.hasNativeSystemAudio ? '✅' : '❌')
  console.log('   Electron System Audio:', capabilities.hasElectronSystemAudio ? '✅' : '❌')
  console.log('   Web Audio API:', capabilities.hasWebAudio ? '✅' : '❌')
  console.log('   File System Access:', capabilities.hasFileSystem ? '✅' : '❌')
  console.log('   System Notifications:', capabilities.hasNotifications ? '✅' : '❌')
  console.log('   System Tray:', capabilities.hasSystemTray ? '✅' : '❌')
  console.log('   Floating Windows:', capabilities.hasFloatingWindows ? '✅' : '❌')
  
  return capabilities
}