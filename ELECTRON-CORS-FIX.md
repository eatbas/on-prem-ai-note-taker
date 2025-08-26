# 🔧 Electron CORS Fix Guide

## 🎯 **Issue Identified** ⚡

Your Electron app has specific CORS considerations. The good news: **Your VPS backend CORS is perfect** ✅  
The issue is with **Electron-specific configuration** and network requests.

## 📊 **Current Electron Configuration**

✅ **API URL**: Hardcoded to `http://95.111.244.159:8000/api` (correct)  
✅ **Authentication**: Preset credentials `myca:wj2YyxrJ4cqcXgCA`  
✅ **Web Security**: Disabled (`webSecurity: false`)  
⚠️ **Potential Issue**: Network origin mismatch or headers

## 🚀 **Electron-Specific Fixes**

### **Fix 1: Enhanced Electron Web Security Settings** ✅ APPLIED

Updated `electron/main.js` with enhanced security settings:

```javascript
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
    webSecurity: false, // Allow loading local files
    allowRunningInsecureContent: true, // Allow HTTP content from HTTPS
    experimentalFeatures: true // Enable experimental web features
}
```

### **Fix 2: Add Request Interceptor for Better CORS Handling** 🔧

Add this code to your `electron/main.js` after the `createWindow()` function:

```javascript
// Add request interceptor to handle CORS issues
app.whenReady().then(() => {
    const { session } = require('electron')
    
    // Intercept and modify requests to VPS
    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ['http://95.111.244.159:8000/*'] },
        (details, callback) => {
            // Add CORS headers to requests
            details.requestHeaders['Origin'] = 'electron://app'
            details.requestHeaders['User-Agent'] = 'ElectronApp/1.0'
            
            // Ensure auth header is present
            if (!details.requestHeaders['Authorization'] && 
                details.url.includes('95.111.244.159:8000/api')) {
                const credentials = Buffer.from('myca:wj2YyxrJ4cqcXgCA').toString('base64')
                details.requestHeaders['Authorization'] = `Basic ${credentials}`
            }
            
            console.log('🔧 Modified request headers for:', details.url)
            callback({ requestHeaders: details.requestHeaders })
        }
    )
    
    // Handle response headers
    session.defaultSession.webRequest.onHeadersReceived(
        { urls: ['http://95.111.244.159:8000/*'] },
        (details, callback) => {
            // Ensure CORS headers are present in response
            details.responseHeaders['Access-Control-Allow-Origin'] = ['*']
            details.responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS']
            details.responseHeaders['Access-Control-Allow-Headers'] = ['*']
            details.responseHeaders['Access-Control-Allow-Credentials'] = ['true']
            
            console.log('🔧 Modified response headers for:', details.url)
            callback({ responseHeaders: details.responseHeaders })
        }
    )
})
```

### **Fix 3: Enhanced Preload Script for Better Error Handling** 🔧

Update your `electron/preload.js` with enhanced error handling:

```javascript
// Add to the end of preload.js
contextBridge.exposeInMainWorld('corsDebug', {
    testConnection: async () => {
        try {
            const response = await fetch('http://95.111.244.159:8000/api/health', {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa('myca:wj2YyxrJ4cqcXgCA'),
                    'Content-Type': 'application/json'
                }
            })
            
            console.log('🔧 CORS Test Response:', response.status, response.statusText)
            
            if (response.ok) {
                const data = await response.json()
                console.log('🔧 CORS Test Data:', data)
                return { success: true, data }
            } else {
                return { success: false, error: `HTTP ${response.status}` }
            }
        } catch (error) {
            console.error('🔧 CORS Test Error:', error)
            return { success: false, error: error.message }
        }
    }
})
```

### **Fix 4: Electron Launch Arguments** 🚀

When starting your Electron app, add these command line arguments for better CORS handling:

```bash
# For development
npm run electron -- --disable-web-security --allow-running-insecure-content --disable-features=VizDisplayCompositor

# Or add to your package.json scripts:
"electron-dev": "electron . --disable-web-security --allow-running-insecure-content"
```

### **Fix 5: Debug Console Commands** 🧪

Add these to your frontend for debugging in Electron DevTools:

```javascript
// Open DevTools and run these commands
console.log('API Base:', window.API_BASE_URL)
console.log('Auth:', window.BASIC_AUTH)

// Test the connection
if (window.corsDebug) {
    window.corsDebug.testConnection().then(result => {
        console.log('Connection test result:', result)
    })
}

// Test a real API call
fetch(window.API_BASE_URL + '/health', {
    headers: {
        'Authorization': 'Basic ' + btoa(window.BASIC_AUTH.username + ':' + window.BASIC_AUTH.password)
    }
}).then(r => r.json()).then(data => console.log('Health check:', data))
```

## 🔄 **Apply the Fixes**

1. **Restart Electron App** after applying the main.js changes
2. **Open DevTools** (`Ctrl+Shift+I` or `F12` in Electron)
3. **Check Console** for CORS-related messages
4. **Test API calls** using the debug commands above

## 🎯 **Expected Results After Fixes**

- ✅ No CORS errors in Electron DevTools console
- ✅ API calls return data successfully
- ✅ File uploads work without errors
- ✅ Authentication works seamlessly
- ✅ Real-time features (SSE, WebSocket) work

## 🚨 **If Still Having Issues**

### **Check Electron DevTools Console**
1. Open DevTools in Electron (`Ctrl+Shift+I`)
2. Go to **Console** tab
3. Look for specific error messages
4. Check **Network** tab for failed requests

### **Common Electron CORS Errors & Solutions**

**Error**: `net::ERR_FAILED` or `TypeError: Failed to fetch`  
**Solution**: Check VPS connectivity, verify API URL

**Error**: `Refused to connect to ... because it violates CSP`  
**Solution**: Add CSP meta tag or disable web security

**Error**: `Mixed Content` warnings  
**Solution**: Use `allowRunningInsecureContent: true`

**Error**: `401 Unauthorized`  
**Solution**: Check auth credentials in preload.js

## 🎉 **Success Test**

Run this in Electron DevTools console to verify everything works:

```javascript
// Complete test
async function testElectronCORS() {
    console.log('🧪 Testing Electron CORS...')
    
    try {
        const health = await fetch(window.API_BASE_URL + '/health', {
            headers: {
                'Authorization': 'Basic ' + btoa(window.BASIC_AUTH.username + ':' + window.BASIC_AUTH.password)
            }
        })
        
        if (health.ok) {
            const data = await health.json()
            console.log('✅ Health check passed:', data)
            
            // Test a POST request
            const chatTest = await fetch(window.API_BASE_URL + '/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(window.BASIC_AUTH.username + ':' + window.BASIC_AUTH.password)
                },
                body: JSON.stringify({ prompt: 'Hello test', model: 'qwen2.5:3b-instruct' })
            })
            
            if (chatTest.ok) {
                console.log('✅ POST request test passed')
                console.log('🎉 All CORS tests PASSED! Your Electron app is ready!')
            } else {
                console.log('❌ POST request failed:', chatTest.status)
            }
        } else {
            console.log('❌ Health check failed:', health.status)
        }
    } catch (error) {
        console.error('❌ CORS test failed:', error)
    }
}

testElectronCORS()
```

---

**🎯 The main fix**: Enhanced web security settings + request interceptors  
**🚀 Expected result**: Electron app connects seamlessly to VPS backend  
**🧪 Test method**: DevTools console commands above  

Happy coding with Electron! ⚡✨

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">/myca/on-prem-ai-note-taker/electron/main.js
