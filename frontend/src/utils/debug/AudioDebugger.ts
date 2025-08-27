/**
 * Audio Debugger Main Class
 * Orchestrates comprehensive audio debugging tests
 */

import { ComprehensiveResults, DebugResult } from './types'
import { DebugLogger } from './logger'
import { MicrophoneTests } from './microphoneTests'
import { RecordingTests } from './recordingTests'
import { StorageTests } from './storageTests'

export class AudioDebugger {
    static async runComprehensiveTest(): Promise<ComprehensiveResults> {
        DebugLogger.log('🔧 Starting comprehensive audio debug test...')
        DebugLogger.clearLogs()
        
        const results: ComprehensiveResults = {
            microphone: { success: false },
            mediaRecorder: { success: false },
            indexedDB: { success: false },
            logs: []
        }

        try {
            // Test microphone access
            DebugLogger.log('=== Testing Microphone Access ===')
            results.microphone = await MicrophoneTests.testMicrophoneAccess()

            // Test MediaRecorder support
            DebugLogger.log('=== Testing MediaRecorder Support ===')
            results.mediaRecorder = await RecordingTests.testMediaRecorderSupport()

            // Test IndexedDB functionality
            DebugLogger.log('=== Testing IndexedDB Support ===')
            results.indexedDB = await StorageTests.testIndexedDBSupport()

            // Test Electron APIs if available
            if (typeof window !== 'undefined' && (window as any).electronAPI) {
                DebugLogger.log('=== Testing Electron APIs ===')
                results.electronAPIs = await this.testElectronAPIs()
                
                DebugLogger.log('=== Testing Desktop Audio ===')
                results.desktopAudio = await this.testDesktopAudio()
                
                DebugLogger.log('=== Testing Electron Audio Sources ===')
                results.electronAudioSources = await this.testElectronAudioSources()
            }

            // Test gaming headset compatibility
            DebugLogger.log('=== Testing Gaming Headset Compatibility ===')
            results.gamingHeadset = await this.testGamingHeadsetCompatibility()

        } catch (error) {
            DebugLogger.error('Comprehensive test failed', error)
        }

        results.logs = DebugLogger.getLogs()
        
        DebugLogger.log('🏁 Comprehensive audio debug test completed')
        return results
    }

