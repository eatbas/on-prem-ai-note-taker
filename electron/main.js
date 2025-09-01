const { app, BrowserWindow, Tray, nativeImage, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Global error handlers
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error)
	app.quit()
})

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason)
	app.quit()
})

let mainWindow
let floatingRecorderWindow
let tray
let isRecording = false

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			webSecurity: false, // Disable web security for development to bypass CORS
			allowRunningInsecureContent: false, // Don't allow insecure content by default
			experimentalFeatures: true, // Enable experimental web features
			// Enable system audio capture permissions
			enableWebCodecs: true,
			// Allow media access for audio recording
			media: true,
			// Enable clipboard access if needed
			enableClipboardRead: false
		},
		icon: path.join(__dirname, 'dgMeets-48.png')
	})

	// Try to load from dev server first (for development)
	const devServerUrl = 'http://localhost:5173'
	const frontendPath = path.join(__dirname, 'dist', 'index.html')
	
	console.log('🔍 Checking for dev server at:', devServerUrl)
	console.log('📁 Fallback path:', frontendPath)
	console.log('🌐 App will connect to VPS for AI services')
	
	// Check if dev server is running
	fetch(devServerUrl)
		.then(response => {
			if (response.ok) {
				console.log('✅ Dev server found!')
				console.log('🔥 Loading LIVE development version with latest changes!')
				mainWindow.loadURL(devServerUrl)
			} else {
				throw new Error('Dev server not responding')
			}
		})
		.catch(error => {
			console.log('❌ Dev server not available, trying built files:', error.message)
			
			// Check if the built frontend exists
			if (!fs.existsSync(frontendPath)) {
				console.error('❌ Frontend not built!')
				console.error('🚨 Run: ./scripts/start-electron-dev.sh to start dev server')
				// Create a simple error page
				mainWindow.loadURL('data:text/html,<html><body style="font-family:Arial;text-align:center;padding:50px;"><h1 style="color:red;">⚠️ Frontend Not Available</h1><p>Neither dev server nor built files found!</p><p><strong>Solution:</strong></p><ul style="text-align:left;max-width:500px;margin:0 auto;"><li>Run: <code>./scripts/start-electron-dev.sh</code></li><li>This will start the Vite dev server on port 5173</li></ul></body></html>')
				return
			}
			
			console.log('📦 Loading from built files:', frontendPath)
			console.log('⚠️ This may contain OLDER code - use dev server for latest changes!')
			console.log('💡 To get latest changes, run: ./scripts/start-electron-dev.sh')
			mainWindow.loadFile(frontendPath)
		})
	
	// Add error handling for page load
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
		console.error('Failed to load frontend:', errorCode, errorDescription, validatedURL)
	})
	
	// Add success logging
	mainWindow.webContents.on('did-finish-load', () => {
		console.log('✅ Frontend loaded successfully!')
		console.log('🔗 VPS connection configured at: http://95.111.244.159:8000/api')
		console.log('🎯 AI services (transcription, chat, summarization) will use VPS backend')
		console.log('📈 Centralized API management active - optimized polling enabled!')
	})
}



function createTray() {
	try {
		let icon
		
		try {
			// Try to load the 16px dgMeets icon for tray (works better in small sizes)
			icon = nativeImage.createFromPath(path.join(__dirname, 'dgMeets-16.png'))
		} catch (error) {
			console.error('Failed to load tray icon:', error)
			// Create a simple default icon if all else fails
			icon = nativeImage.createFromBuffer(Buffer.from('<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" fill="#00d9ff"/></svg>'))
		}
		
		tray = new Tray(icon)
		tray.setToolTip('dgMeets')
		
		const contextMenu = require('electron').Menu.buildFromTemplate([
			{
				label: '🚀 Open App',
				click: () => {
					if (mainWindow) {
						mainWindow.show()
						mainWindow.focus()
					}
				}
			},
			{
				id: 'start-recording',
				label: '🎙️ Start Recording',
				click: () => {
					if (mainWindow) {
						mainWindow.webContents.send('tray-action', 'start-recording')
					}
				}
			},
			{
				type: 'separator'
			},
			{
				label: '❌ Quit',
				click: () => {
					app.isQuiting = true
					app.quit()
				}
			}
		])
		
		tray.setContextMenu(contextMenu)
		
		tray.on('click', () => {
			if (mainWindow) {
				mainWindow.show()
				mainWindow.focus()
			}
		})
		
		console.log('Tray created successfully')
	} catch (error) {
		console.error('Failed to create tray:', error)
		// Don't fail the app if tray creation fails
		tray = null
	}
}

