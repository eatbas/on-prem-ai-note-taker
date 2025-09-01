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
			console.log('🔊 Attempting system audio via desktopCapturer...')
			const { desktopCapturer } = require('electron')
			const sources = await desktopCapturer.getSources({
				types: ['screen'],
				thumbnailSize: { width: 0, height: 0 }
			})
			if (!sources || sources.length === 0) {
				throw new Error('No screen sources available')
			}
			const source = sources[0]
			console.log('🖥️ Using screen source:', source.name, source.id)
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					mandatory: {
						chromeMediaSource: 'desktop',
						chromeMediaSourceId: source.id
					}
				},
				video: {
					mandatory: {
						chromeMediaSource: 'desktop',
						chromeMediaSourceId: source.id
					}
				}
			})
			// Drop video tracks; keep audio only
			stream.getVideoTracks().forEach(t => t.stop())
			const audioTracks = stream.getAudioTracks()
			if (audioTracks.length > 0) {
				console.log('✅ System audio capture successful via desktop source:', {
					trackLabels: audioTracks.map(t => t.label)
				})
				return stream
			}
			throw new Error('No audio tracks on desktop stream')
		} catch (e1) {
			console.warn('⚠️ desktopCapturer path failed, falling back to getDisplayMedia:', e1)
			try {
				const stream = await navigator.mediaDevices.getDisplayMedia({
					video: true,
					audio: true
				})
				stream.getVideoTracks().forEach(t => t.stop())
				const audioTracks = stream.getAudioTracks()
				if (audioTracks.length > 0) {
					console.log('✅ System audio via getDisplayMedia fallback')
					return stream
				}
				throw new Error('No audio tracks on getDisplayMedia stream')
			} catch (e2) {
				console.log('⚠️ System audio not available (fallback to mic-only):', e2?.message || e2)
				return null
			}
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
