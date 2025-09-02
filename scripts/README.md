# 🚀 Tauri Desktop App Scripts

This directory contains automation scripts for your **offline-first AI note taker**.

## 📋 Available Scripts

### 🔧 Development Scripts

#### `./start-tauri-dev.sh`
**Primary development script** - Use this to start and test your app!

```bash
./scripts/start-tauri-dev.sh
```

**What it does:**
- ✅ Validates environment (Node.js, Rust, Tauri CLI)
- ✅ Installs dependencies automatically
- ✅ Tests compilation (Rust + TypeScript)
- ✅ Launches the desktop app in development mode
- ✅ Sets up proper environment variables
- ✅ Provides helpful status messages

---

#### `./test-tauri-app.sh`
**Comprehensive testing script** - Validates everything works correctly

```bash
./scripts/test-tauri-app.sh
```

**What it tests:**
- 🌍 Environment setup
- 📦 Dependencies
- 🔨 Compilation (Rust + TypeScript)
- ⚙️ Configuration files
- 🎯 Feature implementation
- ✨ Code quality
- 🔒 Security
- 🧹 Cleanup verification

---

#### `./build-tauri-app.sh`
**Production build script** - Creates distributable app

```bash
./scripts/build-tauri-app.sh
```

**What it builds:**
- 🖥️ **macOS**: `.app` bundle + `.dmg` installer
- 🐧 **Linux**: `.deb` package + `.AppImage`
- 🪟 **Windows**: `.msi` + `.exe` installers

---

### 🧹 Cleanup Scripts

#### `./cleanup-vps-whisper.sh`
**VPS cleanup script** - Removes old Whisper services from your VPS

```bash
# Run this on your VPS after uploading
./scripts/cleanup-vps-whisper.sh
```

---

## 🎯 Quick Start Guide

### 1. **First Time Setup**
```bash
# Test everything works
./scripts/test-tauri-app.sh

# Start development
./scripts/start-tauri-dev.sh
```

### 2. **Daily Development**
```bash
# Just start the app
./scripts/start-tauri-dev.sh
```

### 3. **Build for Production**
```bash
# Create distributable app
./scripts/build-tauri-app.sh
```

---

## 🎉 Features Included

Your app includes these **enterprise-grade features**:

✅ **Native System Audio Capture** - Direct OS-level audio access  
✅ **Local Whisper Large-v3 AI** - Maximum accuracy transcription  
✅ **Speaker Diarization** - Automatic speaker identification  
✅ **English/Turkish Support** - Optimized language detection  
✅ **CPU/GPU Auto-Detection** - Works on any laptop  
✅ **Offline-First Design** - No internet required for transcription  
✅ **VPS Integration** - AI summarization via your backend  

---

## 🛠️ Troubleshooting

### Common Issues:

**"Command not found: cargo"**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**"Node.js not found"**
```bash
# Install Node.js (use nvm for version management)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

**"Tauri CLI not found"**
```bash
# Install Tauri CLI
cargo install tauri-cli
```

**"Port 5173 in use"**
- The script automatically handles this
- Or manually: `lsof -ti:5173 | xargs kill -9`

---

## 🎯 Script Features

### ✅ **Smart Validation**
- Checks all required tools
- Validates configurations
- Tests compilation before starting

### ✅ **Automatic Setup**
- Installs missing dependencies
- Creates .env from template
- Handles port conflicts

### ✅ **Helpful Output**
- Color-coded status messages
- Clear error descriptions
- Progress indicators

### ✅ **Production Ready**
- Optimized builds
- Security validation
- Cross-platform support

---

**Your offline-first AI note taker is ready to run! 🎉**
