import React, { useState, useRef, useEffect } from 'react'

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

  // Sync playback state with audio elements
  useEffect(() => {
    const micAudio = micAudioRef.current
    const systemAudio = systemAudioRef.current

    const updatePlaybackState = (audio: HTMLAudioElement, type: 'microphone' | 'system') => {
      if (audio.paused) {
        setPlaybackState(prev => ({ ...prev, [type]: audio.currentTime === 0 ? 'stopped' : 'paused' }))
      } else {
        setPlaybackState(prev => ({ ...prev, [type]: 'playing' }))
      }
    }

    const micPlayHandler = () => updatePlaybackState(micAudio!, 'microphone')
    const micPauseHandler = () => updatePlaybackState(micAudio!, 'microphone')
    const micEndedHandler = () => setPlaybackState(prev => ({ ...prev, microphone: 'stopped' }))

    const systemPlayHandler = () => updatePlaybackState(systemAudio!, 'system')
    const systemPauseHandler = () => updatePlaybackState(systemAudio!, 'system')
    const systemEndedHandler = () => setPlaybackState(prev => ({ ...prev, system: 'stopped' }))

    if (micAudio) {
      micAudio.addEventListener('play', micPlayHandler)
      micAudio.addEventListener('pause', micPauseHandler)
      micAudio.addEventListener('ended', micEndedHandler)
    }

    if (systemAudio) {
      systemAudio.addEventListener('play', systemPlayHandler)
      systemAudio.addEventListener('pause', systemPauseHandler)
      systemAudio.addEventListener('ended', systemEndedHandler)
    }

    return () => {
      if (micAudio) {
        micAudio.removeEventListener('play', micPlayHandler)
        micAudio.removeEventListener('pause', micPauseHandler)
        micAudio.removeEventListener('ended', micEndedHandler)
      }
      if (systemAudio) {
        systemAudio.removeEventListener('play', systemPlayHandler)
        systemAudio.removeEventListener('pause', systemPauseHandler)
        systemAudio.removeEventListener('ended', systemEndedHandler)
      }
    }
  }, [micAudioRef, systemAudioRef, audioUrls])

  const handlePlay = (type: 'microphone' | 'system') => {
    const audio = type === 'microphone' ? micAudioRef.current : systemAudioRef.current
    if (audio) {
      audio.play()
      // State will be updated by event listeners
    }
  }

  const handlePause = (type: 'microphone' | 'system') => {
    const audio = type === 'microphone' ? micAudioRef.current : systemAudioRef.current
    if (audio) {
      audio.pause()
      // State will be updated by event listeners
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
                preload="metadata"
              />
            )}

            {/* System Audio Warning */}
            {activeAudioType === 'system' && dualAudioInfo.system.chunks === 0 && (
              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ fontSize: '20px' }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                    No System Audio Captured
                  </div>
                  <div style={{ fontSize: '14px', color: '#92400e' }}>
                    System audio capture may have failed. Try these solutions:
                    <br />• <strong>Windows:</strong> Enable "Stereo Mix" in Sound Control Panel
                    <br />• <strong>Mac:</strong> Use apps like BlackHole or Loopback for system audio routing
                    <br />• <strong>All:</strong> Check console logs for specific error messages
                  </div>
                </div>
              </div>
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
