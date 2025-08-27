import React, { useState, useEffect } from 'react'

export default function AudioRecordingTester() {
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
    const [selectedInputDevice, setSelectedInputDevice] = useState<string>('')
    const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('')
    const [isRecording, setIsRecording] = useState(false)
    const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
    const [chunks, setChunks] = useState<Blob[]>([])
    const [error, setError] = useState<string | null>(null)
    const [logs, setLogs] = useState<string[]>([])

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    }

    useEffect(() => {
        loadDevices()
    }, [])

    const loadDevices = async () => {
        try {
            addLog('Loading audio devices...')
            const devices = await navigator.mediaDevices.enumerateDevices()
            
            const audioInputs = devices.filter(device => device.kind === 'audioinput')
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
            
            setInputDevices(audioInputs)
            setOutputDevices(audioOutputs)
            
            addLog(`Found ${audioInputs.length} audio input devices`)
            addLog(`Found ${audioOutputs.length} audio output devices`)
            
            if (audioInputs.length > 0) {
                setSelectedInputDevice(audioInputs[0].deviceId)
                addLog(`Selected input device: ${audioInputs[0].label}`)
            }
            
            if (audioOutputs.length > 0) {
                setSelectedOutputDevice(audioOutputs[0].deviceId)
                addLog(`Selected output device: ${audioOutputs[0].label}`)
            }
        } catch (err) {
            addLog(`Error loading devices: ${err}`)
            setError(`Failed to load devices: ${err}`)
        }
    }

    const startRecording = async () => {
        try {
            addLog('Starting recording...')
            setError(null)
            setChunks([])

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputDevice ? { exact: selectedInputDevice } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            })

            addLog(`Got media stream with ${stream.getAudioTracks().length} audio tracks`)

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            })

            mediaRecorder.ondataavailable = (e) => {
                addLog(`Data available: ${e.data?.size || 0} bytes`)
                if (e.data && e.data.size > 0) {
                    setChunks(prev => [...prev, e.data])
                }
            }

            mediaRecorder.onstart = () => {
                addLog('MediaRecorder started')
                setIsRecording(true)
            }

            mediaRecorder.onstop = () => {
                addLog('MediaRecorder stopped')
                setIsRecording(false)
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.onerror = (e) => {
                addLog(`MediaRecorder error: ${e}`)
                setError(`Recording error: ${e}`)
            }

            setRecorder(mediaRecorder)
            mediaRecorder.start(1000) // 1 second chunks
            addLog('Recording started successfully')

        } catch (err) {
            addLog(`Failed to start recording: ${err}`)
            setError(`Failed to start recording: ${err}`)
        }
    }

    const stopRecording = () => {
        if (recorder && recorder.state === 'recording') {
            recorder.stop()
            setRecorder(null)
        }
    }

    const testDatabase = async () => {
        try {
            addLog('Testing database access...')
            const { db } = await import('../../services/db')
            
            // Test write
            const testBlob = new Blob(['test audio data'], { type: 'audio/webm' })
            const testChunk = {
                id: 'test-chunk-' + Date.now(),
                meetingId: 'test-meeting',
                index: 0,
                blob: testBlob,
                createdAt: Date.now(),
                audioType: 'mixed' as const
            }

            await db.chunks.add(testChunk)
            addLog('✅ Database write test successful')

            // Test read
            const retrieved = await db.chunks.get(testChunk.id)
            if (retrieved && retrieved.blob.size > 0) {
                addLog('✅ Database read test successful')
                // Clean up
                await db.chunks.delete(testChunk.id)
            } else {
                addLog('❌ Database read test failed')
            }
        } catch (err) {
            addLog(`❌ Database test failed: ${err}`)
            setError(`Database error: ${err}`)
        }
    }

    const clearLogs = () => {
        setLogs([])
        setError(null)
    }

    return (
        <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
            <h2>🔧 Audio Recording Tester & Debug Mode</h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                Use this tool to diagnose audio recording issues and test system functionality
            </p>
            
            <div style={{ marginBottom: '20px' }}>
                <h3>🎤 Audio Input Devices (Microphones)</h3>
                <select 
                    value={selectedInputDevice} 
                    onChange={(e) => setSelectedInputDevice(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                >
                    {inputDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Input Device ${device.deviceId.slice(0, 8)}...`}
                        </option>
                    ))}
                </select>
                
                <h3>🔊 Audio Output Devices (Speakers/Headphones)</h3>
                <select 
                    value={selectedOutputDevice} 
                    onChange={(e) => setSelectedOutputDevice(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                >
                    {outputDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Output Device ${device.deviceId.slice(0, 8)}...`}
                        </option>
                    ))}
                </select>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={loadDevices} style={{ 
                        padding: '8px 16px', 
                        backgroundColor: '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        🔄 Refresh Devices
                    </button>
                    
                    <button onClick={testDatabase} style={{ 
                        padding: '8px 16px', 
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        🗄️ Test Database
                    </button>

                    <button onClick={clearLogs} style={{ 
                        padding: '8px 16px', 
                        backgroundColor: '#6b7280', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        🧹 Clear Logs
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>🎙️ Recording Controls</h3>
                {!isRecording ? (
                    <button 
                        onClick={startRecording}
                        disabled={inputDevices.length === 0}
                        style={{ 
                            padding: '12px 24px', 
                            backgroundColor: '#10b981', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: '600'
                        }}
                    >
                        🎙️ Start Recording
                    </button>
                ) : (
                    <button 
                        onClick={stopRecording}
                        style={{ 
                            padding: '12px 24px', 
                            backgroundColor: '#ef4444', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: '600'
                        }}
                    >
                        ⏹️ Stop Recording
                    </button>
                )}
            </div>

            {error && (
                <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#fef2f2', 
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    color: '#dc2626'
                }}>
                    ❌ Error: {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <h3>📊 Recording Status</h3>
                    <div style={{ 
                        padding: '16px', 
                        backgroundColor: '#f8fafc', 
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                    }}>
                        <p><strong>Status:</strong> {isRecording ? '🟢 Recording' : '🔴 Stopped'}</p>
                        <p><strong>Chunks:</strong> {chunks.length}</p>
                        <p><strong>Total Size:</strong> {chunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes</p>
                        <p><strong>Selected Input:</strong> {inputDevices.find(d => d.deviceId === selectedInputDevice)?.label || 'None'}</p>
                        <p><strong>Selected Output:</strong> {outputDevices.find(d => d.deviceId === selectedOutputDevice)?.label || 'None'}</p>
                    </div>
                </div>

                <div>
                    <h3>💻 System Info</h3>
                    <div style={{ 
                        padding: '16px', 
                        backgroundColor: '#f8fafc', 
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px'
                    }}>
                        <p><strong>MediaDevices API:</strong> {navigator.mediaDevices ? '✅ Available' : '❌ Not Available'}</p>
                        <p><strong>MediaRecorder API:</strong> {window.MediaRecorder ? '✅ Available' : '❌ Not Available'}</p>
                        <p><strong>Electron:</strong> {navigator.userAgent.includes('Electron') ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>User Agent:</strong> {navigator.userAgent.slice(0, 50)}...</p>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>📝 Debug Logs</h3>
                <div style={{ 
                    backgroundColor: '#f8f9fa', 
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    padding: '16px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.4'
                }}>
                    {logs.length === 0 ? (
                        <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                            No logs yet. Start testing to see debug information...
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} style={{ 
                                marginBottom: '4px', 
                                padding: '2px 0',
                                borderBottom: index < logs.length - 1 ? '1px solid #e5e7eb' : 'none'
                            }}>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div style={{ 
                padding: '16px', 
                backgroundColor: '#f0f9ff', 
                border: '1px solid #0ea5e9',
                borderRadius: '6px',
                marginBottom: '20px'
            }}>
                <h4>💡 How to Use This Debug Tool</h4>
                <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li><strong>Refresh Devices:</strong> Click to see all available microphones and speakers</li>
                    <li><strong>Select Devices:</strong> Choose your preferred input and output devices</li>
                    <li><strong>Test Database:</strong> Verify IndexedDB storage is working</li>
                    <li><strong>Start Recording:</strong> Test basic audio recording functionality</li>
                    <li><strong>Check Logs:</strong> Monitor real-time debug information</li>
                    <li><strong>System Info:</strong> Verify required APIs are available</li>
                </ol>
            </div>
        </div>
    )
}
