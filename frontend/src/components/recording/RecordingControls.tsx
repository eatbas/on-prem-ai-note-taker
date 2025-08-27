import React from 'react'

interface RecordingControlsProps {
  isRecording: boolean
  recordingTime: number
  onStart: () => void
  onStop: () => void
  showStopButton?: boolean
  disabled?: boolean
  error?: string | null
}

export default function RecordingControls({
  isRecording,
  recordingTime,
  onStart,
  onStop,
  showStopButton = true,
  disabled = false,
  error
}: RecordingControlsProps) {
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px'
    }}>
      {/* Control Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center' 
      }}>
        <button 
          onClick={onStart} 
          disabled={isRecording || disabled}
          style={{
            padding: '12px 24px',
            backgroundColor: (isRecording || disabled) ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: (isRecording || disabled) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: (isRecording || disabled) ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transform: (isRecording || disabled) ? 'scale(0.95)' : 'scale(1)',
            opacity: (isRecording || disabled) ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '140px',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            if (!isRecording && !disabled) {
              e.currentTarget.style.backgroundColor = '#2563eb'
              e.currentTarget.style.transform = 'scale(1.02)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isRecording && !disabled) {
              e.currentTarget.style.backgroundColor = '#3b82f6'
              e.currentTarget.style.transform = 'scale(1)'
            }
          }}
        >
          🎙️ Start Recording
        </button>

        {showStopButton && (
          <button 
            onClick={onStop} 
            disabled={!isRecording}
            style={{
              padding: '12px 24px',
              backgroundColor: !isRecording ? '#9ca3af' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: !isRecording ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: !isRecording ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transform: !isRecording ? 'scale(0.95)' : 'scale(1)',
              opacity: !isRecording ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '140px',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              if (isRecording) {
                e.currentTarget.style.backgroundColor = '#dc2626'
                e.currentTarget.style.transform = 'scale(1.02)'
              }
            }}
            onMouseLeave={(e) => {
              if (isRecording) {
                e.currentTarget.style.backgroundColor = '#ef4444'
                e.currentTarget.style.transform = 'scale(1)'
              }
            }}
          >
            ⏹️ Stop Recording
          </button>
        )}
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '16px 24px',
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '12px',
          minWidth: '200px'
        }}>
          {/* Recording Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#dc2626'
          }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                animation: 'pulse 1.5s infinite'
              }}
            />
            REC
          </div>

          {/* Timer */}
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1f2937',
            fontFamily: 'monospace',
            letterSpacing: '1px'
          }}>
            {formatTime(recordingTime)}
          </div>

          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Recording microphone and system audio
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Recording Tips */}
      {!isRecording && !error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
          textAlign: 'center',
          maxWidth: '500px',
          lineHeight: '1.4'
        }}>
          <strong>💡 Tip:</strong> Click "Start Recording" to select your microphone and begin dual-channel recording (mic + speakers).
          System audio capture requires screen sharing permission.
        </div>
      )}
    </div>
  )
}

// CSS for pulse animation (should be added to global styles)
export const recordingControlsStyles = `
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
`
