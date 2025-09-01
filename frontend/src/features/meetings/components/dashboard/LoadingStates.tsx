import React from 'react'

interface LoadingProgressProps {
  progress?: number
  message?: string
  type?: 'default' | 'meeting-open' | 'sync' | 'loading'
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ 
  progress, 
  message = 'Loading...', 
  type = 'default' 
}) => {
  const getLoadingConfig = () => {
    switch (type) {
      case 'meeting-open':
        return {
          icon: '📂',
          color: '#3b82f6',
          bgColor: '#eff6ff',
          borderColor: '#bfdbfe'
        }
      case 'sync':
        return {
          icon: '☁️',
          color: '#10b981',
          bgColor: '#ecfdf5',
          borderColor: '#a7f3d0'
        }
      case 'loading':
        return {
          icon: '⏳',
          color: '#f59e0b',
          bgColor: '#fffbeb',
          borderColor: '#fde68a'
        }
      default:
        return {
          icon: '🔄',
          color: '#6366f1',
          bgColor: '#f0f9ff',
          borderColor: '#c7d2fe'
        }
    }
  }

  const config = getLoadingConfig()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      backgroundColor: config.bgColor,
      border: `2px solid ${config.borderColor}`,
      borderRadius: '16px',
      textAlign: 'center',
      minHeight: '200px'
    }}>
      {/* Animated Icon */}
      <div style={{
        fontSize: '48px',
        marginBottom: '16px',
        animation: 'pulse 2s ease-in-out infinite'
      }}>
        {config.icon}
      </div>

      {/* Spinner */}
      <div style={{
        width: '32px',
        height: '32px',
        border: `3px solid ${config.borderColor}`,
        borderTop: `3px solid ${config.color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '16px'
      }} />

      {/* Progress Bar */}
      {progress !== undefined && (
        <div style={{
          width: '200px',
          height: '8px',
          backgroundColor: config.borderColor,
          borderRadius: '4px',
          marginBottom: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            backgroundColor: config.color,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
            animation: progress < 100 ? 'shimmer 2s ease-in-out infinite' : 'none'
          }} />
        </div>
      )}

      {/* Message */}
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        color: config.color,
        marginBottom: '8px'
      }}>
        {message}
      </div>

      {/* Progress Percentage */}
      {progress !== undefined && (
        <div style={{
          fontSize: '14px',
          color: '#6b7280',
          fontWeight: '500'
        }}>
          {Math.round(progress)}% complete
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
      `}</style>
    </div>
  )
}

export const MeetingLoadingCard: React.FC<{ message?: string }> = ({ 
  message = 'Opening meeting...' 
}) => (
  <div style={{
    backgroundColor: '#ffffff',
    border: '2px solid #dbeafe',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    animation: 'cardPulse 2s ease-in-out infinite'
  }}>
    <div style={{
      width: '24px',
      height: '24px',
      border: '3px solid #bfdbfe',
      borderTop: '3px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 12px'
    }} />
    
    <div style={{
      fontSize: '14px',
      color: '#3b82f6',
      fontWeight: '600'
    }}>
      {message}
    </div>

    <style>{`
      @keyframes cardPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
    `}</style>
  </div>
)

export const SkeletonMeetingCard: React.FC = () => (
  <div style={{
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    animation: 'skeletonPulse 1.5s ease-in-out infinite'
  }}>
    {/* Title Skeleton */}
    <div style={{
      height: '20px',
      backgroundColor: '#f3f4f6',
      borderRadius: '4px',
      marginBottom: '12px',
      width: '70%'
    }} />

    {/* Meta Info Skeleton */}
    <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '16px'
    }}>
      <div style={{
        height: '16px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        width: '60px'
      }} />
      <div style={{
        height: '16px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        width: '80px'
      }} />
      <div style={{
        height: '16px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        width: '50px'
      }} />
    </div>

    {/* Content Skeleton */}
    <div style={{
      height: '60px',
      backgroundColor: '#f3f4f6',
      borderRadius: '6px',
      marginBottom: '12px'
    }} />

    {/* Tags Skeleton */}
    <div style={{
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap'
    }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: '20px',
          backgroundColor: '#f3f4f6',
          borderRadius: '10px',
          width: `${40 + i * 10}px`
        }} />
      ))}
    </div>

    <style>{`
      @keyframes skeletonPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
)

export const DashboardLoadingState: React.FC<{ meetingsCount?: number }> = ({ 
  meetingsCount = 3 
}) => (
  <div>
    <div style={{
      display: 'grid',
      gap: '20px',
      marginBottom: '24px'
    }}>
      {Array.from({ length: meetingsCount }, (_, i) => (
        <SkeletonMeetingCard key={i} />
      ))}
    </div>
    
    <div style={{
      textAlign: 'center',
      padding: '16px',
      color: '#6b7280',
      fontSize: '14px'
    }}>
      Loading your meetings...
    </div>
  </div>
)

export default {
  LoadingProgress,
  MeetingLoadingCard,
  SkeletonMeetingCard,
  DashboardLoadingState
}
