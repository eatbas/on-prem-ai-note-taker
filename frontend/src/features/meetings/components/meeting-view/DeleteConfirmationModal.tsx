import React, { memo } from 'react'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  deleteOperation: 'audio' | 'meeting' | null
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmationModal = memo(function DeleteConfirmationModal({
  isOpen,
  deleteOperation,
  isDeleting,
  onConfirm,
  onCancel
}: DeleteConfirmationModalProps) {
  if (!isOpen || !deleteOperation) {
    return null
  }

  const getModalConfig = () => {
    switch (deleteOperation) {
      case 'audio':
        return {
          title: 'Delete Audio Files',
          message: 'Are you sure you want to delete the audio files for this meeting? The meeting notes, summary, and transcript will be preserved.',
          icon: '🎵',
          confirmText: 'Delete Audio',
          bgColor: '#fef3c7',
          borderColor: '#fde68a',
          buttonColor: '#f59e0b'
        }
      case 'meeting':
        return {
          title: 'Delete Meeting',
          message: 'Are you sure you want to delete this meeting? This action cannot be undone and will remove all data including audio, transcript, summary, and notes.',
          icon: '🗑️',
          confirmText: 'Delete Meeting',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          buttonColor: '#ef4444'
        }
      default:
        return {
          title: 'Confirm Delete',
          message: 'Are you sure you want to proceed?',
          icon: '❓',
          confirmText: 'Delete',
          bgColor: '#f3f4f6',
          borderColor: '#d1d5db',
          buttonColor: '#6b7280'
        }
    }
  }

  const config = getModalConfig()

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        animation: 'slideIn 0.3s ease-out'
      }}>
        {/* Icon */}
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          {config.icon}
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          marginBottom: '12px',
          color: '#1f2937'
        }}>
          {config.title}
        </h3>

        {/* Message */}
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          {config.message}
        </p>

        {/* Warning for meeting deletion */}
        {deleteOperation === 'meeting' && (
          <div style={{
            padding: '12px',
            backgroundColor: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            borderRadius: '8px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#92400e',
              marginBottom: '8px'
            }}>
              ⚠️ This will permanently delete:
            </div>
            <ul style={{
              fontSize: '12px',
              color: '#92400e',
              margin: 0,
              paddingLeft: '16px'
            }}>
              <li>All audio recordings</li>
              <li>Full transcript</li>
              <li>AI-generated summary</li>
              <li>Meeting notes and tags</li>
              <li>Speaker analysis data</li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              backgroundColor: isDeleting ? '#9ca3af' : config.buttonColor,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '120px',
              justifyContent: 'center'
            }}
          >
            {isDeleting ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Deleting...
              </>
            ) : (
              config.confirmText
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})

export default DeleteConfirmationModal
