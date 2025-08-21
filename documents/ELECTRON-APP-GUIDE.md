# 🖥️ On-Prem AI Note Taker - Desktop App Guide

## 🎯 Overview

The On-Prem AI Note Taker is a secure, local-first desktop application that provides AI-powered transcription and summarization while keeping your data private.

## 📋 Architecture

```
┌─────────────────────────┐
│   Electron Desktop App  │
│  ┌─────────────────┐    │
│  │  React Frontend │    │
│  └────────┬────────┘    │
│           │             │
│  ┌────────▼────────┐    │
│  │  Local Backend  │    │
│  │   (Python)      │    │
│  └────────┬────────┘    │
└───────────┼─────────────┘
            │
            ▼
    ┌───────────────┐
    │  VPS Services │
    │  - Ollama AI  │
    │  - Whisper    │
    └───────────────┘
```

## 🚀 For End Users - Quick Start

### Option 1: Download Pre-built Application (Recommended)

1. **Download the installer:**
   - Windows: `OnPremNoteTaker-Setup-1.0.0.exe`
   - macOS: `OnPremNoteTaker-1.0.0.dmg`
   - Linux: `OnPremNoteTaker-1.0.0.AppImage`

2. **Install the application:**
   - Windows: Double-click the .exe file and follow the installer
   - macOS: Open the .dmg file and drag to Applications
   - Linux: Make the AppImage executable and run it

3. **Start using:**
   - Launch the application
   - Click "Start Recording" to begin
   - Your meetings are automatically saved locally

### Option 2: Build from Source

If you want to build the application yourself:

```bash
# Clone the repository
git clone https://github.com/yourusername/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker

# Build the Electron app
cd electron
npm install
npm run build:app

# The executable will be in electron/dist-electron/
```

## 🔧 For Developers

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Git

### Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker
```

2. **Set up the VPS IP:**
```bash
# Create .env file with your VPS IP
echo "VPS_HOST=95.111.244.159" > .env
```

3. **Start development mode:**
```bash
# Terminal 1: Start backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev

# Terminal 3: Start Electron
cd electron
npm install
npm run dev
```

### Building for Distribution

```bash
# Build for Windows
cd electron
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

## 📁 Data Storage

All your data is stored locally:
- **Database**: `~/.on-prem-ai-notes/notes.db`
- **Audio files**: `~/.on-prem-ai-notes/recordings/`
- **AI models**: `~/.on-prem-ai-notes/models/`

## 🔒 Security Features

- **Local-first**: All data stays on your computer
- **SQLite database**: No external database required
- **Automatic user**: Uses your computer username
- **VPS connection**: Only for AI processing
- **No cloud storage**: Your recordings never leave your device

## 🛠️ Configuration

The app can be configured through environment variables:

```bash
# VPS Configuration (optional)
VPS_HOST=your.vps.ip.address

# Local ports (optional)
BACKEND_PORT=8001
FRONTEND_PORT=5173
```

## 🎤 Features

- **Audio Recording**: Record meetings with one click
- **AI Transcription**: Automatic speech-to-text using Whisper
- **AI Summarization**: Get key points using Llama 3.1
- **Offline Mode**: Continue working without internet
- **Search**: Find meetings by content
- **Export**: Save as text or markdown

## 🔧 Troubleshooting

### App won't start
- Check if ports 8001 and 5173 are available
- Verify VPS is accessible
- Check firewall settings

### Recording issues
- Grant microphone permissions
- Check audio input device
- Try restarting the app

### Connection errors
- Verify VPS IP is correct
- Check network connection
- Ensure VPS services are running

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/yourusername/on-prem-ai-note-taker/issues)
- Documentation: [Read more](https://github.com/yourusername/on-prem-ai-note-taker/docs)

## 🚀 Next Steps

1. **Start recording** your first meeting
2. **Review transcriptions** in the dashboard
3. **Export summaries** for sharing
4. **Customize settings** as needed

---

**Version**: 1.0.0  
**License**: MIT  
**Privacy**: Your data never leaves your computer except for AI processing on your VPS
