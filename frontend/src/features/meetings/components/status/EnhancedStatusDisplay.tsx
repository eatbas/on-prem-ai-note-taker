import React, { memo } from 'react'

export type MeetingStatus = 'recording' | 'local' | 'queued' | 'uploading' | 'processing' | 'synced' | 'sent' | 'error'

interface EnhancedStatusDisplayProps {
  status: MeetingStatus
  progress?: number
  message?: string
  lastSync?: number
  className?: string
  showDetails?: boolean
  compact?: boolean
}

const EnhancedStatusDisplay = memo(function EnhancedStatusDisplay({
  status,
  progress,
  message,
  lastSync,
  className = '',
  showDetails = true,
  compact = false
}: EnhancedStatusDisplayProps) {
  
  const getStatusConfig = () => {
    switch (status) {
      case 'recording':
        return {
          icon: '🎙️',
          label: 'Recording',
          description: 'Meeting is currently being recorded',
          color: '#dc2626',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          animated: true
        }
      case 'local':
        return {
          icon: '📱',
          label: 'Local Only',
          description: 'Stored locally, not synced to cloud',
          color: '#6b7280',
          bgColor: '#f9fafb',
          borderColor: '#e5e7eb',
          animated: false
        }
      case 'queued':
        return {
          icon: '⏳',
          label: 'Queued',
          description: 'Waiting to be processed',
          color: '#f59e0b',
          bgColor: '#fffbeb',
          borderColor: '#fde68a',
          animated: true
        }
      case 'uploading':
        return {
          icon: '📤',
          label: 'Uploading',
          description: 'Uploading to cloud server',
          color: '#3b82f6',
          bgColor: '#eff6ff',
          borderColor: '#bfdbfe',
          animated: true
        }
      case 'processing':
        return {
          icon: '🤖',
          label: 'AI Processing',
          description: 'Generating transcript and summary',
          color: '#7c3aed',
          bgColor: '#f5f3ff',
          borderColor: '#c4b5fd',
          animated: true
        }
      case 'synced':
      case 'sent':
        return {
          icon: '✅',
          label: 'Synced',
          description: 'Successfully synced to cloud',
          color: '#10b981',
          bgColor: '#ecfdf5',
          borderColor: '#a7f3d0',
          animated: false
        }
      case 'error':
        return {
          icon: '❌',
          label: 'Error',
          description: 'Something went wrong',
          color: '#ef4444',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          animated: false
        }
      default:
        return {
          icon: '❓',
          label: 'Unknown',
          description: 'Status unknown',
          color: '#6b7280',
          bgColor: '#f9fafb',
          borderColor: '#e5e7eb',
          animated: false
        }
    }
  }

  const config = getStatusConfig()

  const formatLastSync = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (compact) {
    return (
      <div className={`enhanced-status-compact ${className}`} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        backgroundColor: config.bgColor,
        color: config.color,
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        border: `1px solid ${config.borderColor}`
      }}>
        <span style={{
          fontSize: '12px',
          animation: config.animated ? 'pulse 2s infinite' : 'none'
        }}>
          {config.icon}
        </span>
        <span>{config.label}</span>
        {progress !== undefined && (
          <span>({progress}%)</span>
        )}
      </div>
    )
  }

  return (
    <div className={`enhanced-status ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: config.bgColor,
      border: `1px solid ${config.borderColor}`,
      borderRadius: '8px',
      color: config.color
    }}>
      {/* Status Icon */}
      <div style={{
        fontSize: '20px',
        animation: config.animated ? 'pulse 2s infinite' : 'none'
      }}>
        {config.icon}
      </div>

      {/* Status Content */}
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: showDetails ? '4px' : 0
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '600'
          }}>
            {config.label}
          </span>
          
          {progress !== undefined && (
            <span style={{
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: '500'
            }}>
              {progress}%
            </span>
          )}
        </div>

        {showDetails && (
          <div style={{
            fontSize: '12px',
            opacity: 0.8,
            lineHeight: '1.4'
          }}>
            {message || config.description}
            {lastSync && status === 'synced' && (
              <span style={{ marginLeft: '8px' }}>
                • Last sync: {formatLastSync(lastSync)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {progress !== undefined && progress > 0 && (
        <div style={{
          width: '60px',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(progress, 100)}%`,
            height: '100%',
            backgroundColor: config.color,
            borderRadius: '2px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
})

export default EnhancedStatusDisplay