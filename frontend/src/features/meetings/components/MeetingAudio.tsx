import React, { useState, useRef } from 'react'

interface MeetingAudioProps {
  audioUrls: {
    microphone: string | null
    system: string | null
  }
  activeAudioType: 'microphone' | 'system'
  setActiveAudioType: (type: 'microphone' | 'system') => void
  micAudioRef: React.RefObject<HTMLAudioElement>
  systemAudioRef: React.RefObject<HTMLAudioElement>
  dualAudioInfo: any
  isLoadingAudio: boolean
  onDownload: (type: 'microphone' | 'system') => void
}

export default function MeetingAudio({
  audioUrls,
  activeAudioType,
  setActiveAudioType,
  micAudioRef,
  systemAudioRef,
  dualAudioInfo,
  isLoadingAudio,
  onDownload
}: MeetingAudioProps) {
  const [playbackState, setPlaybackState] = useState<{
    microphone: 'playing' | 'paused' | 'stopped'
    system: 'playing' | 'paused' | 'stopped'
  }>({
    microphone: 'stopped',
    system: 'stopped'
  })

  const handlePlay = (type: 'microphone' | 'system') => {
    const audio = type === 'microphone' ? micAudioRef.current : systemAudioRef.current
    if (audio) {
      audio.play()
      setPlaybackState(prev => ({ ...prev, [type]: 'playing' }))
    }
  }

  const handlePause = (type: 'microphone' | 'system') => {
    const audio = type === 'microphone' ? micAudioRef.current : systemAudioRef.current
    if (audio) {
      audio.pause()
      setPlaybackState(prev => ({ ...prev, [type]: 'paused' }))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: 'bold', 
        marginBottom: '16px',
        color: '#1f2937'
      }}>
        🎵 Audio Recordings
      </h2>

      {isLoadingAudio && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
          <p>Loading audio files...</p>
        </div>
      )}

      {dualAudioInfo && (
        <div style={{ marginBottom: '24px' }}>
          {/* Audio Type Selector */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '20px',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setActiveAudioType('microphone')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeAudioType === 'microphone' ? '#3b82f6' : '#f3f4f6',
                color: activeAudioType === 'microphone' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🎤 Microphone ({dualAudioInfo.microphone.chunks} chunks)
            </button>
            
            <button
              onClick={() => setActiveAudioType('system')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeAudioType === 'system' ? '#3b82f6' : '#f3f4f6',
                color: activeAudioType === 'system' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🔊 System Audio ({dualAudioInfo.system.chunks} chunks)
            </button>
          </div>

          {/* Audio Player and Info */}
          <div style={{ 
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                {activeAudioType === 'microphone' ? '🎤 Microphone Audio' : '🔊 System Audio'}
              </h3>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {audioUrls[activeAudioType] && (
                  <>
                    {playbackState[activeAudioType] === 'playing' ? (
                      <button
                        onClick={() => handlePause(activeAudioType)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        ⏸️ Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePlay(activeAudioType)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        ▶️ Play
                      </button>
                    )}
                    
                    <button
                      onClick={() => onDownload(activeAudioType)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      📥 Download
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Audio Element */}
            {audioUrls[activeAudioType] && (
              <audio
                ref={activeAudioType === 'microphone' ? micAudioRef : systemAudioRef}
                src={audioUrls[activeAudioType] || ''}
                controls
                style={{ width: '100%', marginBottom: '16px' }}
                onPlay={() => setPlaybackState(prev => ({ ...prev, [activeAudioType]: 'playing' }))}
                onPause={() => setPlaybackState(prev => ({ ...prev, [activeAudioType]: 'paused' }))}
                onEnded={() => setPlaybackState(prev => ({ ...prev, [activeAudioType]: 'stopped' }))}
              />
            )}

            {/* Audio Info */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '12px' 
            }}>
              <div style={{ 
                backgroundColor: '#ffffff',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Chunks
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                  {dualAudioInfo[activeAudioType].chunks}
                </div>
              </div>
              
              <div style={{ 
                backgroundColor: '#ffffff',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  File Size
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                  {formatFileSize(dualAudioInfo[activeAudioType].size)}
                </div>
              </div>
              
              <div style={{ 
                backgroundColor: '#ffffff',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Quality
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                  {dualAudioInfo[activeAudioType].hasData ? '✅ Good' : '❌ No Data'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!dualAudioInfo && !isLoadingAudio && (
        <div style={{ 
          textAlign: 'center', 
          color: '#6b7280', 
          fontStyle: 'italic',
          padding: '60px 20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
          <p>No audio recordings found</p>
        </div>
      )}
    </div>
  )
}
