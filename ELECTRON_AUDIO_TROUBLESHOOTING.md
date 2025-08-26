# 🖥️ Electron App Audio Troubleshooting Guide

## Issue: "Failed to send meeting: No audio data found for this meeting" 

### Electron-Specific Debugging:

**This is NOT a browser issue - it's an Electron desktop app!**

---

## 🔧 Step 1: Open Electron DevTools

1. **In your Electron app**: Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
2. **Go to Console tab**
3. **Copy and paste** the contents of `electron-audio-debug.js`
4. **Press Enter** to run the diagnostic

---

## 🎯 Common Electron Audio Issues:

### ❌ **System Permissions (Most Common)**

**macOS:**
- **System Preferences** → **Security & Privacy** → **Microphone**
- ✅ **Enable for your app name**
- **System Preferences** → **Sound** → **Input** 
- ✅ **Make sure microphone is selected and not muted**

**Windows:**
- **Settings** → **Privacy** → **Microphone**
- ✅ **Allow apps to access microphone**
- ✅ **Allow desktop apps to access microphone**
- **Check microphone is not muted in system tray**

**Linux:**
- `sudo usermod -a -G audio $USER` (add user to audio group)
- Check PulseAudio is running: `pulseaudio --check`
- `pavucontrol` to check audio settings

### ❌ **Desktop Audio Capture Issues**

**The app tries to capture both microphone AND system audio:**

**macOS:**
- **Install BlackHole** or **SoundflowerBed** for system audio capture
- **Enable "System Audio"** in Sound preferences
- **Restart the Electron app** after audio driver installation

**Windows:**
- **Enable "Stereo Mix"** in Recording devices
- **Right-click sound icon** → **Recording devices** → **Show disabled devices**
- **Enable "Stereo Mix"** or **"What U Hear"**

**Linux:**
- **Install PulseAudio**: `sudo apt install pulseaudio pavucontrol`
- **Enable loopback**: `pactl load-module module-loopback`

### ❌ **Electron App Configuration**

**Check main.js webPreferences:**
```javascript
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false, // ← Important for audio
    allowRunningInsecureContent: true, // ← Important
    experimentalFeatures: true // ← Important
}
```

### ❌ **IndexedDB/Storage Issues in Electron**

**Clear Electron app data:**
- **macOS**: `~/Library/Application Support/[AppName]`
- **Windows**: `%APPDATA%/[AppName]`
- **Linux**: `~/.config/[AppName]`

**Or restart with clean slate:**
```bash
# Delete the app data folder and restart
```

---

## 🚨 Electron-Specific Quick Fixes:

### **1. Restart with Elevated Permissions**
```bash
# macOS/Linux: Run with sudo temporarily to test
sudo ./your-electron-app

# Windows: Run as Administrator
```

### **2. Check Electron Version Compatibility**
- **Update to Electron 20+** for best audio support
- **Check package.json** for Electron version

### **3. Development vs Production**
- **Development**: Make sure dev server is running on localhost:5173
- **Production**: Check if built files in `electron/dist/` are current

### **4. Audio Device Detection**
In Electron DevTools console:
```javascript
// List available audio devices
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    console.log('Audio devices:', devices.filter(d => d.kind === 'audioinput'));
  });
```

---

## 🔍 Electron Debug Commands:

**Run these in Electron app console (Ctrl+Shift+I):**

```javascript
// Test Electron APIs
window.electronAPI ? console.log('✅ Electron APIs OK') : console.log('❌ Electron APIs missing');

// Test desktop capture
window.desktopCapture.getSources(['audio']).then(sources => 
  console.log('Desktop audio sources:', sources)
);

// Test microphone with Electron context
navigator.mediaDevices.getUserMedia({audio: true})
  .then(stream => {
    console.log('✅ Microphone OK in Electron');
    stream.getTracks().forEach(t => t.stop());
  })
  .catch(err => console.error('❌ Microphone failed:', err));
```

---

## 🎯 Expected Behavior When Fixed:

1. **App opens** without permission prompts (permissions granted at system level)
2. **Recording starts** immediately when clicking record
3. **Console shows** audio chunks being saved every 45 seconds
4. **No "No audio data" error** when stopping recording
5. **Audio visualizer** shows activity (if implemented)

---

## 🆘 If Nothing Works:

### **Last Resort Fixes:**

1. **Complete app restart**: Quit completely and reopen
2. **System restart**: Restart your computer  
3. **Reinstall audio drivers**: Update system audio drivers
4. **Different audio device**: Try with different microphone
5. **Run from terminal**: Check for error messages in console output

### **Alternative Recording Method:**

If persistent issues, try:
- **Use system screen recorder** (OBS, macOS Screen Recording)
- **Upload audio file manually** to the web interface
- **Use browser version** temporarily at `http://localhost:5173`

---

## 📞 Get Help:

If diagnostic shows all tests pass but still no audio:
1. **Copy the console output** from the diagnostic
2. **Include your OS version** and Electron app version  
3. **Check if running in development or production mode**
4. **Try the browser version** to isolate if it's Electron-specific

Most Electron audio issues are **system permission related** 🔐
