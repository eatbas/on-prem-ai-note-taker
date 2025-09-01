import { useState } from 'react'
import { db } from '../../../../../services/db'
import { getVpsHealth } from '../../../../../services'
import { useToast } from '../../../../../components/common'

export function useQuickActions() {
  const { showToast } = useToast()

  const [clearingMeetings, setClearingMeetings] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [testingHealth, setTestingHealth] = useState(false)

  const handleClearLocalMeetings = async () => {
    // eslint-disable-next-line no-alert
    if (!confirm('Clear ALL local meetings, audio chunks and notes from this device?')) return
    setClearingMeetings(true)
    try {
      await Promise.all([
        db.meetings.clear(),
        db.chunks.clear(),
        db.notes.clear()
      ])
      showToast('All local meetings cleared', 'success')
    } catch (e) {
      console.error('Failed to clear local meetings:', e)
      showToast('Failed to clear local meetings', 'error')
    } finally {
      setClearingMeetings(false)
    }
  }

  const handleClearCache = async () => {
    // eslint-disable-next-line no-alert
    if (!confirm('Clear application cache (local/session storage and browser caches)?')) return
    setClearingCache(true)
    try {
      localStorage.clear()
      sessionStorage.clear()
      if ('caches' in window) {
        try {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        } catch {
          // ignore cache API failures
        }
      }
      showToast('Cache cleared', 'success')
    } catch (e) {
      console.error('Failed to clear cache:', e)
      showToast('Failed to clear cache', 'error')
    } finally {
      setClearingCache(false)
    }
  }

  const handleHealthCheck = async () => {
    setTestingHealth(true)
    try {
      const health = await getVpsHealth()
      // eslint-disable-next-line no-alert
      alert(`Backend OK\nWhisper: ${health.whisper_model}\nOllama: ${health.ollama_model}`)
      showToast('Health check completed successfully', 'success')
    } catch (error) {
      console.error('Health check failed:', error)
      showToast('Health check failed', 'error')
    } finally {
      setTestingHealth(false)
    }
  }

  const handleReloadApp = () => {
    // eslint-disable-next-line no-alert
    if (confirm('Are you sure you want to reload the application?')) {
      window.location.reload()
    }
  }

  const handleExportLogs = () => {
    try {
      const logs = [
        `Admin Dashboard Logs - ${new Date().toISOString()}`,
        '='.repeat(50),
        'Browser Information:',
        `User Agent: ${navigator.userAgent}`,
        `Platform: ${navigator.platform}`,
        `Language: ${navigator.language}`,
        `Cookies Enabled: ${navigator.cookieEnabled}`,
        `Online: ${navigator.onLine}`,
        '',
        'Storage Information:',
        `Local Storage Items: ${localStorage.length}`,
        `Session Storage Items: ${sessionStorage.length}`,
        '',
        'Performance Information:',
        `Memory Used: ${(performance as any).memory ? `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`,
        `Connection: ${(navigator as any).connection ? `${(navigator as any).connection.effectiveType} (${(navigator as any).connection.downlink} Mbps)` : 'N/A'}`,
        '',
        'Application State:',
        `Current URL: ${window.location.href}`,
        `Timestamp: ${new Date().toISOString()}`,
        ''
      ].join('\n')

      const blob = new Blob([logs], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `admin-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Logs exported successfully', 'success')
    } catch (error) {
      console.error('Failed to export logs:', error)
      showToast('Failed to export logs', 'error')
    }
  }

  const actions = [
    {
      title: 'Backend Health Check',
      description: 'Test connection to the backend API and check service status',
      icon: '🏥',
      action: handleHealthCheck,
      loading: testingHealth,
      color: '#22c55e'
    },
    {
      title: 'Clear Local Meetings',
      description: 'Remove all local meetings, chunks and notes from this device',
      icon: '🧹',
      action: handleClearLocalMeetings,
      loading: clearingMeetings,
      color: '#f59e0b'
    },
    {
      title: 'Clear App Cache',
      description: 'Clear local/session storage and browser caches',
      icon: '🗑️',
      action: handleClearCache,
      loading: clearingCache,
      color: '#ef4444'
    },
    {
      title: 'Reload Application',
      description: 'Force refresh the entire application',
      icon: '🔄',
      action: handleReloadApp,
      loading: false,
      color: '#3b82f6'
    },
    {
      title: 'Export Debug Logs',
      description: 'Download application logs and system information',
      icon: '📥',
      action: handleExportLogs,
      loading: false,
      color: '#8b5cf6'
    }
  ]

  return { actions }
}


