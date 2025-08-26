# 🎯 Centralized Configuration System

🎉 **No more copying 3 env files!** Everything now uses the **single root `.env` file**.

## 📋 **How It Works**

### **Single Source of Truth** ✅
```
/myca/on-prem-ai-note-taker/
├── .env                     # ⭐ ONLY file you need to edit!
├── env.example              # Template to copy from
├── backend/                 # ✅ Reads from root .env
├── frontend/                # ✅ Reads from root .env  
├── electron/                # ✅ Reads from root .env
└── docker-compose.yml       # ✅ Reads from root .env
```

### **What Changed** 🔄

| Component | Before | After |
|-----------|--------|-------|
| **Backend** | `backend/.env` | `root/.env` via `env_loader.py` |
| **Frontend** | `frontend/.env.local` | `root/.env` via `envLoader.ts` |
| **Docker** | Environment variables | `env_file: .env` |
| **Electron** | Hardcoded values | Updates `root/.env` |

## 🚀 **Quick Start**

### **1. Setup (One Time)**
```bash
# Copy the template
cp env.example .env

# Run the setup script (optional)
./scripts/setup-centralized-env.sh
```

### **2. Configure Your Settings**
Edit **ONLY** the root `.env` file:
```bash
nano .env
```

### **3. Start Services**
```bash
# VPS Deployment
docker-compose up -d

# Local Development  
cd frontend && npm run dev
cd backend && python -m app.main

# Electron App
cd electron && npm run build
```

## ⚙️ **Configuration Examples**

### **VPS Production** 🌐
```bash
# .env file
WHISPER_MODEL=large-v3
WHISPER_COMPUTE_TYPE=float16
BASIC_AUTH_USERNAME=myca
BASIC_AUTH_PASSWORD=your-secure-password
VPS_HOST=95.111.244.159
```

### **Local Development** 💻
```bash
# .env file  
WHISPER_MODEL=tiny
WHISPER_COMPUTE_TYPE=int8
APP_PORT=8001
VITE_API_BASE_URL=http://localhost:8001/api
```

### **Electron App** 🖥️
```bash
# The electron build script automatically updates .env
cd electron
npm run build  # Updates root .env with electron settings
```

## 🔧 **Advanced Configuration**

### **Environment Loaders**

**Backend**: `backend/app/core/env_loader.py`
```python
# Automatically loads root .env file
from .env_loader import load_root_env
load_root_env()
```

**Frontend**: `frontend/src/utils/envLoader.ts`
```typescript
// Centralized config object
import config from '../utils/envLoader'
const chunkMs = config.audioChunkMs
```

### **Docker Compose**
```yaml
services:
  backend:
    env_file:
      - .env  # Loads ALL variables from root .env
```

### **Custom Vite Config**
```javascript
// vite.frontend.config.js
// Loads env from project root instead of frontend/
const env = loadEnv(mode, projectRoot, '')
```

## 🧹 **Migration from Old System**

### **What Was Removed** ❌
- `backend/env.example` 
- `frontend/env.example`
- `backend/.env`
- `frontend/.env.local`

### **What's New** ✅
- `backend/app/core/env_loader.py` - Loads root .env
- `frontend/src/utils/envLoader.ts` - Centralized config
- `vite.frontend.config.js` - Custom Vite config
- `scripts/setup-centralized-env.sh` - Setup script

## 🎯 **Benefits**

### **Before (3 Files)** 😫
```bash
# Had to edit 3 files for each change:
backend/.env
frontend/.env.local  
env.example

# Copy-paste nightmare!
```

### **After (1 File)** 😍
```bash
# Edit only 1 file:
.env

# Everything syncs automatically! ✨
```

## 🔍 **Troubleshooting**

### **Environment Not Loading?**
```bash
# Test backend env loading
cd backend
python -c "from app.core.env_loader import load_root_env; load_root_env()"

# Test frontend build
cd frontend  
npm run build

# Check Docker env
docker-compose config
```

### **Reset Configuration**
```bash
# Start fresh
rm .env
cp env.example .env
./scripts/setup-centralized-env.sh
```

## 📝 **Summary**

🎉 **One `.env` file to rule them all!**

- ✅ **Edit once**: Change settings in root `.env` only
- ✅ **Auto-sync**: All services read from same source  
- ✅ **No confusion**: Single source of truth
- ✅ **Easy deployment**: Copy one file to VPS
- ✅ **Development**: Same config for all environments

**Happy coding! 🚀**
