// Tauri detection utility
export const isTauri = (): boolean => {
  return window.__TAURI__ !== undefined
}

export const isElectron = (): boolean => {
  return window.electronAPI !== undefined
}

export const getPlatform = (): 'tauri' | 'electron' | 'web' => {
  if (isTauri()) return 'tauri'
  if (isElectron()) return 'electron'
  return 'web'
}

// Tauri API imports (safe)
export const invoke = async (cmd: string, args?: any): Promise<any> => {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
    return tauriInvoke(cmd, args)
  }
  throw new Error('Tauri not available')
}
