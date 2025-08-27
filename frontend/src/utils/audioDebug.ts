/**
 * Audio Recording Debug Utility
 * Helps diagnose audio recording issues in the client app
 * Includes both browser and Electron-specific tests
 */

interface DebugResult {
    success: boolean
    details?: any
    error?: string
}

interface ComprehensiveResults {
    microphone: DebugResult
    mediaRecorder: DebugResult
    indexedDB: DebugResult
    electronAPIs?: DebugResult
    desktopAudio?: DebugResult
    electronAudioSources?: DebugResult
    gamingHeadset?: DebugResult
    logs: string[]
}

export class AudioDebugger {
    private static logs: string[] = []

    static log(message: string, data?: any) {
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] ${message}`
        console.log(`🔧 AudioDebug: ${logEntry}`, data || '')
        this.logs.push(logEntry + (data ? ' ' + JSON.stringify(data) : ''))
    }

    static async testMicrophoneAccess(): Promise<DebugResult> {
        try {
            this.log('Testing microphone access...')
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
                
                this.log('✅ Microphone access granted', settings)
                
                // Test if audio is actually flowing
                const audioContext = new AudioContext()
                const source = audioContext.createMediaStreamSource(stream)
                const analyser = audioContext.createAnalyser()
                source.connect(analyser)
                
                const dataArray = new Uint8Array(analyser.frequencyBinCount)
                
                // Wait a bit and check for audio activity
                await new Promise(resolve => setTimeout(resolve, 1000))
                analyser.getByteFrequencyData(dataArray)
                const hasAudio = dataArray.some(value => value > 0)
                
                // Clean up
                stream.getTracks().forEach(track => track.stop())
                audioContext.close()
                
                const result = {
                    success: true,
                    details: {
                        ...settings,
                        hasAudioSignal: hasAudio,
                        tracks: stream.getAudioTracks().length
                    }
                }
                
                if (!hasAudio) {
                    this.log('⚠️ No audio signal detected - microphone may be muted')
                } else {
                    this.log('✅ Audio signal detected')
                }
                
                return result
            } else {
                this.log('❌ No audio tracks found in stream')
                return { success: false, error: 'No audio tracks found in stream' }
            }
        } catch (error: any) {
            this.log('❌ Microphone access failed', error)
            let errorMessage = error.message
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Microphone permission denied. Grant microphone permissions in system/browser settings.'
            }
            return { success: false, error: errorMessage }
        }
    }

    static async testMediaRecorder(): Promise<DebugResult> {
        try {
            this.log('Testing MediaRecorder functionality...')
            
            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                this.log('❌ MediaRecorder not supported in this browser')
                return { success: false, error: 'MediaRecorder not supported in this browser' }
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
                return { success: false, error: 'No supported audio codecs found. Try Chrome or Edge browser.' }
            }

            // Test actual recording
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream, { 
                mimeType: supportedCodecs[0]
            })

            let dataReceived = false
            let hasValidData = false
            const capturedDataInfo: { hasData: boolean, size: number, type: string } = {
                hasData: false,
                size: 0,
                type: 'unknown'
            }
            
            recorder.ondataavailable = (e) => {
                dataReceived = true
                capturedDataInfo.hasData = !!e.data
                capturedDataInfo.size = e.data?.size || 0
                capturedDataInfo.type = e.data?.type || 'unknown'
                hasValidData = !!e.data && e.data.size > 0
                this.log('✅ MediaRecorder data available', capturedDataInfo)
            }

            recorder.onerror = (error) => {
                this.log('❌ MediaRecorder error', error)
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

            if (dataReceived && hasValidData) {
                this.log('✅ MediaRecorder test successful - data was captured')
                return { 
                    success: true, 
                    details: { 
                        supportedCodecs, 
                        selectedCodec: supportedCodecs[0],
                        capturedData: capturedDataInfo
                    } 
                }
            } else {
                this.log('❌ MediaRecorder test failed - no data captured')
                return { success: false, error: 'MediaRecorder failed to capture audio data' }
            }

        } catch (error: any) {
            this.log('❌ MediaRecorder test failed', error)
            return { success: false, error: error.message }
        }
    }

    static async testIndexedDB(): Promise<DebugResult> {
        try {
            this.log('Testing IndexedDB functionality...')
            
            // Import db from services
            const { db } = await import('../services/db')
            
            // Test write
            const testBlob = new Blob(['test audio data for debugging'], { type: 'audio/webm' })
            const testChunk = {
                id: 'test-chunk-' + Date.now(),
                meetingId: 'test-meeting-debug',
                index: 0,
                blob: testBlob,
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
                return { 
                    success: true, 
                    details: { 
                        blobSize: retrieved.blob.size, 
                        blobType: retrieved.blob.type,
                        canReadWrite: true
                    } 
                }
            } else {
                this.log('❌ IndexedDB read test failed')
                return { success: false, error: 'Failed to read blob from IndexedDB' }
            }

        } catch (error: any) {
            this.log('❌ IndexedDB test failed', error)
            return { success: false, error: error.message }
        }
    }

    // Electron-specific tests
    static async testElectronAPIs(): Promise<DebugResult> {
        try {
            this.log('Testing Electron APIs...')
            
            // Enhanced Electron detection
            const hasElectronAPI = typeof window !== 'undefined' && (window as any).electronAPI
            const hasDesktopCapture = typeof window !== 'undefined' && (window as any).desktopCapture
            const hasProcess = typeof window !== 'undefined' && (window as any).process
            const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            
            this.log('Electron environment detection', {
                hasElectronAPI: !!hasElectronAPI,
                hasDesktopCapture: !!hasDesktopCapture,
                hasProcess: !!hasProcess,
                userAgentContainsElectron: userAgent.includes('Electron'),
                userAgent: userAgent
            })
            
            if (!hasElectronAPI) {
                this.log('❌ Not running in Electron environment')
                return { success: false, error: 'Not running in Electron - this app requires Electron for audio capture' }
            }
            
            const electronAPI = (window as any).electronAPI
            const desktopCapture = (window as any).desktopCapture
            
            if (!electronAPI) {
                this.log('❌ electronAPI not found - preload.js issue')
                return { success: false, error: 'electronAPI not found - check preload.js configuration' }
            }
            
            if (!desktopCapture) {
                this.log('❌ desktopCapture not found - preload.js issue')
                return { success: false, error: 'desktopCapture not found - check preload.js configuration' }
            }
            
            this.log('✅ Electron APIs available', {
                electronAPI: Object.keys(electronAPI),
                desktopCapture: !!desktopCapture
            })
            
            return { 
                success: true, 
                details: { 
                    environment: 'electron',
                    electronAPIs: true,
                    availableAPIs: Object.keys(electronAPI)
                } 
            }
            
        } catch (error: any) {
            this.log('❌ Electron API test failed', error)
            return { success: false, error: error.message }
        }
    }

    static async testDesktopAudio(): Promise<DebugResult> {
        try {
            this.log('Testing desktop audio capture...')
            
            // Check if we're in Electron environment
            if (typeof window === 'undefined' || !window) {
                this.log('ℹ️ Not in browser environment')
                return { success: true, details: { available: false, reason: 'Not in browser environment' } }
            }
            
            const desktopCapture = (window as any).desktopCapture
            this.log('Desktop capture object:', { exists: !!desktopCapture, type: typeof desktopCapture })
            
            if (!desktopCapture) {
                this.log('ℹ️ Desktop capture not available - not in Electron or not configured')
                return { success: true, details: { available: false, reason: 'Not in Electron environment' } }
            }
            
            if (typeof desktopCapture.getSources !== 'function') {
                this.log('❌ getSources method not available on desktopCapture', { 
                    desktopCaptureKeys: Object.keys(desktopCapture || {}),
                    getSourcesType: typeof desktopCapture.getSources
                })
                return { success: false, error: 'getSources method not available - check preload.js configuration' }
            }
            
            // First try to get audio-only sources
            let sources: any[] = []
            try {
                sources = await desktopCapture.getSources(['audio'])
                this.log('🎵 Audio-only sources found', sources.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    display_id: s.display_id
                })))
            } catch (audioSourceError) {
                this.log('⚠️ Failed to get audio-only sources', audioSourceError)
                sources = []
            }

            // If no audio-only sources, try screen sources that might have audio
            if (sources.length === 0) {
                try {
                    this.log('🔍 No audio-only sources found, checking screen sources for audio...')
                    const screenSources = await desktopCapture.getSources(['screen'])
                    this.log('🖥️ Screen sources found', screenSources.map((s: any) => ({
                        id: s.id,
                        name: s.name,
                        display_id: s.display_id
                    })))
                    sources = screenSources
                } catch (screenSourceError) {
                    this.log('❌ Failed to get screen sources', screenSourceError)
                    return { 
                        success: false, 
                        error: `Cannot access desktop sources: ${(screenSourceError as Error).message || 'Unknown error'}` 
                    }
                }
            }
            
            if (sources.length === 0) {
                this.log('❌ No desktop audio sources found')
                return { 
                    success: false, 
                    error: 'No desktop audio sources found. Enable "System Audio" in macOS Sound settings or "Stereo Mix" in Windows.' 
                }
            }
            
            this.log('✅ Desktop audio sources available')
                            // Test actual system audio capture
                if (sources.length > 0) {
                    this.log('🧪 Testing actual system audio capture...')
                    try {
                        const testSource = sources[0]
                        
                        // Try to capture system audio using the first available source
                        const systemStream = await (navigator.mediaDevices as any).getUserMedia({
                            audio: {
                                mandatory: {
                                    chromeMediaSource: 'desktop',
                                    chromeMediaSourceId: testSource.id
                                }
                            },
                            video: {
                                mandatory: {
                                    chromeMediaSource: 'desktop',
                                    chromeMediaSourceId: testSource.id
                                }
                            }
                        })

                        // Extract audio tracks and test for signal
                        const audioTracks = systemStream.getAudioTracks()
                        let hasSystemAudio = false
                        
                        if (audioTracks.length > 0) {
                            const audioContext = new AudioContext()
                            const source = audioContext.createMediaStreamSource(systemStream)
                            const analyser = audioContext.createAnalyser()
                            source.connect(analyser)
                            
                            const dataArray = new Uint8Array(analyser.frequencyBinCount)
                            
                            // Check for audio activity
                            await new Promise(resolve => setTimeout(resolve, 1000))
                            analyser.getByteFrequencyData(dataArray)
                            hasSystemAudio = dataArray.some(value => value > 0)
                            
                            // Cleanup
                            systemStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
                            audioContext.close()
                            
                            this.log(hasSystemAudio ? '✅ System audio signal detected' : '⚠️ No system audio signal detected')
                        }

                        return { 
                            success: true, 
                            details: { 
                                available: true,
                                sourceCount: sources.length,
                                sources: sources.map((s: any) => ({ id: s.id, name: s.name })),
                                captureTest: {
                                    testedSource: testSource.name,
                                    audioTracks: audioTracks.length,
                                    hasSignal: hasSystemAudio
                                }
                            } 
                        }
                    } catch (captureError: any) {
                        this.log('❌ System audio capture test failed', captureError)
                        return { 
                            success: false, 
                            error: `Found ${sources.length} sources but capture failed: ${captureError.message}`,
                            details: {
                                available: true,
                                sourceCount: sources.length,
                                sources: sources.map((s: any) => ({ id: s.id, name: s.name })),
                                captureError: captureError.message
                            }
                        }
                    }
                } else {
                    return { 
                        success: true, 
                        details: { 
                            available: true,
                            sourceCount: sources.length,
                            sources: sources.map((s: any) => ({ id: s.id, name: s.name }))
                        } 
                    }
                }
            
        } catch (error: any) {
            this.log('❌ Desktop audio test failed', error)
            return { success: false, error: error.message }
        }
    }

    static async runFullDiagnostic(): Promise<ComprehensiveResults> {
        this.log('🔧 Starting comprehensive audio recording diagnostic...')
        this.clearLogs() // Start fresh
        
        const results: ComprehensiveResults = {
            microphone: await this.testMicrophoneAccess(),
            mediaRecorder: await this.testMediaRecorder(),
            indexedDB: await this.testIndexedDB(),
            gamingHeadset: await this.testGamingHeadsetMicrophone(),
            logs: []
        }
        
        // Add Electron-specific tests if applicable
        const electronAPIs = await this.testElectronAPIs()
        if (electronAPIs.success && electronAPIs.details?.environment === 'electron') {
            results.electronAPIs = electronAPIs
            results.desktopAudio = await this.testDesktopAudio()
            results.electronAudioSources = await this.testElectronAudioSources()
        } else if (!electronAPIs.success) {
            // Still try to run Electron tests even if API detection failed
            results.electronAPIs = electronAPIs
            results.desktopAudio = await this.testDesktopAudio()
            results.electronAudioSources = await this.testElectronAudioSources()
        }
        
        results.logs = [...this.logs]
        this.log('🔧 Comprehensive diagnostic complete', {
            microphone: results.microphone.success,
            mediaRecorder: results.mediaRecorder.success,
            indexedDB: results.indexedDB.success,
            gamingHeadset: results.gamingHeadset?.success ?? 'N/A',
            electronAPIs: results.electronAPIs?.success ?? 'N/A',
            desktopAudio: results.desktopAudio?.success ?? 'N/A',
            electronAudioSources: results.electronAudioSources?.success ?? 'N/A'
        })
        
        return results
    }

    static generateRecommendations(results: ComprehensiveResults): string[] {
        const recommendations: string[] = []
        
        if (!results.microphone.success) {
            recommendations.push('🎤 Grant microphone permissions in system/browser settings')
            if (results.microphone.error?.includes('NotAllowedError')) {
                recommendations.push('   • macOS: System Preferences → Security & Privacy → Microphone')
                recommendations.push('   • Windows: Settings → Privacy → Microphone')
                recommendations.push('   • Browser: Click microphone icon in address bar')
            }
        }
        
        if (!results.mediaRecorder.success) {
            recommendations.push('📹 MediaRecorder issues:')
            if (results.mediaRecorder.error?.includes('not supported')) {
                recommendations.push('   • Use Chrome or Edge browser for best compatibility')
                recommendations.push('   • Update your browser to the latest version')
            } else {
                recommendations.push('   • Check if microphone is muted at hardware/system level')
                recommendations.push('   • Try restarting the browser/app')
            }
        }
        
        if (!results.indexedDB.success) {
            recommendations.push('💾 Database storage issues:')
            recommendations.push('   • Clear browser/app storage and try again')
            recommendations.push('   • Try incognito/private mode')
            recommendations.push('   • Disable browser extensions temporarily')
        }
        
        if (results.electronAPIs && !results.electronAPIs.success) {
            recommendations.push('🖥️ Electron configuration issues:')
            recommendations.push('   • Check preload.js is properly configured')
            recommendations.push('   • Verify contextBridge.exposeInMainWorld is working')
            recommendations.push('   • Restart the Electron app completely')
        }
        
        if (results.desktopAudio && !results.desktopAudio.success) {
            recommendations.push('🔊 System Audio Capture Issues (needed to record meeting participants):')
            recommendations.push('   📍 WITHOUT system audio, you only record your microphone, not others speaking!')
            recommendations.push('   ')
            recommendations.push('   🪟 Windows Setup:')
            recommendations.push('     1. Right-click sound icon in taskbar → Open Sound settings')
            recommendations.push('     2. Scroll down → More sound settings → Recording tab')
            recommendations.push('     3. Right-click empty area → Show Disabled Devices')
            recommendations.push('     4. Find "Stereo Mix" → Right-click → Enable')
            recommendations.push('     5. Set "Stereo Mix" as default recording device')
            recommendations.push('     6. Restart the Electron app')
            recommendations.push('   ')
            recommendations.push('   🍎 macOS Setup:')
            recommendations.push('     1. Install BlackHole audio driver: brew install blackhole-2ch')
            recommendations.push('     2. System Preferences → Sound → Output → BlackHole 2ch')
            recommendations.push('     3. Create Multi-Output Device in Audio MIDI Setup')
            recommendations.push('     4. Include both BlackHole and your speakers')
            recommendations.push('     5. Restart the Electron app')
            recommendations.push('   ')
            recommendations.push('   🐧 Linux Setup:')
            recommendations.push('     1. Install PulseAudio: sudo apt install pulseaudio pavucontrol')
            recommendations.push('     2. Run: pactl load-module module-loopback')
            recommendations.push('     3. Use pavucontrol to configure audio routing')
        }
        
        if (results.electronAudioSources) {
            if (!results.electronAudioSources.success) {
                recommendations.push('🖥️ Electron Audio Source Detection Failed:')
                recommendations.push('   • Check Electron app permissions')
                recommendations.push('   • Restart the Electron app completely')
                recommendations.push('   • Verify microphone and system audio permissions')
            } else if (results.electronAudioSources.details) {
                const details = results.electronAudioSources.details
                if (details.audioInputs === 0) {
                    recommendations.push('🎤 No Microphones Detected in Electron:')
                    recommendations.push('   • Check microphone is properly connected')
                    recommendations.push('   • Grant microphone permissions to the Electron app')
                    recommendations.push('   • Restart the Electron app after connecting microphone')
                }
                if (details.screenSources === 0) {
                    recommendations.push('🖥️ No Screen Audio Sources Available:')
                    recommendations.push('   • This is normal on some systems')
                    recommendations.push('   • System audio capture may still work through other methods')
                }
                if (!details.canCaptureDesktop && details.screenSources > 0) {
                    recommendations.push('🚫 Desktop Audio Capture Test Failed:')
                    recommendations.push('   • Electron may not have permission to capture desktop audio')
                    recommendations.push('   • Try running Electron app as administrator (Windows) or with sudo (macOS/Linux)')
                    recommendations.push('   • Check system privacy settings for screen recording permissions')
                }
            }
        }
        
        // Gaming headset specific recommendations
        if (results.gamingHeadset) {
            if (!results.gamingHeadset.success && results.gamingHeadset.details?.hasGamingHeadset !== false) {
                recommendations.push('🎮 GAMING HEADSET ISSUE (Logitech G935/G933s detected):')
                recommendations.push('   🚨 This is likely why you have no audio - gaming headsets have hardware mute!')
                recommendations.push('   ')
                recommendations.push('   ✅ IMMEDIATE FIXES:')
                recommendations.push('   1. Check HARDWARE mute button on your headset (usually on the left side)')
                recommendations.push('   2. Flip up the microphone boom arm (mic may auto-mute when flipped down)')
                recommendations.push('   3. Check Logitech G HUB software - mic may be muted there')
                recommendations.push('   4. Try unplugging and reconnecting the USB cable')
                recommendations.push('   5. In Windows Sound settings, set Logitech as default microphone')
                recommendations.push('   ')
                recommendations.push('   🔧 Logitech G HUB Software:')
                recommendations.push('   • Open Logitech G HUB → Select your headset')
                recommendations.push('   • Check microphone is not muted in software')
                recommendations.push('   • Adjust microphone sensitivity/gain if too low')
                recommendations.push('   • Test microphone in G HUB before using the app')
            }
        }

        // Success recommendations
        if (results.microphone.success && results.mediaRecorder.success && results.indexedDB.success) {
            if (!results.microphone.details?.hasAudioSignal) {
                recommendations.push('🚨 CRITICAL: No audio signal detected (this causes "No audio data found")')
                recommendations.push('   • Check system microphone is not muted in taskbar/system tray')
                recommendations.push('   • Increase microphone volume in system settings:')
                recommendations.push('     - Windows: Settings → System → Sound → Input → Device properties')
                recommendations.push('     - macOS: System Preferences → Sound → Input → Input volume')
                recommendations.push('   • Speak LOUDLY during recording - the microphone may have low sensitivity')
                recommendations.push('   • Try a different microphone/headset if available')
                recommendations.push('   • Check if other apps (Zoom, Discord, etc.) are using the microphone')
                recommendations.push('   • Restart the Electron app completely and try again')
            } else {
                recommendations.push('✅ All tests passed! Audio recording should work.')
                recommendations.push('   • If still having issues, check error messages in the app')
            }
        }
        
        return recommendations
    }

    // Electron-specific audio source enumeration
    static async testElectronAudioSources(): Promise<DebugResult> {
        try {
            this.log('Testing Electron audio sources...')
            
            const electronAPI = (window as any).electronAPI
            const desktopCapture = (window as any).desktopCapture
            
            if (!electronAPI || !desktopCapture) {
                return { success: false, error: 'Electron APIs not available' }
            }

            // Test microphone enumeration
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = devices.filter(device => device.kind === 'audioinput')
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
            
            this.log('🎤 Available audio devices', {
                inputs: audioInputs.map(d => ({ deviceId: d.deviceId, label: d.label })),
                outputs: audioOutputs.map(d => ({ deviceId: d.deviceId, label: d.label }))
            })

            // Test desktop audio sources
            let audioSources: any[] = []
            let screenSources: any[] = []
            
            try {
                audioSources = await desktopCapture.getSources(['audio'])
            } catch (error) {
                this.log('⚠️ Failed to get audio sources', error)
            }
            
            try {
                screenSources = await desktopCapture.getSources(['screen'])
            } catch (error) {
                this.log('⚠️ Failed to get screen sources', error)
            }
            
            this.log('🖥️ Desktop audio sources', {
                audioSources: audioSources.map((s: any) => ({ id: s.id, name: s.name })),
                screenSources: screenSources.map((s: any) => ({ id: s.id, name: s.name }))
            })

            // Test if we can actually capture from desktop
            let canCaptureDesktop = false
            if (screenSources.length > 0) {
                try {
                    const testStream = await (navigator.mediaDevices as any).getUserMedia({
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: screenSources[0].id
                            }
                        },
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: screenSources[0].id
                            }
                        }
                    })
                    
                    const audioTracks = testStream.getAudioTracks()
                    canCaptureDesktop = audioTracks.length > 0
                    
                    this.log('✅ Desktop audio capture test successful', {
                        audioTracks: audioTracks.length,
                        source: screenSources[0].name
                    })
                    
                    // Clean up
                    testStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
                } catch (error) {
                    this.log('❌ Desktop audio capture test failed', error)
                }
            }

            return {
                success: true,
                details: {
                    audioInputs: audioInputs.length,
                    audioOutputs: audioOutputs.length,
                    desktopAudioSources: audioSources.length,
                    screenSources: screenSources.length,
                    canCaptureDesktop,
                    sources: {
                        microphones: audioInputs.map(d => d.label || d.deviceId),
                        speakers: audioOutputs.map(d => d.label || d.deviceId),
                        desktop: audioSources.map((s: any) => s.name),
                        screens: screenSources.map((s: any) => s.name)
                    }
                }
            }
        } catch (error: any) {
            this.log('❌ Electron audio source test failed', error)
            return { success: false, error: error.message }
        }
    }

    static exportLogs(): string {
        return this.logs.join('\n')
    }

    static clearLogs(): void {
        this.logs = []
    }

    // Real-time recording debug monitor
    static startRecordingDebugMonitor(mediaRecorder: MediaRecorder, meetingId: string) {
        this.log('🔄 Starting real-time recording debug monitor', {
            meetingId: meetingId.slice(0, 8) + '...',
            recorderState: mediaRecorder.state,
            mimeType: mediaRecorder.mimeType
        })

        // Monitor data events
        const originalOnDataAvailable = mediaRecorder.ondataavailable
        mediaRecorder.ondataavailable = (e: BlobEvent) => {
            this.log('📊 MediaRecorder data event', {
                hasData: !!e.data,
                dataSize: e.data?.size || 0,
                dataType: e.data?.type || 'unknown',
                timestamp: new Date().toISOString()
            })

            if (e.data && e.data.size > 0) {
                this.log('✅ Valid audio data received', {
                    size: `${(e.data.size / 1024).toFixed(2)} KB`,
                    type: e.data.type
                })
            } else {
                this.log('❌ Empty or invalid audio data', {
                    hasData: !!e.data,
                    size: e.data?.size || 0
                })
            }

            // Call original handler
            if (originalOnDataAvailable) {
                originalOnDataAvailable.call(mediaRecorder, e)
            }
        }

        // Monitor state changes
        mediaRecorder.onstop = (e) => {
            this.log('⏹️ MediaRecorder stopped', {
                state: mediaRecorder.state,
                timestamp: new Date().toISOString()
            })
        }

        mediaRecorder.onstart = (e) => {
            this.log('▶️ MediaRecorder started', {
                state: mediaRecorder.state,
                timestamp: new Date().toISOString()
            })
        }

        mediaRecorder.onerror = (e) => {
            this.log('❌ MediaRecorder error', {
                error: e,
                state: mediaRecorder.state,
                timestamp: new Date().toISOString()
            })
        }
    }

    // Gaming headset specific troubleshooting
    static async testGamingHeadsetMicrophone(): Promise<DebugResult> {
        try {
            this.log('🎮 Testing gaming headset microphone...')
            
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = devices.filter(device => device.kind === 'audioinput')
            
            // Check for Logitech Gaming headset
            const logitechDevices = audioInputs.filter(device => 
                device.label.toLowerCase().includes('logitech') && 
                device.label.toLowerCase().includes('gaming')
            )
            
            this.log('🎧 Gaming headset detected', {
                totalMicrophones: audioInputs.length,
                logitechGamingDevices: logitechDevices.length,
                devices: logitechDevices.map(d => d.label)
            })

            if (logitechDevices.length > 0) {
                // Test the Logitech gaming headset specifically
                const headsetDevice = logitechDevices[0]
                
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            deviceId: { exact: headsetDevice.deviceId },
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    })
                    
                    // Test for audio signal with gaming headset
                    const audioContext = new AudioContext()
                    const source = audioContext.createMediaStreamSource(stream)
                    const analyser = audioContext.createAnalyser()
                    analyser.fftSize = 256
                    source.connect(analyser)
                    
                    const dataArray = new Uint8Array(analyser.frequencyBinCount)
                    
                    // Monitor for 3 seconds for gaming headset signal
                    let maxSignal = 0
                    let signalDetected = false
                    
                    for (let i = 0; i < 30; i++) {
                        await new Promise(resolve => setTimeout(resolve, 100))
                        analyser.getByteFrequencyData(dataArray)
                        const currentMax = Math.max(...dataArray)
                        maxSignal = Math.max(maxSignal, currentMax)
                        
                        if (currentMax > 0) {
                            signalDetected = true
                        }
                    }
                    
                    this.log('🎧 Gaming headset signal test', {
                        maxSignal,
                        signalDetected,
                        headsetModel: headsetDevice.label
                    })
                    
                    // Clean up
                    stream.getTracks().forEach(track => track.stop())
                    audioContext.close()
                    
                    return {
                        success: signalDetected,
                        details: {
                            headsetModel: headsetDevice.label,
                            maxSignal,
                            signalDetected,
                            recommendation: signalDetected ? 
                                'Gaming headset is working properly' :
                                'Gaming headset detected but no audio signal - check hardware mute button'
                        },
                        error: signalDetected ? undefined : 'No audio signal from gaming headset - likely hardware muted'
                    }
                } catch (error) {
                    return {
                        success: false,
                        error: `Failed to test gaming headset: ${(error as Error).message}`
                    }
                }
            } else {
                return {
                    success: true,
                    details: {
                        hasGamingHeadset: false,
                        recommendation: 'No gaming headset detected - standard microphone troubleshooting applies'
                    }
                }
            }
        } catch (error: any) {
            this.log('❌ Gaming headset test failed', error)
            return { success: false, error: error.message }
        }
    }

    // Check if there are any chunks saved for a meeting
    static async checkSavedChunks(meetingId: string): Promise<{
        chunkCount: number;
        totalSize: number;
        chunks: Array<{ index: number; size: number; type: string }>;
    }> {
        try {
            const { db } = await import('../services/db')
            const chunks = await db.chunks.where('meetingId').equals(meetingId).toArray()
            
            const chunkInfo = chunks.map(chunk => ({
                index: chunk.index,
                size: chunk.blob.size,
                type: chunk.blob.type
            }))

            const totalSize = chunks.reduce((sum, chunk) => sum + chunk.blob.size, 0)

            this.log('📁 Chunks saved in database', {
                meetingId: meetingId.slice(0, 8) + '...',
                chunkCount: chunks.length,
                totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
                chunks: chunkInfo
            })

            return {
                chunkCount: chunks.length,
                totalSize,
                chunks: chunkInfo
            }
        } catch (error) {
            this.log('❌ Failed to check saved chunks', error)
            return { chunkCount: 0, totalSize: 0, chunks: [] }
        }
    }
}

// Export types for use in components
export type { DebugResult, ComprehensiveResults }

// Global access for debugging
if (typeof window !== 'undefined') {
    (window as any).AudioDebugger = AudioDebugger
}
