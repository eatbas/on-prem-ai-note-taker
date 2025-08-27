/**
 * Microphone Debug Tests
 * Tests for microphone access and functionality
 */

import { DebugResult, AudioDeviceInfo } from './types'
import { DebugLogger } from './logger'

export class MicrophoneTests {
    static async testMicrophoneAccess(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing microphone access...')
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            })
            
            if (stream && stream.getAudioTracks().length > 0) {
                const track = stream.getAudioTracks()[0]
                const settings = track.getSettings()
                
                DebugLogger.log('✅ Microphone access granted', settings)
                
                // Clean up
                stream.getTracks().forEach(track => track.stop())
                
                return {
                    success: true,
                    details: settings
                }
            } else {
                throw new Error('No audio tracks found in stream')
            }
        } catch (error) {
            DebugLogger.error('❌ Microphone access failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async listAudioDevices(): Promise<DebugResult> {
        try {
            DebugLogger.log('Listing audio devices...')
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                throw new Error('enumerateDevices not supported')
            }

            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioDevices: AudioDeviceInfo[] = devices
                .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
                    kind: device.kind as 'audioinput' | 'audiooutput',
                    groupId: device.groupId
                }))

            const inputDevices = audioDevices.filter(d => d.kind === 'audioinput')
            const outputDevices = audioDevices.filter(d => d.kind === 'audiooutput')

            DebugLogger.log(`Found ${inputDevices.length} input devices and ${outputDevices.length} output devices`)

            return {
                success: true,
                details: {
                    inputDevices,
                    outputDevices,
                    totalDevices: audioDevices.length
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Failed to list audio devices', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testMicrophoneLevels(duration = 3000): Promise<DebugResult> {
        try {
            DebugLogger.log(`Testing microphone levels for ${duration}ms...`)
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const audioContext = new AudioContext()
            const source = audioContext.createMediaStreamSource(stream)
            const analyser = audioContext.createAnalyser()
            
            analyser.fftSize = 256
            source.connect(analyser)
            
            const bufferLength = analyser.frequencyBinCount
            const dataArray = new Uint8Array(bufferLength)
            const levels: number[] = []
            
            const startTime = Date.now()
            
            const measureLevel = () => {
                analyser.getByteFrequencyData(dataArray)
                const average = dataArray.reduce((a, b) => a + b) / bufferLength
                levels.push(average)
                
                if (Date.now() - startTime < duration) {
                    requestAnimationFrame(measureLevel)
                } else {
                    // Cleanup
                    source.disconnect()
                    audioContext.close()
                    stream.getTracks().forEach(track => track.stop())
                    
                    const avgLevel = levels.reduce((a, b) => a + b) / levels.length
                    const maxLevel = Math.max(...levels)
                    
                    DebugLogger.log(`✅ Microphone levels recorded: avg=${avgLevel.toFixed(2)}, max=${maxLevel.toFixed(2)}`)
                }
            }
            
            measureLevel()
            
            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, duration + 100))
            
            const avgLevel = levels.reduce((a, b) => a + b) / levels.length
            const maxLevel = Math.max(...levels)
            
            return {
                success: true,
                details: {
                    averageLevel: avgLevel,
                    maxLevel: maxLevel,
                    sampleCount: levels.length,
                    levels: levels.slice(0, 50) // Store first 50 samples
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Microphone level test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testMultipleDevices(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing multiple audio devices...')
            
            const devicesResult = await this.listAudioDevices()
            if (!devicesResult.success) {
                throw new Error('Failed to list devices')
            }
            
            const inputDevices = devicesResult.details?.inputDevices || []
            const results: any[] = []
            
            for (const device of inputDevices.slice(0, 3)) { // Test max 3 devices
                try {
                    DebugLogger.log(`Testing device: ${device.label}`)
                    
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: { deviceId: device.deviceId }
                    })
                    
                    const track = stream.getAudioTracks()[0]
                    const settings = track.getSettings()
                    
                    results.push({
                        device: device.label,
                        deviceId: device.deviceId,
                        success: true,
                        settings
                    })
                    
                    stream.getTracks().forEach(t => t.stop())
                } catch (error) {
                    results.push({
                        device: device.label,
                        deviceId: device.deviceId,
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    })
                }
            }
            
            DebugLogger.log(`✅ Tested ${results.length} devices`)
            
            return {
                success: true,
                details: {
                    deviceResults: results,
                    successfulDevices: results.filter(r => r.success).length,
                    totalDevices: results.length
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Multiple device test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }
}
