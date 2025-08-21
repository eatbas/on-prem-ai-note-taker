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
git clone https://github.com/eatbas/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker

# Set your VPS credentials
echo "VPS_HOST=your.vps.ip.address" > .env
echo "BASIC_AUTH_USERNAME=your_username" >> .env
echo "BASIC_AUTH_PASSWORD=your_password" >> .env

# Build the desktop app (one command)
./scripts/build-desktop-app.sh

# The installer will be in electron/dist-electron/
```

## 🔧 For Developers

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Git

### Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/eatbas/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker
```

2. **Set up the VPS credentials:**
```bash
# Create .env file with your VPS credentials
echo "VPS_HOST=your.vps.ip.address" > .env
echo "BASIC_AUTH_USERNAME=your_username" >> .env
echo "BASIC_AUTH_PASSWORD=your_password" >> .env
```

3. **Build and test:**
```bash
# Build the desktop app
./scripts/build-desktop-app.sh

# Install and test the app
# Find installer in electron/dist-electron/
```

### Alternative: Development Mode

For active development, you can run components separately:

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
# Build for your platform (recommended)
./scripts/build-desktop-app.sh

# Or build manually
cd electron
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
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
# VPS Configuration (required)
VPS_HOST=your.vps.ip.address
BASIC_AUTH_USERNAME=your_username
BASIC_AUTH_PASSWORD=your_password

# Optional: AI Model Settings
WHISPER_MODEL=base
OLLAMA_MODEL=llama3.1:8b
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
- Check if the app built successfully
- Verify VPS credentials in `.env` file
- Check firewall settings

### Recording issues
- Grant microphone permissions
- Check audio input device
- Try restarting the app

### Connection errors
- Verify VPS IP is correct in `.env`
- Check network connection
- Ensure VPS services are running

### Build issues
- Check Node.js version (18+ required)
- Check Python version (3.8+ required)
- Verify all dependencies are installed
- Check VPS credentials are correct

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/eatbas/on-prem-ai-note-taker/issues)
- Documentation: [Read more](documents/)

## 🚀 Next Steps

1. **Build your desktop app**: `./scripts/build-desktop-app.sh`
2. **Install and test** the application
3. **Start recording** your first meeting
4. **Review transcriptions** in the dashboard
5. **Export summaries** for sharing

---

**Version**: 1.0.0  
**License**: MIT  
**Privacy**: Your data never leaves your computer except for AI processing on your VPS
