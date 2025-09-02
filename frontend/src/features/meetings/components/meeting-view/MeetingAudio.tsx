import React, { useState, useRef, useEffect } from 'react'

interface MeetingAudioProps {
  audioUrl: string | null
  audioRef: React.RefObject<HTMLAudioElement>
  audioInfo: any
  isLoadingAudio: boolean
  onDownload: () => void
}

export default function MeetingAudio({
  audioUrl,
  audioRef,
  audioInfo,
  isLoadingAudio,
  onDownload
}: MeetingAudioProps) {
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused' | 'stopped'>('stopped')

  // Sync playback state with audio element
  useEffect(() => {
    const audio = audioRef.current

    const updatePlaybackState = (audio: HTMLAudioElement) => {
      if (audio.paused) {
        setPlaybackState(audio.currentTime === 0 ? 'stopped' : 'paused')
      } else {
        setPlaybackState('playing')
      }
    }

    const playHandler = () => updatePlaybackState(audio!)
    const pauseHandler = () => updatePlaybackState(audio!)
    const endedHandler = () => setPlaybackState('stopped')

    if (audio) {
      audio.addEventListener('play', playHandler)
      audio.addEventListener('pause', pauseHandler)
      audio.addEventListener('ended', endedHandler)
    }

    return () => {
      if (audio) {
        audio.removeEventListener('play', playHandler)
        audio.removeEventListener('pause', pauseHandler)
        audio.removeEventListener('ended', endedHandler)
      }
    }
  }, [audioRef, audioUrl])

  const handlePlay = () => {
    const audio = audioRef.current
    if (audio) {
      audio.play()
      // State will be updated by event listeners
    }
  }

  const handlePause = () => {
    const audio = audioRef.current
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
        🎵 Audio Recording
      </h2>

      {isLoadingAudio && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
          <p>Loading audio file...</p>
        </div>
      )}

      {audioInfo && (
        <div style={{ marginBottom: '24px' }}>
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
                {audioInfo?.audioType === 'mixed' ? '🎙️ Mixed Audio (Optimized for Whisper)' :
                 audioInfo?.audioType === 'system' ? '🔊 System Audio' : '🎤 Microphone Audio'}
              </h3>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {audioUrl && (
                  <>
                    {playbackState === 'playing' ? (
                      <button
                        onClick={handlePause}
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
                        onClick={handlePlay}
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
                      onClick={onDownload}
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
            {audioUrl && (
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                style={{ width: '100%', marginBottom: '16px' }}
                preload="metadata"
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
                  {audioInfo.chunks}
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
                  {formatFileSize(audioInfo.size)}
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
                  {audioInfo.hasData ? '✅ Good' : '❌ No Data'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!audioInfo && !isLoadingAudio && (
        <div style={{ 
          textAlign: 'center', 
          color: '#6b7280', 
          fontStyle: 'italic',
          padding: '60px 20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
          <p>No audio recording found</p>
        </div>
      )}
    </div>
  )
}
