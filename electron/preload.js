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

// Expose desktop capture API for system audio recording
contextBridge.exposeInMainWorld('desktopCapture', {
	getSources: async (types) => {
		const { desktopCapturer } = require('electron')
		return await desktopCapturer.getSources({ types, fetchWindowIcons: false })
	},
	
	// Modern system audio capture using getDisplayMedia
	captureSystemAudio: async () => {
		try {
			console.log('🔊 Attempting automatic system audio capture (no user interaction)...')
			
			// First try: Audio-only capture (most seamless)
			try {
				const stream = await navigator.mediaDevices.getDisplayMedia({ 
					video: false, // Audio only
					audio: {
						echoCancellation: false,
						noiseSuppression: false,
						autoGainControl: false,
						sampleRate: 44100,
						channelCount: 2
					}
				})
				
				const audioTracks = stream.getAudioTracks()
				if (audioTracks.length > 0) {
					console.log('✅ System audio captured successfully (audio-only):', {
						trackCount: audioTracks.length,
						trackLabels: audioTracks.map(t => t.label),
						enabled: audioTracks.map(t => t.enabled)
					})
					return stream
				}
			} catch (err) {
				console.log('⚠️ Audio-only capture failed, trying with video...', err.message)
			}
			
			// Second try: Video + audio, then extract audio
			try {
				const stream = await navigator.mediaDevices.getDisplayMedia({ 
					video: true, // Include video to increase compatibility
					audio: {
						echoCancellation: false,
						noiseSuppression: false,
						autoGainControl: false,
						sampleRate: 44100,
						channelCount: 2
					}
				})
				
				const audioTracks = stream.getAudioTracks()
				const videoTracks = stream.getVideoTracks()
				
				// Stop video tracks immediately (we only need audio)
				videoTracks.forEach(track => track.stop())
				
				if (audioTracks.length > 0) {
					const audioStream = new MediaStream(audioTracks)
					console.log('✅ System audio captured successfully (video+audio):', {
						trackCount: audioTracks.length,
						trackLabels: audioTracks.map(t => t.label),
						enabled: audioTracks.map(t => t.enabled)
					})
					return audioStream
				}
			} catch (err) {
				console.log('⚠️ Video+audio capture failed:', err.message)
			}
			
			throw new Error('All getDisplayMedia methods failed')
		} catch (error) {
			console.error('❌ Failed to capture system audio via getDisplayMedia:', error)
			throw error
		}
	},
	
	// Fallback method using desktopCapturer for Electron-specific sources
	captureDesktopAudio: async () => {
		try {
			console.log('🔊 Attempting desktop capturer system audio (automatic)...')
			const { desktopCapturer } = require('electron')
			
			// Get all available sources
			const sources = await desktopCapturer.getSources({ 
				types: ['screen', 'window'], 
				fetchWindowIcons: false 
			})
			
			console.log('🔍 Available desktop sources:', sources.map(s => ({
				id: s.id,
				name: s.name,
				type: s.mediaType
			})))
			
			// Prioritize screen sources for better system audio capture
			const sortedSources = sources.sort((a, b) => {
				if (a.name.toLowerCase().includes('screen') && !b.name.toLowerCase().includes('screen')) return -1
				if (!a.name.toLowerCase().includes('screen') && b.name.toLowerCase().includes('screen')) return 1
				return 0
			})
			
			// Try to capture from each source automatically
			for (const source of sortedSources) {
				try {
					console.log(`🧪 Attempting automatic capture from: ${source.name}`)
					
					// Method 1: Modern constraints
					try {
						const stream = await navigator.mediaDevices.getUserMedia({
							audio: {
								deviceId: source.id,
								echoCancellation: false,
								noiseSuppression: false,
								autoGainControl: false,
								sampleRate: 44100,
								channelCount: 2
							}
						})
						
						if (stream.getAudioTracks().length > 0) {
							console.log(`✅ Successfully captured desktop audio (modern) from: ${source.name}`)
							return stream
						}
					} catch (err) {
						console.log(`⚠️ Modern method failed for ${source.name}:`, err.message)
					}
					
					// Method 2: Legacy chromeMediaSource
					try {
						const stream = await navigator.mediaDevices.getUserMedia({
							audio: {
								mandatory: {
									chromeMediaSource: 'desktop',
									chromeMediaSourceId: source.id
								},
								echoCancellation: false,
								noiseSuppression: false,
								autoGainControl: false,
								sampleRate: 44100
							}
						})
						
						if (stream.getAudioTracks().length > 0) {
							console.log(`✅ Successfully captured desktop audio (legacy) from: ${source.name}`)
							return stream
						}
					} catch (err) {
						console.log(`⚠️ Legacy method failed for ${source.name}:`, err.message)
					}
					
				} catch (err) {
					console.log(`⚠️ All methods failed for ${source.name}:`, err.message)
					continue
				}
			}
			
			throw new Error('No desktop audio sources could be captured with any method')
		} catch (error) {
			console.error('❌ Desktop audio capture failed:', error)
			throw error
		}
	},

	// Additional method: Try to find and use system loopback devices
	captureLoopbackAudio: async () => {
		try {
			console.log('🔊 Attempting to find system loopback audio devices...')
			
			// Get all audio input devices
			const devices = await navigator.mediaDevices.enumerateDevices()
			const audioInputs = devices.filter(device => device.kind === 'audioinput')
			
			console.log('🔍 Available audio input devices:', audioInputs.map(d => ({
				id: d.deviceId.slice(0, 20) + '...',
				label: d.label
			})))
			
			// Look for system audio / loopback devices
			const loopbackKeywords = [
				'stereo mix', 'what u hear', 'loopback', 'system audio', 
				'monitor', 'desktop audio', 'output mix', 'wave out mix',
				'speakers', 'headphones', 'system sound'
			]
			
			const loopbackDevices = audioInputs.filter(device => {
				const label = device.label.toLowerCase()
				return loopbackKeywords.some(keyword => label.includes(keyword))
			})
			
			console.log('🔍 Found potential loopback devices:', loopbackDevices.map(d => d.label))
			
			// Try each loopback device
			for (const device of loopbackDevices) {
				try {
					console.log(`🧪 Testing loopback device: ${device.label}`)
					
					const stream = await navigator.mediaDevices.getUserMedia({
						audio: {
							deviceId: { exact: device.deviceId },
							echoCancellation: false,
							noiseSuppression: false,
							autoGainControl: false,
							sampleRate: 44100,
							channelCount: 2
						}
					})
					
					if (stream.getAudioTracks().length > 0) {
						console.log(`✅ Successfully captured loopback audio from: ${device.label}`)
						return stream
					}
				} catch (err) {
					console.log(`⚠️ Loopback device failed ${device.label}:`, err.message)
				}
			}
			
			if (loopbackDevices.length === 0) {
				throw new Error('No loopback devices found. You may need to enable "Stereo Mix" in Windows sound settings.')
			} else {
				throw new Error('All loopback devices failed to capture audio')
			}
		} catch (error) {
			console.error('❌ Loopback audio capture failed:', error)
			throw error
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
