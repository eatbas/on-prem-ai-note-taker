/**
 * Unified Electron Desktop App Builder
 * Bundles frontend and backend into a single executable
 */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Configuration
const FRONTEND_PORT = 5173
const BACKEND_PORT = 8001
const VPS_IP = process.env.VPS_IP || '95.111.244.159'

// Paths
const PROJECT_ROOT = path.join(__dirname, '..')
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend')
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend')
const ELECTRON_DIR = __dirname

// Create environment files
function createEnvironmentFiles() {
    console.log('🔧 Creating environment files...')
    
    // Frontend .env.local
    const frontendEnv = `# Auto-generated for Electron app
VITE_API_BASE_URL=http://localhost:${BACKEND_PORT}/api
VITE_BASIC_AUTH_USERNAME=electron
VITE_BASIC_AUTH_PASSWORD=electron-local
`
    fs.writeFileSync(path.join(FRONTEND_DIR, '.env.local'), frontendEnv)
    
    // Backend .env.local
    const backendEnv = `# Auto-generated for Electron app
APP_HOST=127.0.0.1
APP_PORT=${BACKEND_PORT}
ALLOWED_ORIGINS=*
OLLAMA_BASE_URL=http://${VPS_IP}:11434
OLLAMA_MODEL=llama3.1:8b
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=auto
WHISPER_DOWNLOAD_ROOT=./models
BASIC_AUTH_USERNAME=electron
BASIC_AUTH_PASSWORD=electron-local
LOG_LEVEL=INFO
`
    fs.writeFileSync(path.join(BACKEND_DIR, '.env.local'), backendEnv)
}

// Build frontend for production
function buildFrontend() {
    console.log('🏗️ Building frontend...')
    return new Promise((resolve, reject) => {
        const npm = spawn('npm', ['run', 'build'], {
            cwd: FRONTEND_DIR,
            stdio: 'inherit',
            shell: true
        })
        npm.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Frontend build failed with code ${code}`))
        })
    })
}

// Install dependencies
async function installDependencies() {
    console.log('📦 Installing dependencies...')
    
    // Frontend dependencies
    await new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install'], {
            cwd: FRONTEND_DIR,
            stdio: 'inherit',
            shell: true
        })
        npm.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Frontend npm install failed with code ${code}`))
        })
    })
    
    // Electron dependencies
    await new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install'], {
            cwd: ELECTRON_DIR,
            stdio: 'inherit',
            shell: true
        })
        npm.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Electron npm install failed with code ${code}`))
        })
    })
}

// Main build function
async function buildElectronApp() {
    try {
        console.log('🚀 Building Electron Desktop App...')
        console.log(`📍 VPS IP: ${VPS_IP}`)
        
        // Create environment files
        createEnvironmentFiles()
        
        // Install dependencies
        await installDependencies()
        
        // Build frontend
        await buildFrontend()
        
        // Copy built frontend to electron directory
        const frontendDist = path.join(FRONTEND_DIR, 'dist')
        const electronDist = path.join(ELECTRON_DIR, 'dist')
        
        // Remove old dist if exists
        if (fs.existsSync(electronDist)) {
            fs.rmSync(electronDist, { recursive: true })
        }
        
        // Copy new dist
        fs.cpSync(frontendDist, electronDist, { recursive: true })
        
        console.log('✅ Frontend built and copied')
        
        // Build Electron app
        console.log('📦 Building Electron executable...')
        const electronBuilder = spawn('npm', ['run', 'build:win'], {
            cwd: ELECTRON_DIR,
            stdio: 'inherit',
            shell: true
        })
        
        electronBuilder.on('close', (code) => {
            if (code === 0) {
                console.log('🎉 Electron app built successfully!')
                console.log('📁 Check the dist folder for your executable')
            } else {
                console.error('❌ Electron build failed with code', code)
            }
        })
        
    } catch (error) {
        console.error('❌ Build failed:', error)
        process.exit(1)
    }
}

// Run the build
buildElectronApp()
