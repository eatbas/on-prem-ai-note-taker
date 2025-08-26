/**
 * Audio Recording Debug Utility
 * Helps diagnose audio recording issues in the client app
 */

export class AudioDebugger {
    private static logs: string[] = []

    static log(message: string, data?: any) {
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] ${message}`
        console.log(`🔧 AudioDebug: ${logEntry}`, data || '')
        this.logs.push(logEntry + (data ? ' ' + JSON.stringify(data) : ''))
    }

    static async testMicrophoneAccess(): Promise<boolean> {
        try {
            this.log('Testing microphone access...')
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            
            if (stream && stream.getAudioTracks().length > 0) {
                const track = stream.getAudioTracks()[0]
                this.log('✅ Microphone access granted', {
                    deviceId: track.getSettings().deviceId,
                    sampleRate: track.getSettings().sampleRate,
                    channelCount: track.getSettings().channelCount,
                    autoGainControl: track.getSettings().autoGainControl,
                    noiseSuppression: track.getSettings().noiseSuppression
                })
                
                // Clean up
                stream.getTracks().forEach(track => track.stop())
                return true
            } else {
                this.log('❌ No audio tracks found in stream')
                return false
            }
        } catch (error) {
            this.log('❌ Microphone access failed', error)
            return false
        }
    }

    static async testMediaRecorder(): Promise<boolean> {
        try {
            this.log('Testing MediaRecorder functionality...')
            
            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                this.log('❌ MediaRecorder not supported in this browser')
                return false
            }

            // Test codec support
            const codecs = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/wav'
            ]
            
            const supportedCodecs = codecs.filter(codec => MediaRecorder.isTypeSupported(codec))
            this.log('✅ Supported audio codecs', supportedCodecs)
            
            if (supportedCodecs.length === 0) {
                this.log('❌ No supported audio codecs found')
                return false
            }

            // Test actual recording
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream, { 
                mimeType: supportedCodecs[0]
            })

            let dataReceived = false
            recorder.ondataavailable = (e) => {
                dataReceived = true
                this.log('✅ MediaRecorder data available', {
                    hasData: !!e.data,
                    size: e.data?.size || 0,
                    type: e.data?.type || 'unknown'
                })
            }

            recorder.start(1000) // 1 second chunks
            this.log('📹 MediaRecorder started', {
                state: recorder.state,
                mimeType: recorder.mimeType
            })

            // Wait 2 seconds then stop
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            recorder.stop()
            stream.getTracks().forEach(track => track.stop())

            // Wait a bit for final data events
            await new Promise(resolve => setTimeout(resolve, 500))

            if (dataReceived) {
                this.log('✅ MediaRecorder test successful - data was captured')
                return true
            } else {
                this.log('❌ MediaRecorder test failed - no data captured')
                return false
            }

        } catch (error) {
            this.log('❌ MediaRecorder test failed', error)
            return false
        }
    }

    static async testIndexedDB(): Promise<boolean> {
        try {
            this.log('Testing IndexedDB functionality...')
            
            // Import db from services
            const { db } = await import('../services/db')
            
            // Test write
            const testChunk = {
                id: 'test-chunk-' + Date.now(),
                meetingId: 'test-meeting',
                index: 0,
                blob: new Blob(['test audio data'], { type: 'audio/webm' }),
                createdAt: Date.now()
            }

            await db.chunks.add(testChunk)
            this.log('✅ IndexedDB write test successful')

            // Test read
            const retrieved = await db.chunks.get(testChunk.id)
            if (retrieved && retrieved.blob.size > 0) {
                this.log('✅ IndexedDB read test successful', {
                    blobSize: retrieved.blob.size,
                    blobType: retrieved.blob.type
                })
                
                // Clean up
                await db.chunks.delete(testChunk.id)
                return true
            } else {
                this.log('❌ IndexedDB read test failed')
                return false
            }

        } catch (error) {
            this.log('❌ IndexedDB test failed', error)
            return false
        }
    }

    static async runFullDiagnostic(): Promise<{ 
        microphone: boolean, 
        mediaRecorder: boolean, 
        indexedDB: boolean,
        logs: string[]
    }> {
        this.log('🔧 Starting full audio recording diagnostic...')
        
        const results = {
            microphone: await this.testMicrophoneAccess(),
            mediaRecorder: await this.testMediaRecorder(),
            indexedDB: await this.testIndexedDB(),
            logs: [...this.logs]
        }

        this.log('🔧 Diagnostic complete', results)
        return results
    }

    static exportLogs(): string {
        return this.logs.join('\n')
    }

    static clearLogs(): void {
        this.logs = []
    }
}

// Global access for debugging
if (typeof window !== 'undefined') {
    (window as any).AudioDebugger = AudioDebugger
}
