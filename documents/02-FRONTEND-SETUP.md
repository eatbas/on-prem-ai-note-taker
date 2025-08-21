# 💻 Local Frontend Setup Guide

## 📍 **What You'll Do on Your Local Computer**

This guide will help you set up the frontend on your local computer to connect to your VPS backend.

## 🎯 **Prerequisites:**

- **Node.js** (version 18 or higher)
- **npm** or **yarn**
- **Git** (to clone the repository)
- **Your VPS backend running** (already done!)

## 📥 **Step 1: Get the Code**

### **Option A: Clone from Your Repository**
```bash
git clone <your-repository-url>
cd on-prem-ai-note-taker
```

### **Option B: Download from VPS**
If you want to copy the files from your VPS:
```bash
# From your VPS, create a zip file
zip -r frontend-code.zip frontend/

# Download to your local computer
# Then extract and navigate to the frontend folder
```

## 🔐 **Step 2: Set Up Environment Variables**

### **Create .env.local File:**
In the `frontend` folder, create a file called `.env.local`:

```env
# VPS Backend Connection
VITE_API_BASE_URL=http://95.111.244.159:8000/api

# Your VPS Credentials (must match your VPS .env file)
VITE_BASIC_AUTH_USERNAME=your_username_here
VITE_BASIC_AUTH_PASSWORD=your_password_here

# Frontend Settings
VITE_FRONTEND_PORT=5173
VITE_FRONTEND_HOST=localhost
VITE_DEBUG=true
VITE_LOG_LEVEL=info
```

### **Important Security Notes:**
- ✅ **This file is already ignored by git** (`.gitignore` configured)
- 🔒 **Keep your credentials secure**
- 🔄 **Username/password must match your VPS .env file**

## 📦 **Step 3: Install Dependencies**

```bash
cd frontend
npm install
```

**Expected output:**
- Dependencies will be installed
- `node_modules` folder created
- No errors should occur

## 🚀 **Step 4: Start Development Server**

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.4.1  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
  ➜  press h to show help
```

## 🌐 **Step 5: Access Your App**

Open your browser and go to:
**http://localhost:5173**

## 🔗 **Step 6: Test Connection to VPS**

### **What Should Happen:**
1. ✅ Frontend loads without errors
2. ✅ No CORS errors in browser console
3. ✅ App connects to your VPS backend
4. ✅ You can upload audio files
5. ✅ Transcription and summarization work

### **If You Get Errors:**
1. **Check browser console** (F12 → Console)
2. **Verify your credentials** in `.env.local`
3. **Ensure VPS is running** (check VPS status)
4. **Check network connectivity** to VPS IP

## 🛠️ **Alternative: Use Pre-built Version (No npm run build)**

### **Option 1: Use Development Server (Recommended)**
```bash
npm run dev
```
- ✅ **Fast development**
- ✅ **Hot reload on changes**
- ✅ **No building required**
- ✅ **Easy debugging**

### **Option 2: Use Preview Mode**
```bash
npm run preview
```
- 🔄 **Uses pre-built files**
- 🚀 **Production-like environment**
- 📁 **Requires dist folder**

## 📁 **File Structure on Your Computer:**

```
on-prem-ai-note-taker/
├── frontend/
│   ├── .env.local          ← Your credentials here
│   ├── package.json
│   ├── src/                ← React source code
│   ├── public/             ← Static assets
│   └── node_modules/       ← Dependencies
├── documents/              ← This documentation
└── README.md
```

## 🔧 **Development Workflow:**

### **Daily Development:**
```bash
# Start development server
npm run dev

# Make changes to code
# Save files → automatic reload

# Stop server
Ctrl + C
```

### **Adding New Features:**
1. Edit files in `src/` folder
2. Save changes
3. Browser automatically reloads
4. Test functionality
5. Repeat

## 🧪 **Testing Your Setup:**

### **Test 1: Basic Connection**
- ✅ Frontend loads
- ✅ No console errors
- ✅ App interface appears

### **Test 2: Audio Upload**
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

1. **"Module not found" errors:**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **"Cannot connect to VPS" errors:**
   - Check VPS is running
   - Verify IP address in `.env.local`
   - Check credentials match VPS

3. **"CORS" errors:**
   - Ensure VPS CORS settings include localhost
   - Check VPS is running and accessible

4. **"Authentication failed" errors:**
   - Verify username/password in `.env.local`
   - Check VPS `.env` file has same credentials

### **Reset Everything:**
```bash
# Stop development server
Ctrl + C

# Clear everything
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Start fresh
npm run dev
```

## 📱 **Access from Other Devices:**

### **Same Network:**
- Use your computer's IP address
- Example: `http://192.168.1.100:5173`

### **Different Network:**
- Set up port forwarding on your router
- Or use VPN to connect to your local network

## 🎉 **Success Indicators:**

- ✅ Frontend loads at http://localhost:5173
- ✅ No errors in browser console
- ✅ Can record/upload audio
- ✅ Transcription works
- ✅ AI summarization works
- ✅ All connected to your VPS

## 📞 **Need Help?**

1. **Check VPS status** first
2. **Verify credentials** match
3. **Check browser console** for errors
4. **Ensure network connectivity** to VPS

---

**🚀 Your frontend is now ready to connect to your VPS backend!**