function updateTrayRecordingState(recording) {
	isRecording = recording
	if (tray) {
		try {
			// Rebuild the context menu with updated labels
			const contextMenu = require('electron').Menu.buildFromTemplate([
				{
					label: '🚀 Open App',
					click: () => {
						if (mainWindow) {
							mainWindow.show()
							mainWindow.focus()
						}
					}
				},
				{
					id: 'start-recording',
					label: recording ? '⏹️ Stop Recording' : '🎙️ Start Recording',
					click: () => {
						if (mainWindow) {
							if (recording) {
								// Send stop recording command
								mainWindow.webContents.send('tray-action', 'stop-recording')
							} else {
								// Send start recording command
								mainWindow.webContents.send('tray-action', 'start-recording')
							}
						}
					}
				},
				{
					type: 'separator'
				},
				{
					label: '❌ Quit',
					click: () => {
						app.isQuiting = true
						app.quit()
					}
				}
			])
			
			tray.setContextMenu(contextMenu)
			tray.setToolTip(recording ? '🎙️ Recording in progress...' : '🚀 dgMeets')
		} catch (error) {
			console.error('Error updating tray menu:', error)
		}
	}
}

function createFloatingRecorderWindow() {
	// Get primary display bounds
	const primaryDisplay = screen.getPrimaryDisplay()
	const { width, height } = primaryDisplay.workAreaSize
	
	// Position the floating recorder in the top-right corner initially
	const floatingWidth = 260
	const floatingHeight = 64
	const x = width - floatingWidth - 20
	const y = 20
	
	floatingRecorderWindow = new BrowserWindow({
		width: floatingWidth,
		height: floatingHeight,
		x: x,
		y: y,
		frame: false,
		resizable: false,
		movable: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			webSecurity: false, // Disable web security for development to bypass CORS
			allowRunningInsecureContent: false, // Don't allow insecure content by default
			experimentalFeatures: true, // Enable experimental web features
			// Allow media access for audio recording
			media: true
		},
		show: false, // Don't show until recording starts
		transparent: true, // Allow for rounded corners
		titleBarStyle: 'hidden',
		titleBarOverlay: false
	})

	// Load the floating recorder HTML
	const floatingRecorderPath = path.join(__dirname, 'floating-recorder.html')
	floatingRecorderWindow.loadFile(floatingRecorderPath)
	
	// Handle window close
	floatingRecorderWindow.on('closed', () => {
		floatingRecorderWindow = null
	})
	
	// Make window draggable
	floatingRecorderWindow.setMovable(true)
	
	console.log('🎙️ Floating recorder window created')
}

function showFloatingRecorder() {
	if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
		floatingRecorderWindow.show()
		console.log('🎙️ Floating recorder window shown')
	}
}

function hideFloatingRecorder() {
	if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
		floatingRecorderWindow.hide()
		console.log('🎙️ Floating recorder window hidden')
	}
}

function updateFloatingRecorderState(recording, meetingId, recordingTime) {
	if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
		const state = {
			isRecording: recording,
			meetingId: meetingId,
			recordingTime: recordingTime
		}
		floatingRecorderWindow.webContents.send('update-recording-state', state)
		console.log('🎙️ Updated floating recorder state:', state)
	}
}

function stopRecordingDataUpdates() {
	// This function can be used to stop any ongoing recording data updates
	console.log('🎙️ Stopping recording data updates')
}

