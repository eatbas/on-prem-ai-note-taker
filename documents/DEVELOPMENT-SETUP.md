# Development Setup Guide

## Overview
The On-Prem AI Note Taker is designed to **always connect to the VPS backend** for AI services, whether running in development or production mode. This ensures consistent behavior and eliminates the need to run a local backend.

## Key Principle
> **"Always VPS First"** - The app never tries to run a local backend. All AI services (transcription, chat, summarization) are handled by the VPS.

## Development Environment

### 1. Environment Configuration
The development environment is configured to connect to the VPS at `http://95.111.244.159:8000/api`

**Environment Variables:**
- `VITE_API_BASE_URL=http://95.111.244.159:8000/api`
- `VITE_BASIC_AUTH_USERNAME=myca`
- `VITE_BASIC_AUTH_PASSWORD=wj2YyxrJ4cqcXgCA`
- `VITE_DEBUG=true`

### 2. Starting Development

#### Option A: Use the Development Script (Recommended)
```bash
scripts\start-electron-dev.bat
```

This script:
- ✅ Sets up environment variables for VPS connection
- ✅ Builds the frontend
- ✅ Starts Electron in development mode
- ✅ Ensures connection to VPS backend

#### Option B: Manual Setup
```bash
# 1. Set up environment
scripts\dev-env.bat

# 2. Build frontend
cd frontend
npm run build
cd ..

# 3. Start Electron
cd electron
npm start
cd ..
```

### 3. What Happens in Development Mode

1. **Frontend Build**: Creates a production build in `frontend/dist/`
2. **Electron Loads**: Loads the built frontend files
3. **VPS Connection**: App automatically connects to VPS backend
4. **AI Services**: All AI operations use VPS (transcription, chat, etc.)
5. **Local Storage**: Meeting data is stored locally in `%USERPROFILE%\.on-prem-ai-notes\`

## Architecture

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   Your Local    │    │   VPS Backend      │    │   AI Services   │
│   Computer      │◄──►│   (95.111.244.159) │◄──►│   (Ollama,      │
│                 │    │                     │    │    Whisper)     │
│ ┌─────────────┐ │    │ ┌─────────────────┐ │    ┌─────────────────┐
│ │   Electron  │ │    │ │   FastAPI       │ │    │ • Transcription │
│ │   App       │ │    │ │   Backend       │ │    │ • Chat/LLM      │
│ │             │ │    │ │                 │ │    │ • Summarization │
│ │ ┌─────────┐ │ │    │ │ • User Auth     │ │    │ • Audio Proc    │
│ │ │Frontend │ │ │    │ │ • File Upload   │ │    └─────────────────┘
│ │ │(React)  │ │ │    │ │ • AI Processing │ │
│ │ └─────────┘ │ │    │ └─────────────────┘ │
│ └─────────────┘ │    └─────────────────────┘ │
└─────────────────┘                            └─────────────────┘
```

## Benefits of This Approach

### ✅ **Consistency**
- Same behavior in development and production
- No local backend configuration needed
- Predictable API endpoints

### ✅ **Simplicity**
- One backend to maintain (VPS)
- No local Python environment setup
- No local database configuration

### ✅ **Performance**
- VPS has dedicated resources
- Faster AI processing
- Better model availability

### ✅ **Collaboration**
- Team members use same backend
- Shared user accounts and data
- Consistent API behavior

## Troubleshooting

### Issue: "Cannot connect to VPS"
**Solution:**
1. Check your internet connection
2. Verify VPS is running: `http://95.111.244.159:8000/health`
3. Check firewall settings
4. Verify VPS credentials in environment

### Issue: "Authentication failed"
**Solution:**
1. Verify username/password in environment
2. Check VPS backend authentication settings
3. Ensure credentials match VPS `.env` file

### Issue: "Frontend not loading"
**Solution:**
1. Run `npm run build` in frontend directory
2. Check `frontend/dist/` folder exists
3. Verify Electron can access the dist folder

## Development Workflow

1. **Start Development**: `scripts\start-electron-dev.bat`
2. **Make Changes**: Edit frontend code in `frontend/src/`
3. **Rebuild**: Frontend automatically rebuilds
4. **Test**: App connects to VPS for AI services
5. **Iterate**: Repeat steps 2-4

## Environment Files

### Frontend Environment
- **Location**: `frontend/.env.local` (if needed)
- **Purpose**: Override VPS connection settings
- **Note**: Usually not needed, preload.js handles this

### Electron Environment
- **Location**: Set by development scripts
- **Purpose**: Ensure VPS connection in Electron
- **Handled**: Automatically by `start-electron-dev.bat`

## Summary

The development setup ensures that:
- 🔗 **Always connects to VPS** for AI services
- 🚀 **No local backend** required
- 📱 **Consistent behavior** between dev and production
- 🛠️ **Simple setup** with automated scripts
- 🔒 **Secure authentication** with VPS backend

This approach eliminates the complexity of running multiple backends and ensures your development environment matches production exactly.
