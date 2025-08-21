# Desktop App Configuration Guide 🖥️

## Setup Instructions

Your VPS backend is now running at: **http://95.111.244.159:8000**

### 1. On Your Local Computer

Navigate to the project root and create a `.env` file:

```bash
cd on-prem-ai-note-taker
```

Create `.env` with:
```env
# Point to your VPS backend
VPS_HOST=95.111.244.159

# Your VPS credentials (must match VPS .env file)
BASIC_AUTH_USERNAME=your_username
BASIC_AUTH_PASSWORD=your_password

# Optional: AI Model Settings
WHISPER_MODEL=base
OLLAMA_MODEL=llama3.1:8b
```

### 2. Build Desktop App

```bash
# Install dependencies and build everything
./scripts/build-desktop-app.sh
```

The script will:
- ✅ Build React frontend for production
- ✅ Package Python backend with dependencies
- ✅ Create Electron desktop application
- ✅ Generate native installer for your platform

### 3. Install and Test

Find your installer in `electron/dist-electron/` and install it. The app will:
- Connect to your VPS backend for AI processing
- Store all data locally on your computer
- Work offline for viewing existing notes

### 4. VPS Status

Your VPS services are running:
- ✅ **Backend**: http://95.111.244.159:8000 (FastAPI + Whisper)
- ✅ **Ollama**: http://95.111.244.159:11434 (LLM service)

### 5. Optional: Pull Ollama Model

On your VPS, you can pull a model for better performance:
```bash
docker compose exec ollama ollama pull llama3.1:8b
```

## Architecture

```
Local Computer (Desktop App) ←→ VPS (Backend + Ollama)
     Electron + React              Port 8000 + 11434
```

The desktop app runs locally and stores all data locally, while AI processing happens on your VPS! 🚀

## Development Workflow

### Make Changes:
1. Edit files in `frontend/src/` or `backend/app/`
2. Test in development mode if needed
3. Rebuild: `./scripts/build-desktop-app.sh`
4. Install and test new version

### Development Mode (Optional):
```bash
# Run components separately for development
cd frontend && npm run dev          # Port 5173
cd backend && python -m uvicorn app.main:app --reload --port 8001
cd electron && npm run dev
```

## What You Get

- 🖥️ **Native Desktop App** - Looks and feels like a real application
- 🚀 **Standalone Executable** - No need to open browser or run commands
- 👤 **User Identity** - Automatically detects your computer username
- 📱 **System Integration** - Desktop shortcuts, taskbar, notifications
- 🔒 **Offline Capable** - Works even without internet connection
- 🌐 **Cross-Platform** - Windows, macOS, and Linux support
