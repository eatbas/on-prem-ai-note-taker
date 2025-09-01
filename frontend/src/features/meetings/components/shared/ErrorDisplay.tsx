import React, { memo } from 'react'

interface ErrorDisplayProps {
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  type?: 'error' | 'warning' | 'info'
  className?: string
}

const ErrorDisplay = memo(function ErrorDisplay({
  title,
  message,
  onRetry,
  onDismiss,
  type = 'error',
  className = ''
}: ErrorDisplayProps) {
  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          bgColor: '#fef3c7',
          borderColor: '#fde68a',
          textColor: '#92400e',
          buttonColor: '#d97706'
        }
      case 'info':
        return {
          icon: 'ℹ️',
          bgColor: '#dbeafe',
          borderColor: '#93c5fd',
          textColor: '#1e40af',
          buttonColor: '#2563eb'
        }
      default:
        return {
          icon: '❌',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          textColor: '#dc2626',
          buttonColor: '#ef4444'
        }
    }
  }

  const config = getTypeConfig()

  return (
    <div className={`error-display ${className}`} style={{
      padding: '20px',
      backgroundColor: config.bgColor,
      border: `2px solid ${config.borderColor}`,
      borderRadius: '12px',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '32px',
        marginBottom: '12px'
      }}>
        {config.icon}
      </div>
      
      {title && (
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: config.textColor,
          margin: '0 0 8px 0'
        }}>
          {title}
        </h3>
      )}
      
      <p style={{
        fontSize: '14px',
        color: config.textColor,
        margin: '0 0 16px 0',
        lineHeight: '1.5'
      }}>
        {message}
      </p>
      
      {(onRetry || onDismiss) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center'
        }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: config.buttonColor,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              🔄 Retry
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: config.textColor,
                border: `1px solid ${config.borderColor}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = config.borderColor
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ✕ Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export default ErrorDisplay
