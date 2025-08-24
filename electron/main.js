const { app, BrowserWindow, Tray, nativeImage, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

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
let tray
let recorderWindow
let isRecording = false
let recordingDataTimer = null

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			webSecurity: false // Allow loading local files
		},
		icon: path.join(__dirname, 'default-icon.svg')
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
				console.log('Dev server found, loading from:', devServerUrl)
				mainWindow.loadURL(devServerUrl)
			} else {
				throw new Error('Dev server not responding')
			}
		})
		.catch(error => {
			console.log('Dev server not available, trying built files:', error.message)
			
			// Check if the built frontend exists
			if (!fs.existsSync(frontendPath)) {
				console.error('Frontend not built! Please run "npm run build" in the frontend folder first.')
				// Create a simple error page
				mainWindow.loadURL('data:text/html,<html><body><h1>Frontend Not Built</h1><p>Please run "npm run build" in the frontend folder first.</p></body></html>')
				return
			}
			
			console.log('Loading from built files:', frontendPath)
			mainWindow.loadFile(frontendPath)
		})
	
	// Add error handling for page load
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
		console.error('Failed to load frontend:', errorCode, errorDescription, validatedURL)
	})
	
	// Add success logging
	mainWindow.webContents.on('did-finish-load', () => {
		console.log('✅ Frontend loaded successfully')
		console.log('🔗 VPS connection configured at: http://95.111.244.159:8000/api')
		console.log('🎯 AI services (transcription, chat, summarization) will use VPS backend')
	})
}

function createRecorderWindow() {
	recorderWindow = new BrowserWindow({
		width: 350,
		height: 100,
		frame: false,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		transparent: true,
		movable: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			webSecurity: false // Allow loading local files
		}
	})

	recorderWindow.loadFile(path.join(__dirname, 'recorder-window.html'))
	
	// Hide initially
	recorderWindow.hide()
	
	// Position the window in the top-right corner initially
	// Get screen size to ensure proper positioning
	const { screen } = require('electron')
	const primaryDisplay = screen.getPrimaryDisplay()
	const { width, height } = primaryDisplay.workAreaSize
	
	// Position in top-right with some padding
	const windowX = width - 370 // 350px width + 20px padding
	const windowY = 20 // 20px from top
	
	recorderWindow.setPosition(windowX, windowY)
	
	// Make the window draggable by clicking anywhere on it
	recorderWindow.setMovable(true)
	
	// Ensure window stays on screen
	recorderWindow.on('moved', () => {
		const [x, y] = recorderWindow.getPosition()
		const [w, h] = recorderWindow.getSize()
		
		// Check if window is going off screen
		if (x < 0) recorderWindow.setPosition(0, y)
		if (y < 0) recorderWindow.setPosition(x, 0)
		if (x + w > width) recorderWindow.setPosition(width - w, y)
		if (y + h > height) recorderWindow.setPosition(x, height - h)
	})
}

function createTray() {
	try {
		let icon
		
		try {
			// Try to load the default icon first
			icon = nativeImage.createFromPath(path.join(__dirname, 'default-icon.svg'))
		} catch (error) {
			console.error('Failed to load tray icon:', error)
			// Create a simple default icon if all else fails
			icon = nativeImage.createFromBuffer(Buffer.from('<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" fill="#007acc"/></svg>'))
		}
		
		tray = new Tray(icon)
		tray.setToolTip('On-Prem AI Note Taker')
		
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
			tray.setToolTip(recording ? '🎙️ Recording in progress...' : '🚀 On-Prem AI Note Taker')
		} catch (error) {
			console.error('Error updating tray menu:', error)
		}
	}
}

app.whenReady().then(() => {
	try {
		console.log('🚀 App is ready, creating windows...')
		console.log('📁 Current directory:', __dirname)
		console.log('🔗 VPS Backend: http://95.111.244.159:8000/api')
		console.log('👤 Auth User: myca')
		console.log('🌐 Development Mode: Always connects to VPS for AI services')
		
		createWindow()
		createRecorderWindow()
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
				createRecorderWindow()
				createTray()
			}
		})
	} catch (error) {
		console.error('Error during app initialization:', error)
		app.quit()
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
		
		// Note: Mini recorder window visibility is now controlled separately
		// via the set-mini-recorder-visible IPC handler
		if (recording) {
			// Start sending recording data updates
			startRecordingDataUpdates()
		} else {
			// Hide recorder window when recording stops
			if (recorderWindow) {
				recorderWindow.hide()
			}
			// Stop sending recording data updates
			stopRecordingDataUpdates()
		}
	} catch (error) {
		console.error('Error updating tray recording state:', error)
	}
})

// IPC handler for controlling mini recorder window visibility
ipcMain.on('set-mini-recorder-visible', (event, visible) => {
	try {
		console.log('Setting mini recorder visibility:', visible)
		if (recorderWindow) {
			if (visible) {
				recorderWindow.show()
			} else {
				recorderWindow.hide()
			}
		}
	} catch (error) {
		console.error('Error setting mini recorder visibility:', error)
	}
})

// IPC handlers for recording data updates
ipcMain.on('recording-data-update', (event, data) => {
	if (recorderWindow && data.recording) {
		recorderWindow.webContents.send('recording-data-update', data)
	}
})

// IPC handlers for tray actions
ipcMain.on('tray-action', (event, action) => {
	if (action === 'start-recording' && mainWindow) {
		mainWindow.webContents.send('tray-action', 'start-recording')
	} else if (action === 'stop-recording' && mainWindow) {
		mainWindow.webContents.send('tray-action', 'stop-recording')
	}
})

// IPC handler for stop recording from recorder window
ipcMain.on('stop-recording', (event) => {
	console.log('Stop recording requested from recorder window')
	if (mainWindow) {
		mainWindow.webContents.send('tray-action', 'stop-recording')
	}
})

// IPC handler for recording data response from main window
ipcMain.on('recording-data-response', (event, data) => {
	if (recorderWindow && data.recording) {
		recorderWindow.webContents.send('recording-data-update', data)
	}
})

// Function to send recording data to standalone window
function sendRecordingDataToStandalone(data) {
	if (recorderWindow && data.recording) {
		recorderWindow.webContents.send('recording-data-update', data)
	}
}

// Start sending recording data updates
function startRecordingDataUpdates() {
	if (recordingDataTimer) {
		clearInterval(recordingDataTimer)
	}
	
	recordingDataTimer = setInterval(() => {
		if (mainWindow && recorderWindow && isRecording) {
			// Request recording data from main window
			mainWindow.webContents.send('request-recording-data')
		}
	}, 100) // Update 10 times per second
}

// Stop sending recording data updates
function stopRecordingDataUpdates() {
	if (recordingDataTimer) {
		clearInterval(recordingDataTimer)
		recordingDataTimer = null
	}
}


