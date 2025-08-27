const { contextBridge, ipcRenderer } = require('electron')

// Load environment variables from .env file
const path = require('path')
const envPath = path.join(__dirname, '..', '.env')
console.log('🔧 Preload: Loading .env from:', envPath)

try {
  require('dotenv').config({ path: envPath })
  console.log('✅ Preload: Environment variables loaded successfully')
} catch (error) {
  console.error('❌ Preload: Failed to load environment variables:', error)
}

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
			// Use the modern getDisplayMedia API which is more reliable
			const stream = await navigator.mediaDevices.getDisplayMedia({ 
				video: false, // We only need audio
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
					sampleRate: 16000 // Optimize for Whisper
				}
			})
			
			// Extract only audio tracks
			const audioTracks = stream.getAudioTracks()
			if (audioTracks.length === 0) {
				throw new Error('No audio tracks found in system audio capture')
			}
			
			// Create audio-only stream
			const audioStream = new MediaStream(audioTracks)
			
			console.log('✅ System audio captured successfully:', {
				trackCount: audioTracks.length,
				trackIds: audioTracks.map(t => t.id),
				enabled: audioTracks.map(t => t.enabled),
				muted: audioTracks.map(t => t.muted)
			})
			
			return audioStream
		} catch (error) {
			console.error('❌ Failed to capture system audio:', error)
			throw error
		}
	},
	
	// Fallback method using desktopCapturer for Electron-specific sources
	captureDesktopAudio: async () => {
		try {
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
			
			// Try to capture from the first available source
			for (const source of sources) {
				try {
					console.log(`🧪 Attempting to capture from: ${source.name}`)
					
					const stream = await navigator.mediaDevices.getUserMedia({
						audio: {
							mandatory: {
								chromeMediaSource: 'desktop',
								chromeMediaSourceId: source.id
							},
							echoCancellation: false,
							noiseSuppression: false,
							autoGainControl: false,
							sampleRate: 16000
						}
					})
					
					if (stream.getAudioTracks().length > 0) {
						console.log(`✅ Successfully captured desktop audio from: ${source.name}`)
						return stream
					}
				} catch (err) {
					console.log(`⚠️ Failed to capture from ${source.name}:`, err.message)
					continue
				}
			}
			
			throw new Error('No desktop audio sources could be captured')
		} catch (error) {
			console.error('❌ Desktop audio capture failed:', error)
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
					'Content-Type': 'application/json',
					'Origin': 'electron://app'
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
