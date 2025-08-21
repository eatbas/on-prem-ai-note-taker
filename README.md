# 🎤 On-Prem AI Note Taker

> **Desktop application for AI-powered meeting transcription and summarization - 100% local, 100% private**

[![Project Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge)](https://github.com/eatbas/on-prem-ai-note-taker)
[![Platform](https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux-blue?style=for-the-badge)](https://github.com/eatbas/on-prem-ai-note-taker/releases)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[![Last Commit](https://img.shields.io/github/last-commit/eatbas/on-prem-ai-note-taker)](https://github.com/eatbas/on-prem-ai-note-taker/commits/main)
[![Issues](https://img.shields.io/github/issues/eatbas/on-prem-ai-note-taker)](https://github.com/eatbas/on-prem-ai-note-taker/issues)
[![Stars](https://img.shields.io/github/stars/eatbas/on-prem-ai-note-taker)](https://github.com/eatbas/on-prem-ai-note-taker/stargazers)

[![Electron](https://img.shields.io/badge/Electron-Desktop%20App-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)](https://www.sqlite.org/)
[![Ollama](https://img.shields.io/badge/Ollama-AI%20Models-FF6B6B?logo=ollama)](https://ollama.com/)

## 🎯 What We've Built

A complete desktop application that:
- ✅ **Records audio** from your microphone
- ✅ **Transcribes** using AI (Whisper)
- ✅ **Summarizes** using AI (Llama 3.1)
- ✅ **Stores everything locally** in SQLite database
- ✅ **Works offline** for viewing notes
- ✅ **No complex setup** - just download and run!

## ✨ Key Features

- 🎤 **One-click recording** - Just press "Start Recording"
- 📝 **Automatic transcription** - See text in real-time using Whisper AI
- 🤖 **AI summaries** - Get key points instantly with Llama 3.1
- 🔍 **Search everything** - Find any meeting by content
- 📊 **Dashboard view** - See all meetings at a glance
- 💾 **100% Private** - All data stays on your computer
- 🔒 **Secure** - Automatic authentication using your computer username
- 🌐 **VPS Integration** - AI processing on your private VPS

## 📦 For End Users: Just Download and Run!

### Windows Users:
1. Download: `OnPremNoteTaker-Setup-1.0.0.exe` from [Releases](https://github.com/eatbas/on-prem-ai-note-taker/releases)
2. Double-click to install
3. Launch from Start Menu
4. Start recording!

### Mac Users:
1. Download: `OnPremNoteTaker-1.0.0.dmg` from [Releases](https://github.com/eatbas/on-prem-ai-note-taker/releases)
2. Drag to Applications
3. Launch the app
4. Start recording!

### Linux Users:
1. Download: `OnPremNoteTaker-1.0.0.AppImage` from [Releases](https://github.com/eatbas/on-prem-ai-note-taker/releases)
2. Make it executable: `chmod +x OnPremNoteTaker-1.0.0.AppImage`
3. Run it!

## 🏗️ Architecture

```
Your Computer                    VPS (Cloud)
┌─────────────────┐            ┌──────────────┐
│ Desktop App     │            │ AI Services  │
│ ┌─────────────┐ │            │              │
│ │ React UI    │ │  Network   │ ┌──────────┐ │
│ │             │◄┼────────────┼►│ Ollama   │ │
│ └──────┬──────┘ │            │ └──────────┘ │
│        │        │            │              │
│ ┌──────▼──────┐ │            │ ┌──────────┐ │
│ │Python Backend│◄┼────────────┼►│ Whisper  │ │
│ │+ SQLite DB  │ │            │ └──────────┘ │
│ └─────────────┘ │            │              │
└─────────────────┘            └──────────────┘
```

### Components:
- **Desktop App**: Electron wrapper with React UI and Python backend
- **Local Storage**: SQLite database + local file storage
- **VPS Services**: Ollama (AI summaries) + Whisper (transcription)
- **No Cloud Storage**: Your recordings and notes never leave your computer

## 📁 What's Stored Where

**On Your Computer:**
- `~/.on-prem-ai-notes/notes.db` - All your meeting data
- `~/.on-prem-ai-notes/models/` - Whisper models
- `~/.on-prem-ai-notes/recordings/` - Audio files

**On VPS:**
- Ollama AI models
- Whisper service
- No user data is stored!

## 🔒 Security & Privacy

- ✅ **All data stays local** - meetings never leave your computer
- ✅ **Auto-authentication** - uses your computer username
- ✅ **SQLite database** - no external database needed
- ✅ **VPS only for processing** - audio sent, text returned, nothing saved

## 🛠️ For Developers: Build Your Own

### Quick Build (One Command)

**On Mac/Linux:**
```bash
./scripts/build-desktop-app.sh
```

**On Windows:**
```bash
scripts\build-desktop-app.bat
```

### What Happens:
1. Frontend is built for production
2. Backend is packaged with dependencies
3. Everything is bundled into Electron
4. Native installer is created

### Development Setup

1. **Set up VPS Services** (one-time setup):
```bash
# On your VPS
docker compose up -d --build
docker compose exec ollama ollama pull llama3.1:8b
```

2. **Build Desktop App**:
```bash
# Clone repository
git clone https://github.com/eatbas/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker

# Set VPS IP
echo "VPS_HOST=your.vps.ip.address" > .env

# Build desktop app
./scripts/build-desktop-app.sh
```

The installer will be in `electron/dist-electron/`

## 🚨 Common Issues & Fixes

### "Media devices not supported"
- The app needs HTTPS or localhost
- Grant microphone permissions when prompted
- Try using Chrome/Edge browser during development

### "Can't connect to backend"
- Make sure port 8001 is free: `lsof -i :8001`
- Check firewall settings
- Restart the app

### "VPS connection failed"
- Check your internet connection
- Verify VPS IP in `.env` file
- Ensure VPS services are running: `docker compose ps`

## 🎉 What's Changed from Traditional Setup

### Before (Complex Setup):
- Install Python, Node.js, dependencies
- Configure multiple .env files
- Run multiple terminals
- Complex deployment process

### After (Simple Desktop App):
- Download one file
- Install like any app
- Click to start
- Everything just works!

## 🚀 VPS Setup (For AI Services)

Your VPS runs the AI models (Ollama and Whisper) that power the transcription and summarization.

### Quick VPS Setup:
```bash
# On Ubuntu 22.04/24.04 VPS
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Clone and start services
git clone https://github.com/eatbas/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker
docker compose up -d --build

# Pull AI model
docker compose exec ollama ollama pull llama3.1:8b
```

That's it! Your VPS is ready. Note the IP address for the desktop app configuration.

## 📋 Project Structure

```
on-prem-ai-note-taker/
├── backend/          # Python FastAPI backend
├── frontend/         # React web UI
├── electron/         # Desktop app wrapper
├── scripts/          # Build and setup scripts
├── documents/        # Additional documentation
└── docker-compose.yml # VPS services configuration
```

## 🔧 Technical Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python + FastAPI + SQLAlchemy
- **Database**: SQLite (local storage)
- **Desktop**: Electron
- **AI Models**: Whisper (transcription) + Llama 3.1 (summarization)
- **Deployment**: Docker (VPS only)

## 💡 Tips & Best Practices

- **🎯 First Run**: Initial transcription downloads Whisper models (~1GB) - be patient!
- **🖥️ VPS Requirements**: Minimum 4GB RAM for AI models, 8GB recommended
- **🚀 Performance**: Transcription speed depends on VPS CPU power
- **🔒 Security**: Keep your VPS firewall configured to only allow necessary ports
- **📊 Storage**: Meeting data grows over time, monitor disk usage

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- [Ollama](https://ollama.com) - Local LLM inference
- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) - Fast speech recognition
- [FastAPI](https://fastapi.tiangolo.com) - Modern Python web framework
- [Electron](https://www.electronjs.org/) - Desktop app framework

---

<div align="center">

**Built with ❤️ for privacy-conscious professionals**

**Your meetings. Your data. Your control.**

**Vibe Coded with ❤️ via Cursor**

[![Download Latest Release](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge&logo=github)](https://github.com/eatbas/on-prem-ai-note-taker/releases)

</div>


