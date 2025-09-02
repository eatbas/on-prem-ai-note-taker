import { invoke } from '../lib/tauri'
import { listen } from '@tauri-apps/api/event'

export interface IPCMessage {
  event: string
  data: any
}

export interface FileInfo {
  name: string
  path: string
  size: number
  is_dir: boolean
  modified: string
}

export class TauriIPCService {
  private listeners: Map<string, ((data: any) => void)[]> = new Map()

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Listen for all events from Tauri
    listen('tauri://event', (event: any) => {
      const eventName = event.event
      const eventData = event.payload

      // Notify all listeners for this event
      const eventListeners = this.listeners.get(eventName)
      if (eventListeners) {
        eventListeners.forEach(listener => listener(eventData))
      }
    })
  }

  // Send message to Tauri backend
  async sendMessage(message: IPCMessage): Promise<void> {
    try {
      await invoke('send_ipc_message', { message })
    } catch (error) {
      console.error('Failed to send IPC message:', error)
      throw error
    }
  }

  // Broadcast message to all windows
  async broadcastMessage(message: IPCMessage): Promise<void> {
    try {
      await invoke('broadcast_ipc_message', { message })
    } catch (error) {
      console.error('Failed to broadcast IPC message:', error)
      throw error
    }
  }

  // Listen for events from Tauri
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    this.listeners.get(event)!.push(callback)

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        const index = eventListeners.indexOf(callback)
        if (index > -1) {
          eventListeners.splice(index, 1)
        }
      }
    }
  }

  // Show system notification
  async showNotification(title: string, body: string): Promise<void> {
    try {
      await invoke('show_notification', { title, body })
    } catch (error) {
      console.error('Failed to show notification:', error)
      // Fallback to browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    }
  }

  // File system operations
  async saveRecording(data: Uint8Array, filename: string): Promise<string> {
    try {
      return await invoke('save_recording_file', { data: Array.from(data), filename })
    } catch (error) {
      console.error('Failed to save recording:', error)
      throw error
    }
  }

  async listRecordings(): Promise<FileInfo[]> {
    try {
      return await invoke('list_recording_files')
    } catch (error) {
      console.error('Failed to list recordings:', error)
      return []
    }
  }

  // Window management
  async showFloatingRecorder(): Promise<void> {
    try {
      await invoke('show_floating_recorder')
    } catch (error) {
      console.error('Failed to show floating recorder:', error)
    }
  }

  async hideFloatingRecorder(): Promise<void> {
    try {
      await invoke('hide_floating_recorder')
    } catch (error) {
      console.error('Failed to hide floating recorder:', error)
    }
  }

  // Recording controls
  async startRecording(): Promise<void> {
    try {
      await invoke('start_recording')
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  async stopRecording(): Promise<void> {
    try {
      await invoke('stop_recording')
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }
}

// Singleton instance
export const tauriIPC = new TauriIPCService()
