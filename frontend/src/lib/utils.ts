/**
 * Shared Utility Functions
 * Reusable utility functions used across the application
 */

import { type ClassValue, clsx } from 'clsx'
import { STORAGE_KEYS } from './constants'

// CSS Class Utilities
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ID Generation
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

// Time Formatting
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// File Size Formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

// Audio Level Calculations
export function calculateRMS(audioData: Uint8Array): number {
  const sum = audioData.reduce((acc, value) => acc + value * value, 0)
  return Math.sqrt(sum / audioData.length)
}

export function normalizeAudioLevel(rms: number, maxValue: number = 255): number {
  return Math.min(rms / maxValue, 1)
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 1e-10))
}

// Device Utilities
export function deduplicateDevices(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  const seen = new Map<string, MediaDeviceInfo>()
  
  for (const device of devices) {
    const key = `${device.label}|${device.groupId || ''}`
    if (!seen.has(key)) {
      seen.set(key, device)
    }
  }
  
  return Array.from(seen.values())
}

export function sortDevices(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  return devices.sort((a, b) => {
    // Default devices first
    const aDefault = /default/i.test(a.label) ? -1 : 0
    const bDefault = /default/i.test(b.label) ? -1 : 0
    if (aDefault !== bDefault) return aDefault - bDefault
    
    // Then alphabetically
    return a.label.localeCompare(b.label)
  })
}

export function isDefaultDevice(device: MediaDeviceInfo): boolean {
  return /default/i.test(device.label)
}

// Storage Utilities
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('Failed to save to localStorage:', error)
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error)
  }
}

export function clearStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.warn('Failed to clear localStorage:', error)
  }
}

// Array Utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item)
    groups[key] = groups[key] || []
    groups[key].push(item)
    return groups
  }, {} as Record<K, T[]>)
}

// Async Utilities
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    )
  ])
}

export function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  return fn().catch(error => {
    if (attempts > 1) {
      return delay(delayMs).then(() => retry(fn, attempts - 1, delayMs * 2))
    }
    throw error
  })
}

// Validation Utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

// Math Utilities
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}

export function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

// Browser/Environment Detection
export function isElectron(): boolean {
  // Check multiple indicators to ensure we're actually in Electron
  return typeof window !== 'undefined' && 
         !!(window as any).electronAPI &&
         typeof navigator !== 'undefined' && 
         navigator.userAgent.toLowerCase().includes('electron')
}

export function isSecureContext(): boolean {
  return location.protocol === 'https:' || 
         location.hostname === 'localhost' || 
         location.hostname.startsWith('192.168.') ||
         location.protocol === 'app:' ||
         isElectron()
}

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function getBrowserName(): string {
  const userAgent = navigator.userAgent
  
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  if (userAgent.includes('Edge')) return 'Edge'
  
  return 'Unknown'
}

// Error Handling
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unknown error occurred'
}

export function logError(error: unknown, context?: string): void {
  const message = getErrorMessage(error)
  const prefix = context ? `[${context}]` : ''
  console.error(`${prefix} ${message}`, error)
}

// Performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}
