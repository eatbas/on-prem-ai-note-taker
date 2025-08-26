// Electron-Specific Audio Debug Commands
// Copy and paste in Electron app's DevTools console (Ctrl+Shift+I in Electron app)

console.log('🖥️ Electron Audio Recording Diagnostic');
console.log('=====================================');

// 1. Check if Electron APIs are available
console.log('🔧 Checking Electron APIs...');
if (window.electronAPI) {
    console.log('✅ electronAPI available:', Object.keys(window.electronAPI));
} else {
    console.error('❌ electronAPI not found - preload.js issue');
}

if (window.desktopCapture) {
    console.log('✅ desktopCapture available');
} else {
    console.error('❌ desktopCapture not found - preload.js issue');
}

// 2. Test system audio sources (Electron-specific)
async function testDesktopAudio() {
    try {
        console.log('🔧 Testing desktop audio capture...');
        if (!window.desktopCapture) {
            console.error('❌ Desktop capture API not available');
            return false;
        }
        
        const sources = await window.desktopCapture.getSources(['audio']);
        console.log('🎵 Available audio sources:', sources.map(s => ({
            id: s.id,
            name: s.name,
            display_id: s.display_id
        })));
        
        if (sources.length === 0) {
            console.error('❌ No audio sources found');
            console.log('🔧 Fix: Enable "System Audio" in macOS Sound settings or check Windows audio devices');
            return false;
        }
        
        console.log('✅ Desktop audio sources available');
        return true;
    } catch (error) {
        console.error('❌ Desktop audio test failed:', error);
        return false;
    }
}

// 3. Test microphone access (Electron context)
async function testElectronMicrophone() {
    try {
        console.log('🔧 Testing microphone in Electron...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        console.log('✅ Microphone access granted:', {
            tracks: stream.getAudioTracks().length,
            settings: stream.getAudioTracks()[0]?.getSettings?.() || 'Not available'
        });
        
        // Test if audio is actually flowing
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Check for audio activity
        setTimeout(() => {
            analyser.getByteFrequencyData(dataArray);
            const hasAudio = dataArray.some(value => value > 0);
            
            if (hasAudio) {
                console.log('✅ Audio signal detected');
            } else {
                console.warn('⚠️ No audio signal detected - microphone may be muted');
            }
            
            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            audioContext.close();
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('❌ Microphone test failed:', error);
        if (error.name === 'NotAllowedError') {
            console.log('🔧 Fix: Grant microphone permissions in system settings');
            console.log('   - macOS: System Preferences → Security & Privacy → Microphone');
            console.log('   - Windows: Settings → Privacy → Microphone');
        }
        return false;
    }
}

// 4. Test MediaRecorder in Electron
async function testElectronMediaRecorder() {
    try {
        console.log('🔧 Testing MediaRecorder in Electron...');
        
        if (!MediaRecorder) {
            console.error('❌ MediaRecorder not available in Electron');
            return false;
        }
        
        // Test codec support
        const codecs = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav'
        ];
        
        const supportedCodecs = codecs.filter(codec => MediaRecorder.isTypeSupported(codec));
        console.log('✅ Supported audio codecs in Electron:', supportedCodecs);
        
        // Test actual recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, {
            mimeType: supportedCodecs[0] || 'audio/webm'
        });
        
        let dataReceived = false;
        recorder.ondataavailable = (e) => {
            dataReceived = true;
            console.log('✅ MediaRecorder data in Electron:', {
                hasData: !!e.data,
                size: e.data?.size || 0,
                type: e.data?.type
            });
        };
        
        recorder.onerror = (error) => {
            console.error('❌ MediaRecorder error in Electron:', error);
        };
        
        recorder.start(1000);
        console.log('📹 MediaRecorder started in Electron, waiting 2 seconds...');
        
        setTimeout(() => {
            recorder.stop();
            stream.getTracks().forEach(track => track.stop());
            
            setTimeout(() => {
                if (dataReceived) {
                    console.log('✅ Electron MediaRecorder test successful');
                } else {
                    console.error('❌ No data received in Electron MediaRecorder');
                }
            }, 500);
        }, 2000);
        
        return true;
    } catch (error) {
        console.error('❌ Electron MediaRecorder test failed:', error);
        return false;
    }
}

