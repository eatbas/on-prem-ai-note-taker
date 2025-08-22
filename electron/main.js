const { app, BrowserWindow, Tray, nativeImage, ipcMain } = require('electron')
const path = require('path')

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
			preload: path.join(__dirname, 'preload.js')
		},
		icon: path.join(__dirname, 'icon.png')
	})

	mainWindow.loadFile('frontend/index.html')
}

function createRecorderWindow() {
	recorderWindow = new BrowserWindow({
		width: 280,
		height: 60,
		frame: false,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		transparent: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js')
		}
	})

	recorderWindow.loadFile('electron/recorder-window.html')
	
	// Make the window draggable
	recorderWindow.setMovable(true)
	
	// Hide initially
	recorderWindow.hide()
}

function createTray() {
	const iconPath = path.join(__dirname, 'icon.png')
	let icon
	
	try {
		icon = nativeImage.createFromPath(iconPath)
	} catch (error) {
		// Create a simple icon if file not found
		icon = nativeImage.createFromPath(path.join(__dirname, 'default-icon.svg'))
	}
	
	tray = new Tray(icon)
	tray.setToolTip('On-Prem AI Note Taker')
	
	const contextMenu = require('electron').Menu.buildFromTemplate([
		{
			label: 'Open App',
			click: () => {
				if (mainWindow) {
					mainWindow.show()
					mainWindow.focus()
				}
			}
		},
		{
			label: 'Start Recording',
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
			label: 'Quit',
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
}

function updateTrayRecordingState(recording) {
	isRecording = recording
	if (tray) {
		const menu = tray.getContextMenu()
		const startRecordingItem = menu.getMenuItemById('start-recording')
		if (startRecordingItem) {
			startRecordingItem.label = recording ? 'Recording...' : 'Start Recording'
		}
		tray.setToolTip(recording ? 'Recording in progress...' : 'On-Prem AI Note Taker')
	}
}

app.whenReady().then(() => {
	createWindow()
	createRecorderWindow()
	createTray()
	
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
			createRecorderWindow()
			createTray()
		}
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

mainWindow.on('close', (event) => {
	if (!app.isQuiting) {
		event.preventDefault()
		mainWindow.hide()
		return false
	}
})

// IPC handlers for recording state
ipcMain.on('recording-state-changed', (event, recording) => {
	updateTrayRecordingState(recording)
	
	// Show/hide recorder window
	if (recorderWindow) {
		if (recording) {
			recorderWindow.show()
			// Start sending recording data updates
			startRecordingDataUpdates()
		} else {
			recorderWindow.hide()
			// Stop sending recording data updates
			stopRecordingDataUpdates()
		}
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
	}
})

// IPC handler for stop recording from recorder window
ipcMain.on('stop-recording', (event) => {
	if (mainWindow) {
		mainWindow.webContents.send('stop-recording')
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
		if (mainWindow && recorderWindow) {
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


