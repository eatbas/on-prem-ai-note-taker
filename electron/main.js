const { app, BrowserWindow, session, Menu, dialog, protocol } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')

// Register a secure custom protocol so packaged app can use getUserMedia
protocol.registerSchemesAsPrivileged([
	{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

// Configuration
const BACKEND_PORT = 8001
const FRONTEND_PORT = 5173
const isDev = !app.isPackaged

let mainWindow
let backendProcess

// Skip local backend - using VPS backend instead
function startBackend() {
	if (isDev) {
		console.log('🚀 Starting backend in development mode...')
		// In development, assume backend is started separately
		return
	}
	
	console.log('🚀 Using VPS backend at 95.111.244.159:8000')
	console.log('📦 Skipping local backend startup')
}

// Create the main application window
function createWindow() {
	// Create the browser window with responsive design
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 800,
		minHeight: 600,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: true,
			enableRemoteModule: false
		},
		icon: path.join(__dirname, 'icon.png'), // Add an icon if available
		title: 'On-Prem AI Note Taker',
		show: false, // Don't show until ready
		backgroundColor: '#ffffff'
	})

	// Show window when ready to prevent visual flash
	mainWindow.once('ready-to-show', () => {
		mainWindow.show()
		mainWindow.focus()
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
		console.log(`🌐 Loading frontend from Vite dev server: http://localhost:${FRONTEND_PORT}`)
		mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`)
		mainWindow.webContents.openDevTools()
	} else {
		// In production, serve from app:// protocol to satisfy secure context for mic
		const indexPath = path.join(process.resourcesPath, 'dist', 'index.html')
		console.log(`📁 Registering app:// protocol to serve: ${indexPath}`)
		
		if (!fs.existsSync(indexPath)) {
			console.error(`❌ Frontend file not found at: ${indexPath}`)
			dialog.showErrorBox('Frontend Error', `Frontend files not found at:\n${indexPath}`)
			return
		}
		
		try {
			protocol.registerFileProtocol('app', (request, callback) => {
				try {
					const url = new URL(request.url)
					let pathname = decodeURIComponent(url.pathname)
					if (process.platform === 'win32' && pathname.startsWith('/')) {
						pathname = pathname.slice(1)
					}
					const filePath = path.normalize(path.join(process.resourcesPath, 'dist', pathname))
					callback({ path: filePath })
				} catch (e) {
					console.error('Protocol handler error:', e)
					callback({ error: -2 })
				}
			})
		} catch (e) {
			console.error('Failed to register app protocol:', e)
		}

		mainWindow.loadURL('app://-/index.html')
	}
	
	// Handle loading errors
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
		console.error(`❌ Frontend failed to load: ${errorDescription} (${errorCode})`)
		console.error(`URL: ${validatedURL}`)
		
		if (!isDev) {
			// In production, show error dialog
			dialog.showErrorBox('Loading Error', 
				`Failed to load the application:\n\n` +
				`Error: ${errorDescription}\n` +
				`Code: ${errorCode}\n\n` +
				`Please try restarting the app or rebuilding it.`
			)
		}
	})
	
	// Handle successful load
	mainWindow.webContents.on('did-finish-load', () => {
		console.log('✅ Frontend loaded successfully')
	})
	
	mainWindow.on('closed', () => {
		mainWindow = null
	})
}

// App event handlers
app.whenReady().then(() => {
	startBackend()

	// Expose VPS backend API base to renderer (used by preload.js)
	process.env.APP_PORT = String(BACKEND_PORT)
	process.env.API_BASE_URL = `http://95.111.244.159:8000/api`
	
	// Auto-allow microphone and desktop capture permissions for our app
	try {
		const sess = session.defaultSession
		sess.setPermissionRequestHandler((webContents, permission, callback) => {
			if (permission === 'media' || permission === 'desktop-capture') {
				return callback(true)
			}
			return callback(false)
		})
	} catch (e) {
		console.error('Failed to set permission handler:', e)
	}
	
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