app.whenReady().then(async () => {
	try {
		console.log('🚀 App is ready, creating windows...')
		console.log('📁 Current directory:', __dirname)
		console.log('🔗 VPS Backend: http://95.111.244.159:8000/api')
		console.log('👤 Auth User:', process.env.BASIC_AUTH_USERNAME || 'Not configured')
		console.log('🌐 Development Mode: Always connects to VPS for AI services')
		
		// Simplified audio capture (like Meeting Minutes and other AI note-takers)
		console.log('🎵 Enabling simple audio capture...')
		app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
		
		// Platform-specific audio optimization (minimal approach)
		if (process.platform === 'darwin') {
			// Only on macOS - enable system audio loopback
			app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudio')
		}
		
		// Test system audio capture capabilities
		try {
			const { testSystemAudioCapture } = require('./system-audio-test.js')
			await testSystemAudioCapture()
		} catch (error) {
			console.log('⚠️ System audio test failed:', error.message)
		}
		
		// Add request interceptor to handle CORS issues
		const { session } = require('electron')
		
		// Set permissions for system audio capture (more restrictive)
		session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
			const allowedPermissions = ['microphone', 'desktop-capture', 'media', 'camera']
			
			if (allowedPermissions.includes(permission)) {
				console.log(`✅ Granting permission: ${permission}`)
				callback(true)
			} else {
				console.log(`❌ Denying permission: ${permission}`)
				callback(false)
			}
		})

		// Handle permission check requests
		session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
			const allowedPermissions = ['microphone', 'desktop-capture', 'media', 'camera']
			return allowedPermissions.includes(permission)
		})

		// Set Content Security Policy for better security
		session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
			// Only apply CSP to main app, not external resources
			if (details.url.startsWith('http://localhost:5173') || details.url.startsWith('file://')) {
				const csp = [
					"default-src 'self' 'unsafe-inline' 'unsafe-eval'",
					"connect-src 'self' http://localhost:* http://95.111.244.159:8000 ws://localhost:*",
					"media-src 'self' blob: data:",
					"img-src 'self' data: blob:",
					"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
					"style-src 'self' 'unsafe-inline'"
				].join('; ')
				
				details.responseHeaders['Content-Security-Policy'] = [csp]
			}
			callback({ responseHeaders: details.responseHeaders })
		})
		
		// Intercept and modify requests to VPS (including from localhost dev server)
		session.defaultSession.webRequest.onBeforeSendHeaders(
			{ urls: ['http://95.111.244.159:8000/*', 'https://95.111.244.159:8000/*'] },
			(details, callback) => {
				console.log('🔧 Intercepting request from:', details.initiator, 'to:', details.url)
				
				// Set User-Agent to identify Electron app
				details.requestHeaders['User-Agent'] = 'ElectronApp/1.0'
				
				// Ensure auth header is present
				if (!details.requestHeaders['Authorization'] && 
					details.url.includes('95.111.244.159:8000/api')) {
					const username = process.env.BASIC_AUTH_USERNAME
					const password = process.env.BASIC_AUTH_PASSWORD
					
					if (!username || !password) {
						console.error('❌ Authentication credentials not configured!')
						return
					}
					const credentials = Buffer.from(`${username}:${password}`).toString('base64')
					details.requestHeaders['Authorization'] = `Basic ${credentials}`
					console.log('✅ Added authentication header')
				}
				
				// ALWAYS override Origin for Electron app (regardless of source)
				details.requestHeaders['Origin'] = 'electron://app'
				
				console.log('🔧 Modified request headers for:', details.url, 'Origin:', details.requestHeaders['Origin'])
				console.log('🔧 Request headers:', Object.keys(details.requestHeaders))
				callback({ requestHeaders: details.requestHeaders })
			}
		)
		
		// Handle response headers - let backend handle CORS properly
		session.defaultSession.webRequest.onHeadersReceived(
			{ urls: ['http://95.111.244.159:8000/*', 'https://95.111.244.159:8000/*'] },
			(details, callback) => {
				// Log response for debugging
				console.log('📡 Response received from:', details.url, 'Status:', details.statusCode)
				console.log('📡 Response headers:', Object.keys(details.responseHeaders))
				
				// Let the backend's CORS middleware handle everything properly
				callback({ responseHeaders: details.responseHeaders })
			}
		)
		
		createWindow()
		createFloatingRecorderWindow()
		createTray()
		
		console.log('All windows created successfully')
		
		// Set up mainWindow event listeners after it's created
		mainWindow.on('close', (event) => {
			if (!app.isQuiting) {
				event.preventDefault()
				mainWindow.hide()
				return false
			}
		})
		
		app.on('activate', () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				createWindow()
				createFloatingRecorderWindow()
				createTray()
			}
		})
	} catch (error) {
		console.error('Error during app initialization:', error)
		app.quit()
	}
})

