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

// Create centralized environment file for Electron app
function createEnvironmentFiles() {
    console.log('🔧 Creating centralized environment file for Electron app...')
    
    // Load existing root .env if it exists
    const rootEnvPath = path.join(PROJECT_ROOT, '.env')
    let existingEnv = ''
    if (fs.existsSync(rootEnvPath)) {
        existingEnv = fs.readFileSync(rootEnvPath, 'utf8')
    }
    
    // Create/update root .env with Electron-specific overrides
    const electronEnv = `# Centralized Environment Configuration
# Auto-updated for Electron app

# === ELECTRON APP OVERRIDES ===
APP_HOST=127.0.0.1
APP_PORT=${BACKEND_PORT}
ALLOWED_ORIGINS=*
BASIC_AUTH_USERNAME=electron
BASIC_AUTH_PASSWORD=electron-local

# === VPS CONNECTION ===
VPS_HOST=${VPS_IP}
OLLAMA_BASE_URL=http://${VPS_IP}:11434

# === ELECTRON FRONTEND CONFIG ===
VITE_API_BASE_URL=http://localhost:${BACKEND_PORT}/api
VITE_BASIC_AUTH_USERNAME=electron
VITE_BASIC_AUTH_PASSWORD=electron-local

# === PERFORMANCE OPTIMIZED FOR LOCAL ===
WHISPER_MODEL=tiny
WHISPER_COMPUTE_TYPE=int8
WHISPER_DOWNLOAD_ROOT=./models
LOG_LEVEL=INFO
`
    
    // Append to existing env or create new
    const finalEnv = existingEnv ? existingEnv + '\n\n' + electronEnv : electronEnv
    fs.writeFileSync(rootEnvPath, finalEnv)
    
    console.log('✅ Centralized .env file updated at:', rootEnvPath)
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