// 5. Test IndexedDB in Electron
async function testElectronIndexedDB() {
    try {
        console.log('🔧 Testing IndexedDB in Electron...');
        
        // Open a test database
        const dbName = 'electron-audio-test';
        const request = indexedDB.open(dbName, 1);
        
        return new Promise((resolve, reject) => {
            request.onerror = () => {
                console.error('❌ IndexedDB failed in Electron:', request.error);
                reject(false);
            };
            
            request.onsuccess = () => {
                const db = request.result;
                console.log('✅ IndexedDB works in Electron');
                
                // Test blob storage
                const transaction = db.transaction(['test'], 'readwrite');
                const store = transaction.objectStore('test');
                
                const testBlob = new Blob(['test audio data'], { type: 'audio/webm' });
                const addRequest = store.add({
                    id: 'test-' + Date.now(),
                    blob: testBlob,
                    timestamp: Date.now()
                });
                
                addRequest.onsuccess = () => {
                    console.log('✅ Blob storage works in Electron IndexedDB');
                    db.close();
                    resolve(true);
                };
                
                addRequest.onerror = () => {
                    console.error('❌ Blob storage failed in Electron IndexedDB');
                    db.close();
                    resolve(false);
                };
            };
            
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('test')) {
                    db.createObjectStore('test', { keyPath: 'id' });
                }
            };
        });
    } catch (error) {
        console.error('❌ IndexedDB test failed in Electron:', error);
        return false;
    }
}

// 6. Run comprehensive Electron audio test
async function runElectronAudioDiagnostic() {
    console.log('🖥️ Running comprehensive Electron audio diagnostic...');
    console.log('=================================================');
    
    const results = {
        electronAPIs: !!(window.electronAPI && window.desktopCapture),
        desktopAudio: await testDesktopAudio(),
        microphone: await testElectronMicrophone(),
        mediaRecorder: await testElectronMediaRecorder(),
        indexedDB: await testElectronIndexedDB()
    };
    
    console.log('📊 Electron Audio Diagnostic Results:');
    console.log('=====================================');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    // Provide Electron-specific recommendations
    console.log('🔧 Electron-Specific Recommendations:');
    console.log('=====================================');
    
    if (!results.electronAPIs) {
        console.log('❌ Electron APIs missing:');
        console.log('   - Check preload.js is properly configured');
        console.log('   - Verify contextBridge.exposeInMainWorld is working');
        console.log('   - Restart the Electron app');
    }
    
    if (!results.desktopAudio) {
        console.log('❌ Desktop audio capture failed:');
        console.log('   - macOS: Enable "System Audio" in Sound preferences');
        console.log('   - Windows: Check "Stereo Mix" or similar is enabled');
        console.log('   - Linux: Install and configure PulseAudio');
    }
    
    if (!results.microphone) {
        console.log('❌ Microphone access failed:');
        console.log('   - Grant microphone permissions in system settings');
        console.log('   - macOS: System Preferences → Security & Privacy → Microphone');
        console.log('   - Windows: Settings → Privacy → Microphone');
        console.log('   - Check if microphone is not muted/disabled');
    }
    
    if (!results.mediaRecorder) {
        console.log('❌ MediaRecorder failed:');
        console.log('   - Update Electron to latest version');
        console.log('   - Check webPreferences in main.js');
        console.log('   - Try different audio codec');
    }
    
    if (!results.indexedDB) {
        console.log('❌ IndexedDB failed:');
        console.log('   - Clear Electron app data');
        console.log('   - Check userData directory permissions');
        console.log('   - Restart with --disable-web-security flag');
    }
    
    if (Object.values(results).every(r => r)) {
        console.log('🎉 All tests passed! Audio recording should work.');
        console.log('   If still having issues, check the specific error messages in the app.');
    }
    
    return results;
}

// Auto-run the diagnostic
console.log('🚀 Starting Electron audio diagnostic...');
runElectronAudioDiagnostic();

// Make functions available globally for manual testing
window.electronAudioDebug = {
    testDesktopAudio,
    testElectronMicrophone,
    testElectronMediaRecorder,
    testElectronIndexedDB,
    runElectronAudioDiagnostic
};

console.log('📋 Manual test functions available at: window.electronAudioDebug');
