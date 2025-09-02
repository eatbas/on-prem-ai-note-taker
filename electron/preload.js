const { contextBridge, ipcRenderer } = require('electron')

// Environment variables are already loaded by main process
// Access them directly from process.env
console.log('🔧 Preload: Environment variables loaded by main process')
console.log('✅ Preload: BASIC_AUTH_USERNAME:', process.env.BASIC_AUTH_USERNAME ? 'SET' : 'NOT SET')
console.log('✅ Preload: BASIC_AUTH_PASSWORD:', process.env.BASIC_AUTH_PASSWORD ? 'SET' : 'NOT SET')

contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || process.env.USER || '')

contextBridge.exposeInMainWorld('BASIC_AUTH', {
	username: process.env.BASIC_AUTH_USERNAME,
	password: process.env.BASIC_AUTH_PASSWORD
})

// Always connect to VPS backend for AI services (both dev and production)
contextBridge.exposeInMainWorld('API_BASE_URL', 'http://95.111.244.159:8000/api')

// Log the API endpoint being used
console.log('🔗 Connecting to VPS backend at:', 'http://95.111.244.159:8000/api')

// Simplified audio capture API (like Meeting Minutes approach)
contextBridge.exposeInMainWorld('desktopCapture', {
	// Windows: capture system audio from desktop source (drop video), fallback to getDisplayMedia
	captureSystemAudio: async () => {
		try {
			console.log('🔊 Attempting system audio capture...')
			
			// Add comprehensive safety checks to prevent crashes
			if (!ipcRenderer || typeof ipcRenderer.send !== 'function') {
				console.log('⚠️ IPC not available, skipping system audio capture')
				return null
			}
			
			// Check if system audio is disabled
			if (localStorage.getItem('systemAudioDisabled') === 'true') {
				console.log('🚫 System audio capture disabled by user preference')
				return null
			}
			
			// Check if getDisplayMedia is available
			if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
				console.log('⚠️ getDisplayMedia not available, skipping system audio capture')
				return null
			}
			
			// Try system audio capture methods
			try {
				// Try getDisplayMedia first (most reliable method)
				try {
					console.log('🎯 Trying getDisplayMedia method...')
					
					// Add timeout to prevent hanging
					const displayMediaPromise = navigator.mediaDevices.getDisplayMedia({
						video: { cursor: 'never' },   // minimal video to unlock audio
						audio: {
							// @ts-ignore Chromium hint to prefer system audio if available
							systemAudio: 'include',
							channelCount: 2,
							sampleRate: 44100
						}
					})
					
					const timeoutPromise = new Promise((_, reject) => 
						setTimeout(() => reject(new Error('getDisplayMedia timeout')), 8000)
					)
					
					const stream = await Promise.race([displayMediaPromise, timeoutPromise])
					
					// Drop video tracks immediately after getting the stream
					stream.getVideoTracks().forEach(track => {
						console.log('🎥 Dropping video track:', track.label)
						track.stop()
					})
					
					const audioTracks = stream.getAudioTracks()
					if (audioTracks.length > 0) {
						console.log('✅ System audio capture successful via getDisplayMedia:', {
							trackLabels: audioTracks.map(t => t.label),
							trackCount: audioTracks.length
						})
						return stream
					}
					throw new Error('No audio tracks on getDisplayMedia stream')
				} catch (e1) {
					console.warn('⚠️ getDisplayMedia failed, trying desktopCapturer fallback:', e1)
					
					// Fallback to desktopCapturer method via IPC to main process
					try {
						console.log('🔄 Requesting desktopCapturer from main process...')
						
						// Send IPC request to main process to get desktop sources with timeout
						const sources = await new Promise((resolve, reject) => {
							const timeout = setTimeout(() => {
								console.log('⏰ IPC timeout - desktopCapturer request took too long')
								reject(new Error('IPC timeout'))
							}, 5000) // Increased timeout for IPC
							
							ipcRenderer.once('desktop-sources-response', (event, result) => {
								clearTimeout(timeout)
								if (result && result.success) {
									resolve(result.sources)
								} else {
									reject(new Error(result?.error || 'Unknown IPC error'))
								}
							})
							
							try {
								ipcRenderer.send('get-desktop-sources')
							} catch (ipcError) {
								clearTimeout(timeout)
								reject(new Error(`IPC send failed: ${ipcError.message}`))
							}
						})
						
						if (!sources || sources.length === 0) {
							throw new Error('No screen sources available')
						}
						
						const source = sources[0]
						console.log('🖥️ Using screen source:', source.name, source.id)
						
						// Request both video and audio for desktop capture, then drop video tracks
						const userMediaPromise = navigator.mediaDevices.getUserMedia({
							video: {
								mandatory: {
									chromeMediaSource: 'desktop',
									chromeMediaSourceId: source.id
								}
							},
							audio: {
								mandatory: {
									chromeMediaSource: 'desktop',
									chromeMediaSourceId: source.id
								}
							}
						})
						
						const userMediaTimeoutPromise = new Promise((_, reject) => 
							setTimeout(() => reject(new Error('getUserMedia timeout')), 5000)
						)
						
						const stream = await Promise.race([userMediaPromise, userMediaTimeoutPromise])
						
						// Drop video tracks to keep audio-only
						stream.getVideoTracks().forEach(track => {
							console.log('🎥 Dropping desktop video track:', track.label)
							track.stop()
						})
						
						const audioTracks = stream.getAudioTracks()
						if (audioTracks.length > 0) {
							console.log('✅ System audio capture successful via desktopCapturer:', {
								trackLabels: audioTracks.map(t => t.label)
							})
							return stream
						}
						throw new Error('No audio tracks on desktop stream')
					} catch (e2) {
						console.log('⚠️ desktopCapturer also failed:', e2)
						throw e2
					}
				}
			} catch (e3) {
				console.log('⚠️ All system audio capture methods failed (fallback to mic-only):', e3?.message || e3)
				return null
			}
		} catch (error) {
			console.log('⚠️ All system audio capture methods failed (fallback to mic-only):', error?.message || error)
			return null
		}
	}
})

