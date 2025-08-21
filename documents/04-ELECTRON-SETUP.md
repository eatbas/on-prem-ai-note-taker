# 🖥️ Electron Desktop App Setup Guide

## 🎯 **Create a Native Desktop Application**

Transform your AI Note Taker into a professional cross-platform desktop application using Electron!

## ✨ **What You Get:**

- **🖥️ Native Desktop App** - Looks and feels like a real desktop application
- **🚀 Standalone Executable** - No need to open browser or run commands
- **👤 User Identity** - Automatically detects your computer username
- **📱 System Integration** - Desktop shortcuts, taskbar, notifications
- **🔒 Offline Capable** - Works even without internet connection
- **🌐 Cross-Platform** - Windows, macOS, and Linux support

## 🏗️ **Architecture Overview:**

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
            │   Cross-Platform│
            └─────────────────┘
```

## 🚀 **Quick Start (One Command):**

### **Build Everything at Once:**
```bash
# From project root
./scripts/build-desktop-app.sh
```

**That's it!** The script will:
1. ✅ Build React frontend for production
2. ✅ Package Python backend with dependencies
3. ✅ Create Electron desktop application
4. ✅ Generate native installer for your platform

## 🔧 **Development Workflow:**

### **Development Mode (Live Testing):**
```bash
cd electron
npm run dev          # Opens desktop app in development mode
```

### **Production Build:**
```bash
# Use the automated build script (recommended)
./scripts/build-desktop-app.sh

# Or build manually
cd electron
npm run build:win    # Creates Windows installer
npm run build:mac    # Creates macOS app
npm run build:linux  # Creates Linux app
```

### **Point to Your VPS Backend:**
```bash
# Set in .env file (project root)
echo "VPS_HOST=your.vps.ip.address" > .env
echo "BASIC_AUTH_USERNAME=your_username" >> .env
echo "BASIC_AUTH_PASSWORD=your_password" >> .env

# Then build
./scripts/build-desktop-app.sh
```

## 📁 **Electron Folder Structure:**

```
electron/
├── 📦 package.json         ← Dependencies and scripts
├── 🚀 main.js              ← Electron main process
├── 🎨 preload.js           ← Preload script for user ID
├── 🏗️ build-app.js         ← Build automation script
├── 📋 dist/                ← Built applications
│   ├── win-unpacked/       ← Windows executable
│   ├── mac/                ← macOS app bundle
│   └── linux/              ← Linux app
└── 📚 Documentation
```

## 🎯 **What Gets Created:**

### **Windows Build:**
- **Installer**: `OnPremNoteTaker-Setup-1.0.0.exe`
- **Portable**: `win-unpacked/OnPremNoteTaker.exe`
- **Location**: `electron/dist-electron/`

### **macOS Build:**
- **App Bundle**: `OnPremNoteTaker-1.0.0.dmg`
- **App**: `mac/OnPremNoteTaker.app`
- **Location**: `electron/dist-electron/`

### **Linux Build:**
- **AppImage**: `OnPremNoteTaker-1.0.0.AppImage`
- **Debian**: `OnPremNoteTaker_1.0.0.deb`
- **Location**: `electron/dist-electron/`

## 🔐 **User Identity Integration:**

### **How It Works:**
1. **Electron** detects your computer username
2. **Preload script** exposes it to the web app
3. **Frontend** automatically adds user identification
4. **Backend** receives user identification for each request

### **Preload Script:**
```javascript
// electron/preload.js
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || process.env.USER || '')
```

### **Frontend Usage:**
```typescript
// Automatically adds user ID to all API requests
const userId = window.USER_ID
// Headers: { 'X-User-Id': userId }
```

## ⚙️ **Configuration Options:**

### **Environment Variables (.env):**
```env
# Point to your VPS backend
VPS_HOST=your.vps.ip.address

# Your credentials
BASIC_AUTH_USERNAME=your_username
BASIC_AUTH_PASSWORD=your_password

# Optional: AI Model Settings
WHISPER_MODEL=base
OLLAMA_MODEL=llama3.1:8b
```

### **Build Configuration:**
```json
// electron/package.json
{
  "appId": "com.onprem.note",
  "productName": "On-Prem AI Note Taker",
  "directories": {
    "buildResources": "build",
    "output": "dist-electron"
  },
  "files": [
    "main.js",
    "preload.js",
    "dist/**/*"
  ],
  "extraResources": [
    {
      "from": "../backend",
      "to": "backend"
    },
    {
      "from": "../frontend/dist",
      "to": "dist"
    }
  ]
}
```

## 🧪 **Testing Your Desktop App:**

### **Development Testing:**
1. ✅ **App Opens**: Desktop window appears
2. ✅ **Web Content**: Your React app loads inside
3. ✅ **User ID**: Username appears in app
4. ✅ **API Calls**: Requests include user ID header
5. ✅ **Functionality**: All features work as expected

### **Production Testing:**
1. ✅ **Installer**: Runs without errors
2. ✅ **Installation**: Creates desktop shortcut
3. ✅ **Start Menu**: App appears in system menu
4. ✅ **Launch**: App starts from shortcut
5. ✅ **VPS Connection**: Connects to your backend

## 🆘 **Troubleshooting:**

### **Common Issues:**

1. **"Module not found" errors:**
   ```bash
   cd electron
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Build fails:**
   - Check Node.js version (18+ required)
   - Ensure all dependencies installed
   - Check Python version (3.8+ required)
   - Verify VPS credentials in `.env`

3. **App won't start:**
   - Verify backend is running
   - Check VPS_HOST in `.env` file
   - Look for console errors

4. **User ID not working:**
   - Check preload script
   - Verify frontend integration
   - Test API headers

### **Debug Mode:**
```bash
# Enable developer tools
cd electron
npm run dev -- --devtools

# Check console output
# Look for errors in main process
```

## 🚀 **Advanced Features:**

### **Cross-Platform Builds:**
```bash
# Build for all platforms
./scripts/build-desktop-app.sh
# Choose option 4 when prompted
```

### **Custom Icons:**
- Place your icon files in `electron/build/` folder
- Update `electron/package.json` build configuration
- Rebuild application

### **Code Signing (Optional):**
```bash
# Windows code signing
cd electron
npm run build:win -- --sign
```

## 📱 **Distribution:**

### **End Users:**
- Send the appropriate installer for their platform
- Users double-click to install
- Automatic desktop shortcut creation

### **Enterprise Deployment:**
- Use platform-specific deployment tools
- Silent installation options
- Centralized management

### **Updates:**
- Rebuild and redistribute new versions
- Users install new version over old
- Data preserved between updates

## 🎉 **Success Indicators:**

- ✅ **Desktop app opens** without errors
- ✅ **User identity** properly detected
- ✅ **VPS integration** works with backend
- ✅ **All features** function normally
- ✅ **Professional appearance** like native app
- ✅ **System integration** (shortcuts, start menu)

## 📚 **Next Steps:**

1. **Build your first app**: `./scripts/build-desktop-app.sh`
2. **Test on target machine**: Install and run
3. **Customize appearance**: Update icons and branding
4. **Deploy to users**: Share installer
5. **Monitor usage**: Track app performance and user feedback

---

**🚀 Ready to create your desktop app? Start with `./scripts/build-desktop-app.sh`!**
