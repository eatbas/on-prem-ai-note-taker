# Scripts for VPS and Local Backend Setup

This directory contains scripts to help you check your VPS status and set up your local backend to connect to the VPS services.

## 📋 Available Scripts

### 1. `get-vps-ip-only.sh` - Extract VPS IP Only
**Purpose**: Simple script that outputs just the VPS IP from .env file

**Usage**:
```bash
./scripts/get-vps-ip-only.sh
```

**Output**: Just the VPS IP address (e.g., `95.111.244.159`)

**Use case**: When you need the VPS IP for other scripts or automation

---

### 2. `extract-vps-ip.sh` - VPS Configuration Display
**Purpose**: Display VPS configuration from .env file and show available commands

**Usage**:
```bash
./scripts/extract-vps-ip.sh
```

**What it shows**:
- ✅ VPS Host IP address
- ✅ VPS User
- ✅ VPS Port
- 🔧 Available commands with pre-filled VPS IP

**Use case**: Quick overview of VPS configuration and available commands

---

### 3. `get-vps-ip.sh` - Interactive VPS Management
**Purpose**: Interactive menu to choose what to do with your VPS

**Usage**:
```bash
./scripts/get-vps-ip.sh
```

**What it offers**:
1. 🔍 Check VPS status
2. 🚀 Set up local backend
3. 🧪 Test connections
4. 🚀 Quick start (check + setup)
5. 📋 Show VPS info only

**Use case**: Main interface for managing VPS and local backend

---

### 4. `check-vps-status.sh` - VPS Health Check
**Purpose**: Comprehensive health check of your VPS services

**Usage**:
```bash
./scripts/check-vps-status.sh <VPS_IP> [VPS_USER]
```

**Example**:
```bash
./scripts/check-vps-status.sh 95.111.244.159 ubuntu
```

**What it checks**:
- ✅ VPS connectivity (ping)
- ✅ SSH access
- ✅ Service ports (Ollama: 11434, Backend: 8000)
- ✅ HTTP endpoints (health checks)
- ✅ Docker service status
- ✅ Service logs
- ✅ Ollama models availability

**Output**: Detailed status report with color-coded results

---

### 5. `setup-local-backend.sh` - Local Backend Setup
**Purpose**: Set up and start your local backend connecting to VPS

**Usage**:
```bash
./scripts/setup-local-backend.sh <VPS_IP> [LOCAL_PORT]
```

**Example**:
```bash
./scripts/setup-local-backend.sh 95.111.244.159 8001
```

**What it does**:
- 🐍 Checks Python installation
- 🔧 Creates virtual environment
- 📦 Installs dependencies
- ⚙️ Creates local environment configuration
- 🚀 Starts local backend server
- 🔗 Connects to VPS services

**Default local port**: 8001 (to avoid conflicts with VPS backend on 8000)

---

### 6. `quick-start.sh` - One-Command Setup
**Purpose**: Complete setup in one command (VPS check + local backend)

**Usage**:
```bash
./scripts/quick-start.sh <VPS_IP> [VPS_USER] [LOCAL_PORT]
```

**Example**:
```bash
./scripts/quick-start.sh 95.111.244.159 ubuntu 8001
```

**What it does**:
1. 🔍 Checks VPS status
2. 🚀 Sets up local backend
3. 🌐 Starts local backend
4. 📋 Provides summary and next steps

---

### 7. `test-connection.sh` - Connection Testing
**Purpose**: Test all connections between local and VPS

**Usage**:
```bash
./scripts/test-connection.sh <VPS_IP> [LOCAL_PORT]
```

**Example**:
```bash
./scripts/test-connection.sh 95.111.244.159 8001
```

**What it tests**:
- 🔍 VPS services connectivity
- 🔍 Local backend status
- 🔍 End-to-end communication
- 📊 Overall connection health

---

## 🚀 Quick Start Guide

### Option 1: Use Interactive Menu (Recommended)
```bash
# This will read VPS IP from .env file and show you options
./scripts/get-vps-ip.sh
```

### Option 2: Manual Commands
```bash
# Get VPS IP from .env file
VPS_IP=$(./scripts/get-vps-ip-only.sh)

# Check VPS status
./scripts/check-vps-status.sh $VPS_IP

# Set up local backend
./scripts/setup-local-backend.sh $VPS_IP

# Test all connections
./scripts/test-connection.sh $VPS_IP
```

### Option 3: One-Command Setup
```bash
# Get VPS IP and do everything
VPS_IP=$(./scripts/get-vps-ip-only.sh)
./scripts/quick-start.sh $VPS_IP
```

---

## 🔧 Prerequisites

### Local Machine Requirements
- ✅ Python 3.8 or higher
- ✅ Bash shell
- ✅ Network access to VPS IP
- ✅ SSH access to VPS (optional, for detailed status)

### VPS Requirements
- ✅ Docker and Docker Compose running
- ✅ Services accessible on expected ports
- ✅ Network firewall allowing connections

### Environment File
- ✅ `.env` file with `VPS_HOST=your_vps_ip` configured

---

## 📊 Expected Results

### Successful VPS Check
```
🎉 VPS is running correctly! All services are operational.

Next steps:
1. ✅ VPS is ready
2. 🔧 Set up local backend environment
3. 🚀 Start local backend
4. 🌐 Configure frontend to connect to VPS
```

### Successful Local Backend Setup
```
✅ Local backend is running on: http://localhost:8001
✅ Connecting to VPS at: YOUR_VPS_IP

Available endpoints:
- Health check: http://localhost:8001/api/health
- API docs: http://localhost:8001/docs
```

---

## 🛠️ Troubleshooting

### Common Issues

#### VPS Not Reachable
```bash
# Check if VPS is running
ping YOUR_VPS_IP

# Check if services are running on VPS
ssh USER@YOUR_VPS_IP "docker compose ps"
```

#### Local Backend Won't Start
```bash
# Check Python version
python3 --version

# Check if port is already in use
lsof -i :8001

# Check virtual environment
ls -la backend/venv/
```

#### Connection Issues
```bash
# Test individual services
curl http://YOUR_VPS_IP:11434/api/tags
curl http://YOUR_VPS_IP:8000/api/health

# Check local backend
curl http://localhost:8001/api/health
```

---

## 🔄 Restarting Services

### Restart Local Backend
```bash
# Stop current backend (Ctrl+C)
# Then restart
./scripts/setup-local-backend.sh YOUR_VPS_IP
```

### Restart VPS Services
```bash
# SSH into VPS
ssh USER@YOUR_VPS_IP

# Restart services
cd on-prem-ai-note-taker
docker compose restart
```

---

## 📁 File Locations

After running the scripts, you'll have:
- `backend/.env.local` - Local environment configuration
- `backend/venv/` - Python virtual environment
- `backend/models/` - Local Whisper models directory

---

## 🎯 Next Steps

After successful setup:
1. ✅ VPS is running and accessible
2. ✅ Local backend is running on port 8001
3. 🌐 Configure frontend to connect to local backend
4. 🎤 Start recording and transcribing!

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify VPS services are running
3. Check network connectivity
4. Review service logs on VPS
