# 🚀 Quick Start Guide - Build Your Desktop App!

## 🎯 **The Simple Way to Build Your AI Note Taker**

This guide shows you the **easiest way** to build and run your AI Note Taker desktop application.

## ⚡ **3 Simple Commands to Get Started:**

```bash
# 1. Clone the repository
git clone https://github.com/eatbas/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker

# 2. Set your VPS credentials
echo "VPS_HOST=your.vps.ip.address" > .env

# 3. Build the desktop app
./scripts/build-desktop-app.sh
```

**That's it!** 🎉

## 🖥️ **What You Get:**

A complete desktop application that:
- ✅ **Installs like any app** (Windows .exe, Mac .dmg, Linux .AppImage)
- ✅ **Works offline** for viewing existing notes
- ✅ **Connects to VPS** for AI processing
- ✅ **Stores everything locally** on your computer

## 🔐 **Before You Start - Set Credentials:**

Create `.env` file in the project root with:

```env
VPS_HOST=your.vps.ip.address
BASIC_AUTH_USERNAME=your_username
BASIC_AUTH_PASSWORD=your_password
```

## 📋 **Complete Setup Checklist:**

### **On Your VPS (Already Done ✅):**
- [x] Backend running on port 8000
- [x] Ollama running on port 11434
- [x] Authentication configured
- [x] CORS settings applied

### **On Your Local Computer:**
- [ ] Clone repository
- [ ] Create `.env` with VPS credentials
- [ ] Run build script
- [ ] Install the desktop app
- [ ] Launch and start recording!

## 🛠️ **What Each Command Does:**

### **`git clone`**
- Downloads complete project code
- Includes frontend, backend, and build scripts
- Only needed **once**

### **`echo "VPS_HOST=..." > .env`**
- Creates configuration file
- Sets your VPS IP address
- Required for app to connect to AI services

### **`./scripts/build-desktop-app.sh`**
- Builds React frontend for production
- Packages Python backend with dependencies
- Creates Electron desktop application
- Generates native installer for your platform

## 🔄 **Daily Workflow:**

### **Build New Version:**
```bash
./scripts/build-desktop-app.sh
```

### **Install and Test:**
1. Find installer in `electron/dist-electron/`
2. Install the application
3. Launch and test new features

### **Make Changes:**
1. Edit files in `frontend/src/` or `backend/app/` folders
2. Save changes
3. Rebuild: `./scripts/build-desktop-app.sh`
4. Install and test new version

## 🧪 **Test Your Setup:**

### **Quick Test:**
1. ✅ App builds successfully
2. ✅ No build errors
3. ✅ Desktop app launches
4. ✅ Can see the app interface

### **Full Test:**
1. ✅ Record audio
2. ✅ Upload to VPS
3. ✅ Get transcription back
4. ✅ AI summarization works

## 🆘 **If Something Goes Wrong:**

### **"Build failed" errors:**
```bash
# Check Node.js version (needs 18+)
node --version

# Check Python version (needs 3.8+)
python3 --version

# Reinstall dependencies
cd frontend && rm -rf node_modules && npm install
cd ../backend && rm -rf venv && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### **"Cannot connect" errors:**
- Check VPS is running
- Verify credentials in `.env` file
- Check IP address in `.env` file

### **"Permission denied":**
```bash
# Make script executable
chmod +x scripts/build-desktop-app.sh
```

## 📱 **Cross-Platform Support:**

### **Windows:**
- Generates `.exe` installer
- Installs to Program Files
- Creates Start Menu shortcut

### **macOS:**
- Generates `.dmg` installer
- Drag to Applications folder
- Works with Gatekeeper

### **Linux:**
- Generates `.AppImage` and `.deb`
- AppImage runs anywhere
- .deb for system integration

## 🎯 **Success Indicators:**

- ✅ **App builds** without errors
- ✅ **Installer created** in `electron/dist-electron/`
- ✅ **Desktop app launches** successfully
- ✅ **Can record audio**
- ✅ **Connected to VPS backend**
- ✅ **AI features work**

## 🚀 **Ready to Start?**

1. **Clone the repository** to your computer
2. **Create `.env`** with your VPS credentials
3. **Run the build script** above
4. **Install the desktop app**
5. **Start building amazing AI notes!**

---

**💡 Remember: Build once, install anywhere! Your desktop app is completely self-contained.**
