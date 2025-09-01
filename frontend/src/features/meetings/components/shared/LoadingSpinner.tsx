import React, { memo } from 'react'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  message?: string
  className?: string
}

const LoadingSpinner = memo(function LoadingSpinner({
  size = 'medium',
  color = '#3b82f6',
  message,
  className = ''
}: LoadingSpinnerProps) {
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return { width: 16, height: 16, borderWidth: 2 }
      case 'large':
        return { width: 48, height: 48, borderWidth: 4 }
      default:
        return { width: 24, height: 24, borderWidth: 3 }
    }
  }

  const sizeConfig = getSizeConfig()

  return (
    <div className={`loading-spinner ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    }}>
      <div
        style={{
          width: `${sizeConfig.width}px`,
          height: `${sizeConfig.height}px`,
          border: `${sizeConfig.borderWidth}px solid #e2e8f0`,
          borderTop: `${sizeConfig.borderWidth}px solid ${color}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      {message && (
        <div style={{
          fontSize: size === 'small' ? '12px' : size === 'large' ? '16px' : '14px',
          color: '#6b7280',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})

export default LoadingSpinner
