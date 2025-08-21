# 🎤 On-Prem AI Note Taker

> **End-to-end, fully local AI-powered note-taking application with speech-to-text and intelligent summarization**

[![Project Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge)](https://github.com/eatbas/on-prem-ai-note-taker)
[![Last Commit](https://img.shields.io/github/last-commit/eatbas/on-prem-ai-note-taker)](https://github.com/eatbas/on-prem-ai-note-taker/commits/main)
[![Issues](https://img.shields.io/github/issues/eatbas/on-prem-ai-note-taker)](https://github.com/eatbas/on-prem-ai-note-taker/issues)
[![Stars](https://img.shields.io/github/stars/eatbas/on-prem-ai-note-taker)](https://github.com/eatbas/on-prem-ai-note-taker/stargazers)

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-Frontend-blue?logo=react)](https://reactjs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-LLM-orange?logo=ollama)](https://ollama.com/)

## ✨ Features

- 🎙️ **Audio/Video Transcription** - Powered by faster-whisper
- 🤖 **AI Summarization** - Intelligent meeting notes via Ollama LLM
- 🔄 **One-Click Processing** - Transcribe + Summarize in a single action
- 📱 **Offline-First Design** - Record locally, sync when online
- 🏷️ **Smart Organization** - Tags, search, and meeting management
- 🛡️ **100% Private** - All processing happens on your infrastructure
- 🌐 **VPS Ready** - Deploy backend on VPS, frontend locally

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Local Frontend│    │   VPS Backend   │    │   Ollama LLM    │
│   (React + Vite)│◄──►│   (FastAPI)     │◄──►│   (Local Model) │
│   Port 5173     │    │   Port 8000     │    │   Port 11434    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │  Desktop App    │
            │   (Electron)    │
            │   Windows .exe  │
            └─────────────────┘
```

- **`backend/`**: FastAPI API with speech-to-text and LLM integration
- **`frontend/`**: React single-page app with offline capabilities
- **`ollama/`**: Local LLM service for intelligent summarization
- **`electron/`**: Desktop application wrapper for Windows/macOS/Linux

## 📁 **Project Structure**

```
on-prem-ai-note-taker/
├── 📱 frontend/            ← React web application
├── 🖥️ electron/            ← Desktop app wrapper
├── 🚀 backend/             ← FastAPI server
├── 🤖 ollama/              ← LLM service
├── 📚 documents/           ← Complete documentation
├── 🐍 py/                  ← Python utilities
└── 📋 Configuration files
```

## 🚀 Quick Start

### **Option 1: VPS Backend + Local Frontend (Recommended)**
```bash
# 1. Clone repository
git clone <your-repo-url>
cd on-prem-ai-note-taker

# 2. Start VPS backend
docker compose up -d --build

# 3. Set up local frontend
cd frontend
npm install
npm run dev

# 4. Create desktop app (optional)
cd ../electron
npm install
npm run dev          # Development mode
npm run build:win    # Build Windows installer
```

### **Option 2: Everything Local**
```bash
# Start all services locally
docker compose up -d --build
```

### **Option 3: Desktop App Only**
```bash
# Build standalone desktop application
cd electron
npm install
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 📚 **📖 Detailed Documentation**

For comprehensive setup guides, troubleshooting, and advanced configuration, see the **[`documents/`](documents/) folder**:

- **[🚀 Quick Start Guide](documents/03-QUICK-START.md)** - Get running in 3 simple steps
- **[💻 Frontend Setup](documents/02-FRONTEND-SETUP.md)** - Local computer configuration
- **[🖥️ Backend Management](documents/01-BACKEND-SETUP.md)** - VPS service management
- **[🖥️ Desktop App Creation](documents/04-ELECTRON-SETUP.md)** - Build Windows .exe
- **[🎮 Easy Launchers](documents/README.md)** - One-click startup scripts

## 🔧 API Endpoints

- **`/api/transcribe`** — Audio/video transcription
- **`/api/summarize`** — Text summarization
- **`/api/transcribe-and-summarize`** — Combined processing
- **`/api/health`** — Service health check

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [📚 Documentation](#-documentation)
- [🔧 API Endpoints](#-api-endpoints)
- [🐳 Docker Quickstart](#-docker-quickstart)
- [💻 Local Development](#-local-development)
- [☁️ VPS Installation](#️-vps-installation)
- [⚙️ Configuration](#️-configuration)
- [🖥️ Desktop App](#️-desktop-app)
- [🔒 Security Features](#-security-features)
- [📖 References](#-references)

---

## 🐳 Docker Quickstart

### Requirements
- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **4GB+ RAM** (for Ollama models)
- **2GB+ disk space** (for AI models)

1) Clone and enter the repo
```bash
git clone <your-fork-or-repo-url>
cd on-prem-ai-note-taker
```

2) Start the stack
```bash
docker compose up -d --build
```

3) Pull an Ollama model (first time only)
```bash
docker compose exec ollama ollama pull llama3.1:8b
```

4) Open the app
```bash
# Frontend
http://localhost:8080

# Backend health
http://localhost:8000/api/health
```

Environment variables (optional):
- `WHISPER_MODEL` (default `base`) – e.g. `small`, `medium`, `large-v3`
- `WHISPER_COMPUTE_TYPE` (default `auto`) – e.g. `int8`, `int8_float16`, `float16`
- `OLLAMA_MODEL` (default `llama3.1:8b`)
- `MAX_UPLOAD_MB` (default `200`) – request body limit for large audio/video
- `MAX_CONCURRENCY` (default `2`) – concurrent transcriptions allowed

You can set them inline when starting Compose:
```bash
WHISPER_MODEL=small OLLAMA_MODEL=llama3.1:8b docker compose up -d --build
```

---

## Local Development (no Docker)

### Backend
Requirements: Python 3.11, FFmpeg
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Optional: set envs
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1:8b

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App on http://localhost:5173
```

Offline dev:
- Start recording on the home page; chunks are saved every 5s.
- If offline, recordings stay queued and visible on the dashboard.
- When connectivity returns, queued meetings auto-sync; or click Send to retry.

Run Ollama locally on your machine (outside Docker) if you prefer:
```bash
# Install Ollama: https://ollama.com/download
ollama serve &
ollama pull llama3.1:8b
```

---

## VPS Installation (Ubuntu 22.04/24.04)

1) Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Re-login or: newgrp docker
```

2) Clone and start
```bash
git clone <your-repo-url>
cd on-prem-ai-note-taker
docker compose up -d --build
docker compose exec ollama ollama pull llama3.1:8b
```

3) Optional: expose with Nginx
Point your domain to the VPS IP, then create an Nginx site:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

TLS: Use Certbot or a reverse proxy like Caddy/Traefik as you prefer.

### Hardening and Ops
- Healthchecks are enabled for all services; `docker compose ps` to inspect.
- Models are persisted in volumes: `ollama_models` and `whisper_models`.
- Increase upload and proxy timeouts for long files or slow CPUs.
- Monitor container logs: `docker compose logs -f backend frontend ollama`.

---

## 🔒 Security Features

- **🔐 Built-in Authentication** - HTTP Basic Auth with configurable credentials
- **🌐 CORS Protection** - Restrict access to authorized domains only
- **🛡️ Firewall Ready** - UFW firewall configuration scripts included
- **🔒 Credential Management** - Secure environment variable handling
- **🌍 Network Isolation** - Docker network isolation for services

## ⚙️ Configuration

Backend env vars:
- `APP_HOST` (default `0.0.0.0`)
- `APP_PORT` (default `8000`)
- `ALLOWED_ORIGINS` (comma-separated, default `*`)
- `WHISPER_MODEL`, `WHISPER_COMPUTE_TYPE`, `WHISPER_DOWNLOAD_ROOT`
- `OLLAMA_BASE_URL` (default `http://ollama:11434` in Docker)
- `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS`

Frontend env:
- `VITE_API_BASE_URL` (default `/api` when served via Nginx inside container)
- `VITE_BASIC_AUTH_USERNAME`, `VITE_BASIC_AUTH_PASSWORD` (optional; if set, client sends Authorization: Basic)

---

## 🖥️ Desktop App (Electron UI)

**Create a native desktop application** from your web app using Electron! This gives you a professional Windows `.exe` that runs independently with a native desktop experience.

### 🎯 **What You Get:**
- **🖥️ Native Desktop App** - Looks and feels like a real Windows application
- **🚀 Standalone Executable** - No need to open browser or run commands
- **👤 User Identity** - Automatically detects Windows username
- **📱 System Integration** - Desktop shortcuts, taskbar, notifications
- **🔒 Offline Capable** - Works even without internet connection

### 🛠️ **How It Works:**
The Electron wrapper takes your React web app and packages it into a native desktop application that:
- Opens the dashboard automatically
- Provides `process.env.USERNAME` to the web app
- Sends `X-User-Id` header with every API request
- Maintains all your AI note-taking functionality

- Identity: expose `process.env.USERNAME` via a `preload` script to `window.USER_ID`. The frontend automatically adds `X-User-Id` to upload requests when available.
- Packaging: use `electron-builder` to create a `win` target.
- Updates: either periodically ship a new installer, or integrate `electron-updater` pointing to your private file server.

Preload example:
```ts
// electron/preload.ts
import { contextBridge } from 'electron'
contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || '')
```

### 🚀 **Build Your Desktop App**

```bash
# 1. Start your backend services (VPS or local)
docker compose up -d --build

# 2. Build the desktop application
cd electron
npm install
npm run build:win

# 3. Your installer is ready!
# Output: electron/dist/OnPremNoteTaker-Setup-<version>.exe
```

### 📦 **What Gets Created:**
- **Windows Installer** - Professional `.exe` installer
- **Desktop Shortcut** - Automatic desktop icon creation
- **Start Menu Entry** - App appears in Windows start menu
- **System Integration** - Full Windows application experience

### 🔧 **Development Workflow:**

#### **Local Development:**
```bash
cd electron
npm install
npm run dev          # Opens desktop app in development mode
```

#### **Point to Remote VPS:**
```powershell
# Windows PowerShell
$env:APP_URL="http://95.111.244.159:8000"; npm run dev

# Or set in .env file
echo "APP_URL=http://95.111.244.159:8000" > .env
npm run dev
```

#### **Production Build:**
```bash
npm run build:win    # Creates Windows installer
npm run build:mac    # Creates macOS app (if on Mac)
npm run build:linux  # Creates Linux app (if on Linux)
```

### Example .env
```ini
# ===== Application =====
APP_HOST=0.0.0.0
APP_PORT=8000
ALLOWED_ORIGINS=*
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=auto
WHISPER_DOWNLOAD_ROOT=
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_SECONDS=120
MAX_UPLOAD_MB=200
MAX_CONCURRENCY=2
LOG_LEVEL=INFO

# Backend Auth
BASIC_AUTH_USERNAME=
BASIC_AUTH_PASSWORD=

# Frontend
VITE_API_BASE_URL=/api
VITE_BASIC_AUTH_USERNAME=
VITE_BASIC_AUTH_PASSWORD=

# Proxy (optional)
EXCHANGE_PROXY_URL=

# VPS (optional helpers)
VPS_HOST=
VPS_USER=
VPS_PORT=22
VPS_SSH_KEY=

PUBLIC_BASE_URL=
```

---

## 💡 Tips & Best Practices

- **🎯 First Run**: Initial transcription downloads Whisper models (~1GB) - be patient!
- **🖥️ Resource Management**: Use `small` or `medium` Whisper models for modest servers
- **🚀 GPU Acceleration**: Enable GPU builds for faster processing (see Ollama/Whisper docs)
- **🔒 Security**: Always change default credentials and enable firewall
- **📊 Monitoring**: Use `docker compose logs -f` for real-time service monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=eatbas/on-prem-ai-note-taker&type=Date)](https://star-history.com/#eatbas/on-prem-ai-note-taker&Date)

---

## 📖 References

- [🐙 Ollama Documentation](https://ollama.com)
- [🎤 Faster-Whisper](https://github.com/guillaumekln/faster-whisper)
- [⚡ FastAPI](https://fastapi.tiangolo.com)
- [🐳 Docker Compose](https://docs.docker.com/compose/)

---

<div align="center">

**🎉 Ready to build amazing AI-powered notes? Start with the [Quick Start Guide](documents/03-QUICK-START.md)!**

[![Get Started](https://img.shields.io/badge/Get%20Started-Quick%20Start%20Guide-blue?style=for-the-badge&logo=rocket)](documents/03-QUICK-START.md)

</div>


