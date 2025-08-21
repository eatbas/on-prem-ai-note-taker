# 💻 Local Development Setup Guide

## 📍 **What You'll Do on Your Local Computer**

This guide will help you set up the development environment on your local computer to build and test your AI Note Taker desktop application.

## 🎯 **Prerequisites:**

- **Node.js** (version 18 or higher)
- **npm** or **yarn**
- **Python 3.8+** (for backend development)
- **Git** (to clone the repository)
- **Your VPS backend running** (already done!)

## 📥 **Step 1: Get the Code**

### **Clone the Repository:**
```bash
git clone https://github.com/eatbas/on-prem-ai-note-taker.git
cd on-prem-ai-note-taker
```

## 🔐 **Step 2: Set Up Environment Variables**

### **Create .env File:**
In the project root, create a file called `.env`:

```env
# VPS Backend Connection
VPS_HOST=95.111.244.159

# Your VPS Credentials (must match your VPS .env file)
BASIC_AUTH_USERNAME=your_username_here
BASIC_AUTH_PASSWORD=your_password_here

# Optional: AI Model Settings
WHISPER_MODEL=base
OLLAMA_MODEL=llama3.1:8b
```

### **Important Security Notes:**
- ✅ **This file is already ignored by git** (`.gitignore` configured)
- 🔒 **Keep your credentials secure**
- 🔄 **Username/password must match your VPS .env file**

## 📦 **Step 3: Install Dependencies**

### **Frontend Dependencies:**
```bash
cd frontend
npm install
cd ..
```

### **Backend Dependencies:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### **Electron Dependencies:**
```bash
cd electron
npm install
cd ..
```

## 🚀 **Step 4: Development Options**

### **Option 1: Build Desktop App (Recommended)**
```bash
# Build complete desktop application
./scripts/build-desktop-app.sh

# Install and test the app
# Find installer in electron/dist-electron/
```

### **Option 2: Run Components Separately**
```bash
# Terminal 1: Frontend development server
cd frontend && npm run dev

# Terminal 2: Backend development server
cd backend && source venv/bin/activate && python -m uvicorn app.main:app --reload --port 8001

# Terminal 3: Electron app
cd electron && npm run dev
```

## 🌐 **Step 5: Access Your Development Environment**

- **Frontend Dev Server**: http://localhost:5173
- **Backend Dev Server**: http://localhost:8001
- **Desktop App**: Launches from Electron

## 🔗 **Step 6: Test Your Setup**

### **What Should Happen:**
1. ✅ Frontend loads without errors
2. ✅ Backend responds to health checks
3. ✅ Desktop app launches successfully
4. ✅ App connects to your VPS backend
5. ✅ You can upload audio files
6. ✅ Transcription and summarization work

### **If You Get Errors:**
1. **Check terminal output** for error messages
2. **Verify your credentials** in `.env`
3. **Ensure VPS is running** (check VPS status)
4. **Check network connectivity** to VPS IP

## 🛠️ **Development Workflow:**

### **Daily Development:**
```bash
# Make changes to code
# Test changes in development mode
# Build new desktop app when ready
./scripts/build-desktop-app.sh
```

### **Adding New Features:**
1. Edit files in `frontend/src/` or `backend/app/` folders
2. Test in development mode
3. Build new desktop app: `./scripts/build-desktop-app.sh`
4. Install and test new version

## 📁 **File Structure on Your Computer:**

```
on-prem-ai-note-taker/
├── .env                    ← Your credentials here
├── frontend/
│   ├── package.json
│   ├── src/                ← React source code
│   ├── public/             ← Static assets
│   └── node_modules/       ← Dependencies
├── backend/
│   ├── app/                ← Python backend code
│   ├── requirements.txt
│   └── venv/               ← Python virtual environment
├── electron/
│   ├── main.js             ← Electron main process
│   ├── package.json
│   └── node_modules/       ← Electron dependencies
├── scripts/                 ← Build and utility scripts
└── documents/               ← This documentation
```

## 🧪 **Testing Your Setup:**

### **Test 1: Basic Build**
- ✅ App builds successfully
- ✅ No build errors
- ✅ Desktop app launches

### **Test 2: Audio Recording**
- ✅ Click record button
- ✅ Speak into microphone
- ✅ Audio gets sent to VPS
- ✅ Transcription appears

### **Test 3: AI Summarization**
- ✅ Upload audio file
- ✅ Wait for transcription
- ✅ Click summarize
- ✅ AI summary appears

## 🆘 **Troubleshooting:**

### **Common Issues:**

1. **"Build failed" errors:**
   ```bash
   # Check Node.js version (needs 18+)
   node --version
   
   # Check Python version (needs 3.8+)
   python3 --version
   
   # Reinstall dependencies
   cd frontend && rm -rf node_modules && npm install
   cd ../backend && rm -rf venv && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
   ```

2. **"Cannot connect to VPS" errors:**
   - Check VPS is running
   - Verify IP address in `.env`
   - Check credentials match VPS

3. **"Permission denied" errors:**
   ```bash
   # Make build script executable
   chmod +x scripts/build-desktop-app.sh
   ```

4. **"Module not found" errors:**
   - Ensure all dependencies are installed
   - Check virtual environment is activated for backend
   - Verify Node.js modules are installed

### **Reset Everything:**
```bash
# Clear all dependencies
rm -rf frontend/node_modules backend/venv electron/node_modules

# Reinstall everything
cd frontend && npm install
cd ../backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
cd ../electron && npm install

# Try building again
cd .. && ./scripts/build-desktop-app.sh
```

## 📱 **Cross-Platform Development:**

### **Windows:**
- Use `scripts\build-desktop-app.bat`
- Generates `.exe` installer
- Test on Windows machine

### **macOS:**
- Use `./scripts/build-desktop-app.sh`
- Generates `.dmg` installer
- Test on Mac machine

### **Linux:**
- Use `./scripts/build-desktop-app.sh`
- Generates `.AppImage` and `.deb`
- Test on Linux machine

## 🎉 **Success Indicators:**

- ✅ App builds without errors
- ✅ Desktop app launches successfully
- ✅ Can record/upload audio
- ✅ Transcription works
- ✅ AI summarization works
- ✅ All connected to your VPS

## 📞 **Need Help?**

1. **Check VPS status** first
2. **Verify credentials** match
3. **Check build output** for errors
4. **Ensure all dependencies** are installed

---

**🚀 Your development environment is now ready to build amazing desktop applications!**
