# Desktop App Architecture

## Overview
The On-Prem AI Note Taker desktop app uses a **client-server architecture** where the desktop app is a lightweight frontend that connects to your VPS backend for AI services.

## Architecture

```
┌─────────────────┐    HTTP/API    ┌─────────────────┐
│   Desktop App   │ ──────────────→ │   VPS Backend   │
│   (Frontend)    │                 │   (Python)      │
│                 │ ←────────────── │                 │
└─────────────────┘                └─────────────────┘
         │                                   │
         │                                   │
         │                                   ▼
         │                          ┌─────────────────┐
         │                          │   VPS Ollama    │
         │                          │   (AI Model)    │
         │                          └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Local Storage  │
│  (Notes, Audio) │
└─────────────────┘
```

## What's Included

### Desktop App (Frontend Only)
✅ **React Frontend** - User interface and local data management  
✅ **Electron Wrapper** - Native desktop application  
✅ **Local Storage** - Notes, audio files, and user preferences  
✅ **VPS Connection** - API calls to your VPS backend  

### VPS Server (Backend)
✅ **Python Backend** - FastAPI server handling requests  
✅ **Ollama Service** - AI model for chat and summarization  
✅ **Whisper Service** - Audio transcription  
✅ **Database** - User data and meeting storage  
✅ **File Storage** - Audio files and processed content  

## What's NOT Included

❌ **No Python Backend** in desktop app  
❌ **No AI Models** in desktop app  
❌ **No Database** in desktop app  
❌ **No Heavy Dependencies** in desktop app  

## Benefits

🚀 **Lightweight** - Desktop app is small and fast  
🔒 **Secure** - AI processing happens on your VPS  
💾 **Efficient** - No duplicate backend services  
🌐 **Scalable** - Multiple users can use same VPS  
📱 **Portable** - Desktop app works on any machine  

## Development vs Production

### Development Mode
- Frontend runs locally with hot reload
- Connects to VPS backend
- No local Python needed

### Production Build
- Frontend is built and bundled
- Packaged as native desktop app
- Still connects to VPS backend
- No local Python needed

## File Structure

```
on-prem-ai-note-taker/
├── frontend/           # React app (goes into desktop app)
├── electron/           # Electron wrapper (desktop app)
├── backend/            # Python backend (stays on VPS)
├── scripts/
│   ├── start-electron-dev.bat    # Start development
│   └── build-desktop-app.bat     # Build production app
└── documents/          # Documentation
```

## Usage

1. **Development**: Run `scripts/start-electron-dev.bat`
2. **Production**: Run `scripts/build-desktop-app.bat`
3. **Desktop App**: Installs and runs independently
4. **VPS Required**: Backend must be running on VPS

## Why This Architecture?

- **Separation of Concerns**: Frontend and backend are separate
- **Resource Efficiency**: No duplicate services
- **Security**: AI processing on controlled VPS
- **Maintenance**: Update backend once, affects all clients
- **Scalability**: Multiple desktop apps can use same VPS

## Troubleshooting

If the desktop app can't connect to VPS:
1. Check VPS is running: `http://95.111.244.159:8000/api/health`
2. Check Ollama is running on VPS: Port 11434
3. Verify firewall settings on VPS
4. Check authentication credentials

The desktop app is designed to be simple and lightweight - it just needs to connect to your VPS!