// Add before-quit handler to properly handle recording when app closes
app.on('before-quit', (event) => {
	if (isRecording) {
		console.log('🎙️ App closing while recording - stopping recording and saving data...')
		event.preventDefault()
		
		// Stop recording data updates
		stopRecordingDataUpdates()
		
		// Stop the recording timer
		stopRecordingTimer()
		
		// Send stop recording command to main window if it exists and is not destroyed
		if (mainWindow && !mainWindow.isDestroyed()) {
			try {
				mainWindow.webContents.send('app-closing-stop-recording')
			} catch (error) {
				console.log('Main window already destroyed, skipping stop recording command')
			}
		}
		
		// Hide floating recorder window
		hideFloatingRecorder()
		
		// Wait a bit for the recording to stop, then quit
		setTimeout(() => {
			console.log('🎙️ Recording stopped, now quitting app...')
			app.isQuiting = true
			app.quit()
		}, 1000)
	}
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

// IPC handlers for recording state
ipcMain.on('recording-state-changed', (event, recording) => {
	try {
		console.log('Recording state changed:', recording)
		updateTrayRecordingState(recording)
		
		// Update floating recorder window if it exists
		if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
			updateFloatingRecorderState(recording, null, 0)
		}

		// Ensure floating recorder hides when recording stops
		if (!recording) {
			hideFloatingRecorder()
		}
	} catch (error) {
		console.error('Error updating tray recording state:', error)
	}
})

// IPC handlers for floating recorder
ipcMain.on('show-floating-recorder', (event, data) => {
	try {
		console.log('Show floating recorder requested:', data)
		showFloatingRecorder()
		updateFloatingRecorderState(data.isRecording, data.meetingId, data.recordingTime)
	} catch (error) {
		console.error('Error showing floating recorder:', error)
	}
})

ipcMain.on('recording-started', (event, data) => {
	try {
		console.log('Recording started:', data)
		isRecording = true
		updateTrayRecordingState(true)
		
		// Show and update floating recorder (respect preference)
		if (data?.showFloating !== false) {
			if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
				showFloatingRecorder()
				updateFloatingRecorderState(true, data.meetingId, 0)
			}
		}
	} catch (error) {
		console.error('Error handling recording started:', error)
	}
})

ipcMain.on('recording-stopped', (event, data) => {
	try {
		console.log('Recording stopped:', data)
		isRecording = false
		updateTrayRecordingState(false)
		
		// Hide floating recorder
		if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
			hideFloatingRecorder()
		}
	} catch (error) {
		console.error('Error handling recording stopped:', error)
	}
})

ipcMain.on('hide-floating-recorder', (event) => {
	try {
		console.log('Hide floating recorder requested')
		hideFloatingRecorder()
	} catch (error) {
		console.error('Error hiding floating recorder:', error)
	}
})

ipcMain.on('update-floating-recorder-state', (event, data) => {
	try {
		console.log('Update floating recorder state requested:', data)
		updateFloatingRecorderState(data.isRecording, data.meetingId, data.recordingTime)
	} catch (error) {
		console.error('Error updating floating recorder state:', error)
	}
})

ipcMain.on('stop-recording-from-floating', (event) => {
	try {
		console.log('Stop recording requested from floating recorder')
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send('stop-recording-from-floating')
		}
	} catch (error) {
		console.error('Error stopping recording from floating recorder:', error)
	}
})

// Mic selection from floating window -> forward to renderer
ipcMain.on('open-mic-selector-from-floating', () => {
	try {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send('open-mic-selector')
		}
	} catch (error) {
		console.error('Error forwarding mic selector open:', error)
	}
})





// IPC handlers for tray actions
ipcMain.on('tray-action', (event, action) => {
	if (action === 'start-recording' && mainWindow && !mainWindow.isDestroyed()) {
		try {
			mainWindow.webContents.send('tray-action', 'start-recording')
		} catch (error) {
			console.log('Main window destroyed, skipping tray action')
		}
	} else if (action === 'stop-recording' && mainWindow && !mainWindow.isDestroyed()) {
		try {
			mainWindow.webContents.send('tray-action', 'stop-recording')
		} catch (error) {
			console.log('Main window destroyed, skipping tray action')
		}
	}
})












