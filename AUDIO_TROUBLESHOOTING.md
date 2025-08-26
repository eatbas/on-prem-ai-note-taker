# 🎙️ Audio Recording Troubleshooting Guide

## Issue: "Failed to send meeting: No audio data found for this meeting"

### Quick Diagnosis Steps:

1. **Open Developer Console** (F12 in browser)
2. **Copy and paste** commands from `audio-debug-commands.js`
3. **Follow the specific fixes** based on the error messages

### Common Issues & Fixes:

#### ❌ **Microphone Access Denied**
**Symptoms:** "NotAllowedError" or "Permission denied"
**Fixes:**
- Click the 🎤 icon in browser address bar → Allow microphone
- Chrome: Settings → Privacy & Security → Site Settings → Microphone
- Firefox: Settings → Privacy & Security → Permissions → Microphone
- **Refresh the page** after granting permissions

#### ❌ **No Supported Audio Codecs**
**Symptoms:** "No supported audio codecs found"
**Fixes:**
- **Use Chrome or Edge** (best compatibility)
- Avoid Safari or older browsers
- Update your browser to latest version

#### ❌ **MediaRecorder Not Supported**
**Symptoms:** "MediaRecorder not supported"
**Fixes:**
- **Switch to Chrome/Edge/Firefox**
- Avoid Internet Explorer
- Check if running on HTTPS (required for microphone access)

#### ❌ **Audio Data Not Captured**
**Symptoms:** MediaRecorder starts but no data events fire
**Fixes:**
- **Check microphone is not muted** (hardware/system level)
- **Try different microphone** (if multiple available)
- **Restart browser** completely
- **Clear browser cache** and try again

#### ❌ **IndexedDB Storage Issues**
**Symptoms:** "Failed to save chunk to database"
**Fixes:**
- **Clear browser storage**: Settings → Clear browsing data
- **Try incognito/private mode**
- **Disable browser extensions** temporarily

#### ❌ **Browser Security Restrictions**
**Symptoms:** Various permission errors
**Fixes:**
- **Use HTTPS** (not HTTP) for the frontend
- **Use localhost** for development
- **Check if running in iframe** (may block audio access)

### Browser-Specific Notes:

#### ✅ **Chrome/Edge (Recommended)**
- Best MediaRecorder support
- All audio codecs supported
- Most reliable for audio capture

#### ⚠️ **Firefox**
- Good support but may need different codec
- Check codec compatibility

#### ❌ **Safari**
- Limited MediaRecorder support
- May not work reliably

#### ❌ **Mobile Browsers**
- Inconsistent support
- Desktop browser recommended

### Testing Commands:

Run these in browser console to test each component:

```javascript
// Test microphone access
navigator.mediaDevices.getUserMedia({ audio: true })

// Test MediaRecorder support  
MediaRecorder.isTypeSupported('audio/webm;codecs=opus')

// Test actual recording (requires user interaction)
testRecording() // From debug commands
```

### If All Tests Pass But Still No Audio:

1. **Check network connection** to VPS backend
2. **Verify backend is running** on port 8000
3. **Check CORS settings** in backend
4. **Try shorter recording** (30 seconds) first
5. **Check browser storage quota**

### Emergency Workaround:

If persistent issues, try:
1. **Different browser** (Chrome recommended)
2. **Incognito/private mode**
3. **Different device/computer**
4. **Use Electron desktop app** instead of browser

### Get Help:

If none of these fixes work:
1. Copy output from debug commands
2. Include browser type/version
3. Include operating system
4. Note any error messages in console
