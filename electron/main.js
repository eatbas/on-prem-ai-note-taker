const { app, BrowserWindow, session, Menu, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')

// Configuration
const BACKEND_PORT = 8001
const FRONTEND_PORT = 5173
const isDev = !app.isPackaged

let mainWindow
let backendProcess

// Start the Python backend
function startBackend() {
	if (isDev) {
		console.log('🚀 Starting backend in development mode...')
		// In development, assume backend is started separately
		return
	}
	
	console.log('🚀 Starting embedded backend...')
	
	// Get the path to the Python executable
	const pythonPath = process.platform === 'win32' 
		? path.join(process.resourcesPath, 'backend', 'venv', 'Scripts', 'python.exe')
		: path.join(process.resourcesPath, 'backend', 'venv', 'bin', 'python')
	
	const backendPath = path.join(process.resourcesPath, 'backend')
	
	// Set environment variables for backend
	const env = {
		...process.env,
		APP_HOST: '127.0.0.1',
		APP_PORT: BACKEND_PORT,
		ALLOWED_ORIGINS: '*',
		OLLAMA_BASE_URL: `http://${process.env.VPS_IP || '95.111.244.159'}:11434`,
		OLLAMA_MODEL: 'llama3.1:8b',
		WHISPER_MODEL: 'base',
		WHISPER_COMPUTE_TYPE: 'auto',
		WHISPER_DOWNLOAD_ROOT: path.join(os.homedir(), '.on-prem-ai-notes', 'models'),
		BASIC_AUTH_USERNAME: 'electron',
		BASIC_AUTH_PASSWORD: 'electron-local',
		LOG_LEVEL: 'INFO'
	}
	
	// Start the backend process
	backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
		cwd: backendPath,
		env: env,
		stdio: 'pipe'
	})
	
	backendProcess.stdout.on('data', (data) => {
		console.log(`Backend: ${data}`)
	})
	
	backendProcess.stderr.on('data', (data) => {
		console.error(`Backend Error: ${data}`)
	})
	
	backendProcess.on('close', (code) => {
		console.log(`Backend process exited with code ${code}`)
		backendProcess = null
	})
}

// Create the main application window
function createWindow() {
	// Create the browser window
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: true
		},
		icon: path.join(__dirname, 'icon.png'), // Add an icon if available
		title: 'On-Prem AI Note Taker'
	})

	// Create application menu
	const template = [
		{
			label: 'File',
			submenu: [
				{ role: 'quit' }
			]
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' }
			]
		},
		{
			label: 'View',
			submenu: [
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'toggleDevTools' },
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' }
			]
		},
		{
			label: 'Help',
			submenu: [
				{
					label: 'About',
					click: () => {
						dialog.showMessageBox(mainWindow, {
							type: 'info',
							title: 'About',
							message: 'On-Prem AI Note Taker',
							detail: 'A secure, local-first AI-powered note-taking application.\n\nVersion: 1.0.0',
							buttons: ['OK']
						})
					}
				}
			]
		}
	]
	
	const menu = Menu.buildFromTemplate(template)
	Menu.setApplicationMenu(menu)
	
	// Load the app
	if (isDev) {
		// In development, load from Vite dev server
		mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`)
		mainWindow.webContents.openDevTools()
	} else {
		// In production, load from built files
		const indexPath = path.join(__dirname, 'dist', 'index.html')
		mainWindow.loadFile(indexPath)
	}
	
	// Wait for backend to be ready
	if (!isDev) {
		mainWindow.webContents.on('did-fail-load', () => {
			setTimeout(() => {
				mainWindow.reload()
			}, 1000)
		})
	}
	
	mainWindow.on('closed', () => {
		mainWindow = null
	})
}

// App event handlers
app.whenReady().then(() => {
	startBackend()
	
	// Give backend time to start
	setTimeout(() => {
		createWindow()
	}, isDev ? 0 : 3000)

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('before-quit', () => {
	// Clean up backend process
	if (backendProcess) {
		backendProcess.kill()
	}
})


