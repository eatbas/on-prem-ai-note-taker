/**
 * Recording Debug Tests
 * Tests for MediaRecorder functionality and audio recording
 */

import { DebugResult, RecordingTestResult } from './types'
import { DebugLogger } from './logger'

export class RecordingTests {
    static async testMediaRecorderSupport(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing MediaRecorder support...')
            
            if (!window.MediaRecorder) {
                throw new Error('MediaRecorder not supported in this browser')
            }
            
            const supportedTypes = [
                'audio/webm',
                'audio/webm;codecs=opus',
                'audio/mp4',
                'audio/mpeg',
                'audio/ogg;codecs=opus'
            ]
            
            const supportInfo = supportedTypes.map(type => ({
                mimeType: type,
                supported: MediaRecorder.isTypeSupported(type)
            }))
            
            const supportedCount = supportInfo.filter(info => info.supported).length
            
            DebugLogger.log(`✅ MediaRecorder supported with ${supportedCount}/${supportedTypes.length} mime types`)
            
            return {
                success: true,
                details: {
                    mediaRecorderAvailable: true,
                    supportedMimeTypes: supportInfo,
                    recommendedType: supportInfo.find(info => info.supported)?.mimeType || 'none'
                }
            }
        } catch (error) {
            DebugLogger.error('❌ MediaRecorder test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testBasicRecording(duration = 3000): Promise<DebugResult> {
        try {
            DebugLogger.log(`Testing basic recording for ${duration}ms...`)
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const chunks: Blob[] = []
            
            const recorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                    ? 'audio/webm;codecs=opus' 
                    : 'audio/webm'
            })
            
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data)
                }
            }
            
            const recordingPromise = new Promise<RecordingTestResult>((resolve, reject) => {
                recorder.onstop = async () => {
                    try {
                        const audioBlob = new Blob(chunks, { type: recorder.mimeType })
                        
                        const result: RecordingTestResult = {
                            duration: duration,
                            sampleRate: 44100, // Default assumption
                            channelCount: 1, // Default assumption
                            mimeType: recorder.mimeType,
                            fileSize: audioBlob.size,
                            audioLevels: [] // Would need Web Audio API for actual levels
                        }
                        
                        resolve(result)
                    } catch (error) {
                        reject(error)
                    }
                }
                
                recorder.onerror = (event) => {
                    reject(new Error(`Recording error: ${event.error}`))
                }
            })
            
            recorder.start(1000) // 1 second chunks
            
            setTimeout(() => {
                recorder.stop()
                stream.getTracks().forEach(track => track.stop())
            }, duration)
            
            const result = await recordingPromise
            
            DebugLogger.log(`✅ Basic recording completed: ${result.fileSize} bytes`)
            
            return {
                success: true,
                details: result
            }
        } catch (error) {
            DebugLogger.error('❌ Basic recording test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testChunkedRecording(duration = 5000, chunkSize = 1000): Promise<DebugResult> {
        try {
            DebugLogger.log(`Testing chunked recording: ${duration}ms with ${chunkSize}ms chunks...`)
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const chunks: { data: Blob; timestamp: number; index: number }[] = []
            let chunkIndex = 0
            
            const recorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                    ? 'audio/webm;codecs=opus' 
                    : 'audio/webm'
            })
            
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push({
                        data: event.data,
                        timestamp: Date.now(),
                        index: chunkIndex++
                    })
                }
            }
            
            const recordingPromise = new Promise<any>((resolve, reject) => {
                recorder.onstop = () => {
                    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.size, 0)
                    const avgChunkSize = totalSize / chunks.length
                    
                    resolve({
                        totalChunks: chunks.length,
                        totalSize: totalSize,
                        averageChunkSize: avgChunkSize,
                        chunkSizes: chunks.map(c => c.data.size),
                        duration: duration,
                        mimeType: recorder.mimeType
                    })
                }
                
                recorder.onerror = (event) => {
                    reject(new Error(`Chunked recording error: ${event.error}`))
                }
            })
            
            recorder.start(chunkSize)
            
            setTimeout(() => {
                recorder.stop()
                stream.getTracks().forEach(track => track.stop())
            }, duration)
            
            const result = await recordingPromise
            
            DebugLogger.log(`✅ Chunked recording completed: ${result.totalChunks} chunks, ${result.totalSize} bytes`)
            
            return {
                success: true,
                details: result
            }
        } catch (error) {
            DebugLogger.error('❌ Chunked recording test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testDualStreamRecording(duration = 3000): Promise<DebugResult> {
        try {
            DebugLogger.log(`Testing dual stream recording for ${duration}ms...`)
            
            // Get microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true 
                } 
            })
            
            // For browser testing, we'll simulate system audio with a second mic stream
            // In a real scenario, this would be system audio capture
            const systemStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: false,
                    noiseSuppression: false 
                } 
            })
            
            const micChunks: Blob[] = []
            const systemChunks: Blob[] = []
            
            const micRecorder = new MediaRecorder(micStream)
            const systemRecorder = new MediaRecorder(systemStream)
            
            micRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) micChunks.push(event.data)
            }
            
            systemRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) systemChunks.push(event.data)
            }
            
            const recordingPromise = new Promise<any>((resolve, reject) => {
                let stoppedCount = 0
                
                const handleStop = () => {
                    stoppedCount++
                    if (stoppedCount === 2) {
                        const micBlob = new Blob(micChunks, { type: 'audio/webm' })
                        const systemBlob = new Blob(systemChunks, { type: 'audio/webm' })
                        
                        resolve({
                            microphoneSize: micBlob.size,
                            systemSize: systemBlob.size,
                            microphoneChunks: micChunks.length,
                            systemChunks: systemChunks.length,
                            totalSize: micBlob.size + systemBlob.size,
                            duration: duration
                        })
                    }
                }
                
                micRecorder.onstop = handleStop
                systemRecorder.onstop = handleStop
                
                micRecorder.onerror = (event) => reject(new Error(`Mic recording error: ${event.error}`))
                systemRecorder.onerror = (event) => reject(new Error(`System recording error: ${event.error}`))
            })
            
            micRecorder.start(1000)
            systemRecorder.start(1000)
            
            setTimeout(() => {
                micRecorder.stop()
                systemRecorder.stop()
                micStream.getTracks().forEach(track => track.stop())
                systemStream.getTracks().forEach(track => track.stop())
            }, duration)
            
            const result = await recordingPromise
            
            DebugLogger.log(`✅ Dual stream recording completed: mic=${result.microphoneSize}B, system=${result.systemSize}B`)
            
            return {
                success: true,
                details: result
            }
        } catch (error) {
            DebugLogger.error('❌ Dual stream recording test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }
}
