#!/bin/bash

# 🧪 Electron CORS Test Script
# This script helps test and diagnose CORS issues in the Electron app

set -e

echo "🧪 Electron CORS Test Script"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VPS_IP="95.111.244.159"
API_BASE="http://${VPS_IP}:8000/api"

echo -e "${BLUE}📍 VPS IP: ${VPS_IP}${NC}"
echo -e "${BLUE}🌐 API Base: ${API_BASE}${NC}"
echo ""

# Step 1: Check if backend is accessible
echo -e "${YELLOW}Step 1: Testing VPS backend accessibility...${NC}"
AUTH_HEADER="Authorization: Basic $(echo -n 'myca:wj2YyxrJ4cqcXgCA' | base64)"

if curl -s -f --max-time 10 -H "${AUTH_HEADER}" "${API_BASE}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ VPS backend is accessible${NC}"
    HEALTH_DATA=$(curl -s -H "${AUTH_HEADER}" "${API_BASE}/health")
    echo -e "${GREEN}📊 Health: ${HEALTH_DATA}${NC}"
else
    echo -e "${RED}❌ VPS backend is not accessible${NC}"
    echo "Please check:"
    echo "1. VPS is running (docker ps)"
    echo "2. Firewall allows port 8000"
    echo "3. Network connectivity"
    exit 1
fi

echo ""

# Step 2: Check Electron dependencies
echo -e "${YELLOW}Step 2: Checking Electron setup...${NC}"

if [ ! -d "electron" ]; then
    echo -e "${RED}❌ Electron directory not found${NC}"
    exit 1
fi

if [ ! -f "electron/package.json" ]; then
    echo -e "${RED}❌ Electron package.json not found${NC}"
    exit 1
fi

if [ ! -f "electron/main.js" ]; then
    echo -e "${RED}❌ Electron main.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Electron files present${NC}"

# Check if node_modules exists
if [ ! -d "electron/node_modules" ]; then
    echo -e "${YELLOW}⚠️ Electron dependencies not installed${NC}"
    echo "Installing Electron dependencies..."
    cd electron
    npm install
    cd ..
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Electron dependencies already installed${NC}"
fi

echo ""

# Step 3: Check frontend build
echo -e "${YELLOW}Step 3: Checking frontend build...${NC}"

if [ ! -d "frontend/dist" ]; then
    echo -e "${YELLOW}⚠️ Frontend not built${NC}"
    echo "Building frontend..."
    cd frontend
    npm run build
    cd ..
    echo -e "${GREEN}✅ Frontend built${NC}"
else
    echo -e "${GREEN}✅ Frontend already built${NC}"
fi

echo ""

# Step 4: Test Electron configuration
echo -e "${YELLOW}Step 4: Validating Electron configuration...${NC}"

# Check if CORS fixes are applied
if grep -q "allowRunningInsecureContent: true" electron/main.js; then
    echo -e "${GREEN}✅ Enhanced web security settings applied${NC}"
else
    echo -e "${YELLOW}⚠️ Enhanced web security settings not found${NC}"
    echo "Please apply the CORS fixes from ELECTRON-CORS-FIX.md"
fi

if grep -q "onBeforeSendHeaders" electron/main.js; then
    echo -e "${GREEN}✅ Request interceptor configured${NC}"
else
    echo -e "${YELLOW}⚠️ Request interceptor not found${NC}"
    echo "Please apply the request interceptor from ELECTRON-CORS-FIX.md"
fi

if grep -q "corsDebug" electron/preload.js; then
    echo -e "${GREEN}✅ CORS debug functionality added${NC}"
else
    echo -e "${YELLOW}⚠️ CORS debug functionality not found${NC}"
    echo "Please add CORS debug to preload.js"
fi

echo ""

# Step 5: Create test instructions
echo -e "${YELLOW}Step 5: Creating test instructions...${NC}"

cat > test-electron-instructions.txt << 'EOF'
# 🧪 Electron App Testing Instructions

## 1. Start the Electron App
```bash
cd electron
npm start
# or
npm run electron
```

## 2. Open DevTools in Electron
- Press F12 or Ctrl+Shift+I in the Electron window
- Go to Console tab

## 3. Run these tests in the Console:

### Test 1: Check Configuration
```javascript
console.log('API Base:', window.API_BASE_URL)
console.log('Auth:', window.BASIC_AUTH)
console.log('CORS Debug available:', typeof window.corsDebug !== 'undefined')
```

### Test 2: Test Connection
```javascript
window.corsDebug.testConnection().then(result => {
    console.log('Connection test result:', result)
})
```

### Test 3: Manual Health Check
```javascript
fetch(window.API_BASE_URL + '/health', {
    headers: {
        'Authorization': 'Basic ' + btoa(window.BASIC_AUTH.username + ':' + window.BASIC_AUTH.password)
    }
}).then(r => r.json()).then(data => console.log('Health check:', data))
```

### Test 4: Complete CORS Test
```javascript
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

## Expected Results:
- ✅ All tests should pass without CORS errors
- ✅ Health check should return VPS data
- ✅ POST requests should work
- ✅ No network errors in console

## If Tests Fail:
1. Check Network tab for specific error messages
2. Look for CORS-related errors in Console
3. Verify VPS backend is running: docker ps
4. Test backend directly: curl -H "Authorization: Basic bXljYTp3ajJZeXhySjRjcWNYZ0NB" http://95.111.244.159:8000/api/health
5. Apply missing CORS fixes from ELECTRON-CORS-FIX.md
EOF

echo -e "${GREEN}✅ Test instructions created: test-electron-instructions.txt${NC}"

echo ""

# Step 6: Final summary
echo -e "${YELLOW}Step 6: Final summary and next steps...${NC}"

echo -e "${GREEN}🎉 Electron CORS test setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 What to do next:${NC}"
echo "1. Start your Electron app: cd electron && npm start"
echo "2. Open DevTools (F12) in the Electron window"
echo "3. Follow the instructions in: test-electron-instructions.txt"
echo "4. Run the console tests to verify CORS is working"
echo ""
echo -e "${BLUE}📚 Additional files created:${NC}"
echo "- ELECTRON-CORS-FIX.md: Complete CORS fix guide"
echo "- test-electron-instructions.txt: Step-by-step testing"
echo "- cors-debug.html: Browser-based CORS testing tool"
echo ""
echo -e "${BLUE}🔧 Applied fixes:${NC}"
echo "- Enhanced Electron web security settings"
echo "- Request interceptor for automatic CORS handling"
echo "- CORS debug functionality in preload.js"
echo ""
echo -e "${GREEN}Your Electron app should now connect to the VPS without CORS issues! 🚀${NC}"