// Expose IPC communication for tray and recording state
contextBridge.exposeInMainWorld('electronAPI', {
	// Send recording state to main process
	sendRecordingState: (recording) => {
		ipcRenderer.send('recording-state-changed', recording)
	},
	
	// Send recording started event
	sendRecordingStarted: (data) => {
		ipcRenderer.send('recording-started', data)
	},
	
	// Send recording stopped event
	sendRecordingStopped: (data) => {
		ipcRenderer.send('recording-stopped', data)
	},
	
	// Listen for tray actions from main process
	onTrayAction: (callback) => {
		ipcRenderer.on('tray-action', (event, action) => callback(action))
	},
	
	// Remove tray action listener
	removeTrayActionListener: () => {
		ipcRenderer.removeAllListeners('tray-action')
	},
	
	// Floating recorder controls
	showFloatingRecorder: (data) => {
		ipcRenderer.send('show-floating-recorder', data)
	},
	
	hideFloatingRecorder: () => {
		ipcRenderer.send('hide-floating-recorder')
	},
	
	updateFloatingRecorderState: (data) => {
		ipcRenderer.send('update-floating-recorder-state', data)
	},

	// Ask renderer to open mic selector from floating window
	openMicSelectorFromFloating: () => {
		ipcRenderer.send('open-mic-selector-from-floating')
	},
	
	// Subscribe to recording state updates (used by floating recorder window)
	onUpdateRecordingState: (callback) => {
		ipcRenderer.on('update-recording-state', (event, state) => callback(state))
	},

	// Renderer listens when floating window asks to stop
	onStopRecordingFromFloating: (callback) => {
		ipcRenderer.on('stop-recording-from-floating', () => callback())
	},
	removeStopRecordingFromFloatingListener: () => {
		ipcRenderer.removeAllListeners('stop-recording-from-floating')
	},

	// Renderer listens when floating window asks to open mic selector
	onOpenMicSelector: (callback) => {
		ipcRenderer.on('open-mic-selector', () => callback())
	},
	removeOpenMicSelectorListener: () => {
		ipcRenderer.removeAllListeners('open-mic-selector')
	},
	
	// Send stop command from floating recorder to main process
	stopRecordingFromFloating: () => {
		ipcRenderer.send('stop-recording-from-floating')
	},
	
	// Listen for app closing stop recording command
	onAppClosingStopRecording: (callback) => {
		ipcRenderer.on('app-closing-stop-recording', (event) => callback())
	},
	
	// Remove app closing stop recording listener
	removeAppClosingStopRecordingListener: () => {
		ipcRenderer.removeAllListeners('app-closing-stop-recording')
	}
})

// CORS debugging functionality  
contextBridge.exposeInMainWorld('corsDebug', {
	testConnection: async () => {
		try {
			const username = process.env.BASIC_AUTH_USERNAME
			const password = process.env.BASIC_AUTH_PASSWORD
			
			if (!username || !password) {
				throw new Error('Authentication credentials not configured in environment variables')
			}
			
			console.log('🔧 Testing CORS connection to VPS backend...')
			const response = await fetch('http://95.111.244.159:8000/api/health', {
				method: 'GET',
				headers: {
					'Authorization': 'Basic ' + btoa(`${username}:${password}`),
					'Content-Type': 'application/json'
					// Origin will be set automatically by browser/Electron
				}
			})
			
			console.log('🔧 CORS Test Response:', response.status, response.statusText)
			console.log('🔧 Response Headers:', [...response.headers.entries()])
			
			if (response.ok) {
				const data = await response.json()
				console.log('✅ CORS Test SUCCESS - Backend connection working!')
				console.log('🔧 Backend Data:', data)
				return { success: true, data }
			} else {
				console.log('❌ CORS Test FAILED - HTTP Error:', response.status)
				return { success: false, error: `HTTP ${response.status}` }
			}
		} catch (error) {
			console.error('❌ CORS Test FAILED - Network Error:', error)
			return { success: false, error: error.message }
		}
	}
})
