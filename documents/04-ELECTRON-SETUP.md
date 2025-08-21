# 🖥️ Electron Desktop App Setup Guide

## 🎯 **Create a Native Desktop Application**

Transform your web-based AI Note Taker into a professional Windows desktop application using Electron!

## ✨ **What You Get:**

- **🖥️ Native Desktop App** - Looks and feels like a real Windows application
- **🚀 Standalone Executable** - No need to open browser or run commands
- **👤 User Identity** - Automatically detects Windows username
- **📱 System Integration** - Desktop shortcuts, taskbar, notifications
- **🔒 Offline Capable** - Works even without internet connection

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
            │   Windows .exe  │
            └─────────────────┘
```

## 🚀 **Quick Start (3 Steps):**

### **Step 1: Navigate to Electron Folder**
```bash
cd electron
```

### **Step 2: Install Dependencies**
```bash
npm install
```

### **Step 3: Build Your Desktop App**
```bash
npm run build:win    # Windows installer
npm run build:mac    # macOS app (if on Mac)
npm run build:linux  # Linux app (if on Linux)
```

## 🔧 **Development Workflow:**

### **Development Mode (Live Testing):**
```bash
npm run dev          # Opens desktop app in development mode
```

### **Production Build:**
```bash
npm run build:win    # Creates Windows installer
npm run build:mac    # Creates macOS app
npm run build:linux  # Creates Linux app
```

### **Point to Your VPS Backend:**
```powershell
# Windows PowerShell
$env:APP_URL="http://95.111.244.159:8000"; npm run dev

# Or set in .env file
echo "APP_URL=http://95.111.244.159:8000" > .env
npm run dev
```

## 📁 **Electron Folder Structure:**

```
electron/
├── 📦 package.json         ← Dependencies and scripts
├── 🚀 src/                 ← Electron main process
│   ├── main.ts             ← Main application window
│   └── preload.ts          ← User ID injection
├── 🎨 assets/              ← App icons and resources
├── 📋 electron-builder.json ← Build configuration
├── 🏗️ dist/                ← Built applications
│   ├── win-unpacked/       ← Windows executable
│   ├── mac/                ← macOS app bundle
│   └── linux/              ← Linux app
└── 📚 Documentation
```

## 🎯 **What Gets Created:**

### **Windows Build:**
- **Installer**: `OnPremNoteTaker-Setup-<version>.exe`
- **Portable**: `win-unpacked/OnPremNoteTaker.exe`
- **Auto-updater**: Built-in update mechanism

### **macOS Build:**
- **App Bundle**: `OnPremNoteTaker-<version>.dmg`
- **App**: `mac/OnPremNoteTaker.app`

### **Linux Build:**
- **AppImage**: `OnPremNoteTaker-<version>.AppImage`
- **Debian**: `OnPremNoteTaker_<version>.deb`

## 🔐 **User Identity Integration:**

### **How It Works:**
1. **Electron** detects Windows username (`process.env.USERNAME`)
2. **Preload script** exposes it to the web app (`window.USER_ID`)
3. **Frontend** automatically adds `X-User-Id` header to API requests
4. **Backend** receives user identification for each request

### **Preload Script:**
```typescript
// electron/src/preload.ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || '')
```

### **Frontend Usage:**
```typescript
// Automatically adds user ID to all API requests
const userId = window.USER_ID
// Headers: { 'X-User-Id': userId }
```

## ⚙️ **Configuration Options:**

### **Environment Variables:**
```env
# Point to your backend
APP_URL=http://95.111.244.159:8000

# Build settings
NODE_ENV=production
ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true
```

### **Build Configuration:**
```json
// electron-builder.json
{
  "appId": "com.yourcompany.onprem-ai-notes",
  "productName": "AI Note Taker",
  "directories": {
    "output": "dist"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*"
  ],
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico"
  }
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
3. ✅ **Start Menu**: App appears in Windows menu
4. ✅ **Launch**: App starts from shortcut
5. ✅ **Updates**: Auto-updater works (if configured)

## 🆘 **Troubleshooting:**

### **Common Issues:**

1. **"Module not found" errors:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Build fails:**
   - Check Node.js version (16+ required)
   - Ensure all dependencies installed
   - Check electron-builder configuration

3. **App won't start:**
   - Verify backend is running
   - Check APP_URL configuration
   - Look for console errors

4. **User ID not working:**
   - Check preload script
   - Verify frontend integration
   - Test API headers

### **Debug Mode:**
```bash
# Enable developer tools
npm run dev -- --devtools

# Check console output
# Look for errors in main process
```

## 🚀 **Advanced Features:**

### **Auto-Updates:**
```bash
# Configure update server
npm run publish
```

### **Code Signing:**
```bash
# Windows code signing
npm run build:win -- --sign
```

### **Custom Icons:**
- Place your `.ico` file in `assets/` folder
- Update `electron-builder.json`
- Rebuild application

## 📱 **Distribution:**

### **Windows Users:**
- Send the `.exe` installer
- Users double-click to install
- Automatic desktop shortcut creation

### **Enterprise Deployment:**
- Use Windows Group Policy
- Silent installation
- Centralized management

### **Updates:**
- Built-in auto-updater
- Notify users of new versions
- Seamless update process

## 🎉 **Success Indicators:**

- ✅ **Desktop app opens** without errors
- ✅ **User identity** properly detected
- ✅ **API integration** works with backend
- ✅ **All features** function normally
- ✅ **Professional appearance** like native app
- ✅ **System integration** (shortcuts, start menu)

## 📚 **Next Steps:**

1. **Build your first app**: `npm run build:win`
2. **Test on target machine**: Install and run
3. **Customize appearance**: Update icons and branding
4. **Deploy to users**: Share installer or set up auto-updates
5. **Monitor usage**: Track app performance and user feedback

---

**🚀 Ready to create your desktop app? Start with `npm run build:win`!**
