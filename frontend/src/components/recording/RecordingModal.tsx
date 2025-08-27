import React, { useState } from 'react'
import DeviceSelector from './DeviceSelector'

interface RecordingModalProps {
  isOpen: boolean
  onClose: () => void
  onStartRecording: (config: RecordingConfig) => void
  isRecording?: boolean
}

export interface RecordingConfig {
  micDeviceId: string
  speakerDeviceId: string
  language: 'tr' | 'en' | 'auto'
  showFloatingWidget: boolean
}

export default function RecordingModal({
  isOpen,
  onClose,
  onStartRecording,
  isRecording = false
}: RecordingModalProps) {
  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('')
  const [language, setLanguage] = useState<'tr' | 'en' | 'auto'>('auto')
  const [showFloatingWidget, setShowFloatingWidget] = useState(true)

  const handleStartRecording = () => {
    if (!selectedMicId) return

    onStartRecording({
      micDeviceId: selectedMicId,
      speakerDeviceId: selectedSpeakerId,
      language,
      showFloatingWidget
    })
  }

  if (!isOpen) return null

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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: '700',
            color: '#1f2937'
          }}>
            🎙️ Recording Setup
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            ✕
          </button>
        </div>

        {/* Device Selection */}
        <div style={{ marginBottom: '24px' }}>
          <DeviceSelector
            selectedMicId={selectedMicId}
            selectedSpeakerId={selectedSpeakerId}
            onMicChange={setSelectedMicId}
            onSpeakerChange={setSelectedSpeakerId}
            showUsageLevels={!isRecording}
          />
        </div>

        {/* Language Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>
            🌍 Meeting Language
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px'
          }}>
            {[
              { value: 'auto', label: 'Auto (TR default)', desc: 'Detects language automatically' },
              { value: 'tr', label: 'Türkçe', desc: 'Turkish language' },
              { value: 'en', label: 'English', desc: 'English language' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setLanguage(option.value as 'tr' | 'en' | 'auto')}
                style={{
                  padding: '12px 16px',
                  backgroundColor: language === option.value ? '#3b82f6' : '#f8fafc',
                  color: language === option.value ? 'white' : '#374151',
                  border: language === option.value ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (language !== option.value) {
                    e.currentTarget.style.backgroundColor = '#e5e7eb'
                    e.currentTarget.style.borderColor = '#9ca3af'
                  }
                }}
                onMouseLeave={(e) => {
                  if (language !== option.value) {
                    e.currentTarget.style.backgroundColor = '#f8fafc'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                  {option.label}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  opacity: 0.8,
                  fontWeight: '400'
                }}>
                  {option.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recording Options */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>
            ⚙️ Recording Options
          </label>

          {/* Floating Widget Option */}
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#374151'
          }}>
            <input 
              type="checkbox" 
              checked={showFloatingWidget}
              onChange={(e) => setShowFloatingWidget(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: '#3b82f6'
              }}
            />
            <div>
              <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                Show floating recorder
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Display a floating window with recording controls while recording
              </div>
            </div>
          </label>
        </div>



        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6'
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleStartRecording}
            disabled={!selectedMicId || isRecording}
            style={{
              padding: '12px 24px',
              backgroundColor: (!selectedMicId || isRecording) ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: (!selectedMicId || isRecording) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (!selectedMicId || isRecording) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (selectedMicId && !isRecording) {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMicId && !isRecording) {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }
            }}
          >
            {isRecording ? (
              <>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  animation: 'pulse 1.5s infinite'
                }} />
                Recording...
              </>
            ) : (
              <>
                🎙️ Start Recording
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
