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
	
	// Get the path to the Python executable - try system Python first
	let pythonPath = 'python3'
	if (process.platform === 'win32') {
		pythonPath = 'python'
	}
	
	// Check if Python is available
	const { execSync } = require('child_process')
	try {
		execSync(`${pythonPath} --version`, { stdio: 'pipe' })
	} catch (error) {
		console.error('❌ Python not found. Please install Python 3.8+')
		dialog.showErrorBox('Python Required', 'Please install Python 3.8 or later from python.org')
		return
	}
	
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
	
	// Install Python dependencies if needed
	try {
		console.log('📦 Checking Python dependencies...')
		
		// Check if key dependencies are already installed
		try {
			execSync(`${pythonPath} -c "import fastapi, uvicorn, sqlalchemy, aiosqlite"`, {
				cwd: backendPath,
				env: env,
				stdio: 'pipe'
			})
			console.log('✅ Dependencies already installed, skipping installation')
		} catch (importError) {
			console.log('📦 Installing Python dependencies...')
			
			// First, upgrade pip to avoid compatibility issues
			console.log('🔄 Upgrading pip...')
			execSync(`${pythonPath} -m pip install --upgrade pip`, {
				cwd: backendPath,
				env: env,
				stdio: 'pipe'
			})
			
			// Install dependencies with verbose output and user flag
			console.log('📦 Installing required packages...')
			execSync(`${pythonPath} -m pip install --user -r ${path.join(backendPath, 'requirements.txt')}`, {
				cwd: backendPath,
				env: env,
				stdio: 'pipe'
			})
			
			console.log('✅ Dependencies installed successfully')
		}
	} catch (error) {
		console.error('❌ Failed to install dependencies:', error.message)
		
		// Try alternative installation method
		try {
			console.log('🔄 Trying alternative installation method...')
			execSync(`${pythonPath} -m pip install --user fastapi uvicorn sqlalchemy aiosqlite python-multipart`, {
				cwd: backendPath,
				env: env,
				stdio: 'pipe'
			})
			console.log('✅ Core dependencies installed with alternative method')
		} catch (altError) {
			console.error('❌ Alternative installation also failed:', altError.message)
			
			// Show detailed error dialog
			dialog.showErrorBox('Python Dependency Error', 
				`Failed to install Python dependencies.\n\n` +
				`Error: ${error.message}\n\n` +
				`Please ensure:\n` +
				`1. You have internet connection\n` +
				`2. Python 3.8+ is properly installed\n` +
				`3. You have write permissions to install packages\n\n` +
				`You can also try installing manually:\n` +
				`pip3 install fastapi uvicorn sqlalchemy aiosqlite python-multipart`
			)
			return
		}
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
		// In production, load from bundled dist files
		const indexPath = path.join(process.resourcesPath, 'dist', 'index.html')
		console.log(`📁 Loading frontend from: ${indexPath}`)
		
		// Check if the file exists
		if (fs.existsSync(indexPath)) {
			mainWindow.loadFile(indexPath)
		} else {
			console.error(`❌ Frontend file not found at: ${indexPath}`)
			// Show error dialog
			dialog.showErrorBox('Frontend Error', 
				`Frontend files not found at:\n${indexPath}\n\n` +
				`This usually means the app wasn't built correctly.\n` +
				`Please rebuild the app using:\n` +
				`./scripts/build-desktop-app.sh`
			)
			return
		}
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