    static async testElectronAPIs(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing Electron APIs...')
            
            const electronAPI = (window as any).electronAPI
            if (!electronAPI) {
                throw new Error('Electron API not available')
            }

            const tests = {
                sendMessage: typeof electronAPI.sendMessage === 'function',
                onMessage: typeof electronAPI.onMessage === 'function',
                getDesktopSources: typeof electronAPI.getDesktopSources === 'function',
                sendRecordingState: typeof electronAPI.sendRecordingState === 'function',
                sendRecordingStarted: typeof electronAPI.sendRecordingStarted === 'function',
                sendRecordingStopped: typeof electronAPI.sendRecordingStopped === 'function'
            }

            const availableAPIs = Object.entries(tests)
                .filter(([_, available]) => available)
                .map(([name]) => name)

            DebugLogger.log(`✅ Electron APIs available: ${availableAPIs.join(', ')}`)

            return {
                success: true,
                details: {
                    electronAvailable: true,
                    availableAPIs: availableAPIs,
                    apiTests: tests
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Electron API test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testDesktopAudio(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing desktop audio capture...')
            
            const electronAPI = (window as any).electronAPI
            if (!electronAPI?.getDesktopSources) {
                throw new Error('Desktop sources API not available')
            }

            // Test getting desktop sources
            const sources = await electronAPI.getDesktopSources({
                types: ['window', 'screen'],
                thumbnailSize: { width: 150, height: 150 }
            })

            if (!sources || sources.length === 0) {
                throw new Error('No desktop sources found')
            }

            const audioSources = sources.filter((source: any) => 
                source.name.toLowerCase().includes('audio') || 
                source.name.toLowerCase().includes('sound')
            )

            DebugLogger.log(`✅ Desktop sources found: ${sources.length} total, ${audioSources.length} audio-related`)

            return {
                success: true,
                details: {
                    totalSources: sources.length,
                    audioSources: audioSources.length,
                    sources: sources.map((s: any) => ({ id: s.id, name: s.name }))
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Desktop audio test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testElectronAudioSources(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing Electron audio source capture...')
            
            const electronAPI = (window as any).electronAPI
            if (!electronAPI?.getDesktopSources) {
                throw new Error('Desktop sources API not available')
            }

            const sources = await electronAPI.getDesktopSources({
                types: ['window', 'screen'],
                thumbnailSize: { width: 150, height: 150 }
            })

            // Try to get system audio via chromeMediaSourceId
            for (const source of sources.slice(0, 3)) { // Test first 3 sources
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: source.id
                            }
                        } as any
                    })

                    // Test recording from this source
                    const recorder = new MediaRecorder(stream)
                    const chunks: Blob[] = []

                    recorder.ondataavailable = (event) => {
                        if (event.data.size > 0) chunks.push(event.data)
                    }

                    recorder.start()
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    recorder.stop()

                    // Clean up
                    stream.getTracks().forEach(track => track.stop())

                    DebugLogger.log(`✅ Successfully captured audio from source: ${source.name}`)

                    return {
                        success: true,
                        details: {
                            sourceName: source.name,
                            sourceId: source.id,
                            recordedChunks: chunks.length,
                            recordedSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0)
                        }
                    }
                } catch (sourceError) {
                    DebugLogger.warn(`Failed to capture from source ${source.name}: ${sourceError}`)
                }
            }

            throw new Error('No audio sources could be captured')
        } catch (error) {
            DebugLogger.error('❌ Electron audio source test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testGamingHeadsetCompatibility(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing gaming headset compatibility...')
            
            const devicesResult = await MicrophoneTests.listAudioDevices()
            if (!devicesResult.success) {
                throw new Error('Failed to list audio devices')
            }

            const devices = devicesResult.details
            const inputDevices = devices?.inputDevices || []
            const outputDevices = devices?.outputDevices || []

            // Look for gaming headset indicators
            const gamingKeywords = ['gaming', 'headset', 'corsair', 'logitech', 'razer', 'steelseries', 'hyperx', 'audio-technica']
            
            const gamingInputs = inputDevices.filter((device: any) =>
                gamingKeywords.some(keyword => 
                    device.label.toLowerCase().includes(keyword)
                )
            )

            const gamingOutputs = outputDevices.filter((device: any) =>
                gamingKeywords.some(keyword => 
                    device.label.toLowerCase().includes(keyword)
                )
            )

            // Test each gaming device
            const testResults = []
            for (const device of gamingInputs.slice(0, 2)) { // Test max 2 gaming devices
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: { 
                            deviceId: device.deviceId,
                            echoCancellation: false, // Gaming headsets often prefer this
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    })

                    const track = stream.getAudioTracks()[0]
                    const settings = track.getSettings()

                    testResults.push({
                        device: device.label,
                        success: true,
                        settings: settings
                    })

                    stream.getTracks().forEach(t => t.stop())
                } catch (deviceError) {
                    testResults.push({
                        device: device.label,
                        success: false,
                        error: deviceError instanceof Error ? deviceError.message : String(deviceError)
                    })
                }
            }

            DebugLogger.log(`✅ Gaming device compatibility test completed: ${gamingInputs.length} input, ${gamingOutputs.length} output`)

            return {
                success: true,
                details: {
                    gamingInputDevices: gamingInputs.length,
                    gamingOutputDevices: gamingOutputs.length,
                    totalGamingDevices: gamingInputs.length + gamingOutputs.length,
                    testResults: testResults,
                    gamingDevicesFound: gamingInputs.map((d: any) => d.label)
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Gaming headset compatibility test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async quickDiagnostic(): Promise<{ status: string; details: string[] }> {
        DebugLogger.log('Running quick diagnostic...')
        
        const issues: string[] = []
        const successes: string[] = []

        try {
            // Quick microphone test
            const micTest = await MicrophoneTests.testMicrophoneAccess()
            if (micTest.success) {
                successes.push('✅ Microphone access: OK')
            } else {
                issues.push(`❌ Microphone access: ${micTest.error}`)
            }

            // Quick MediaRecorder test
            const recorderTest = await RecordingTests.testMediaRecorderSupport()
            if (recorderTest.success) {
                successes.push('✅ MediaRecorder support: OK')
            } else {
                issues.push(`❌ MediaRecorder support: ${recorderTest.error}`)
            }

            // Quick storage test
            const storageTest = await StorageTests.testIndexedDBSupport()
            if (storageTest.success) {
                successes.push('✅ IndexedDB storage: OK')
            } else {
                issues.push(`❌ IndexedDB storage: ${storageTest.error}`)
            }

        } catch (error) {
            issues.push(`❌ Quick diagnostic failed: ${error}`)
        }

        const status = issues.length === 0 ? 'healthy' : issues.length < 3 ? 'warning' : 'critical'
        
        return {
            status,
            details: [...successes, ...issues]
        }
    }
}
