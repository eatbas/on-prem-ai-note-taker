#!/bin/bash

# 🚀 CORS Fix Script for AI Note Taker
# This script diagnoses and fixes common CORS issues

set -e

echo "🔧 AI Note Taker - CORS Fix Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VPS_IP="95.111.244.159"
API_BASE="http://${VPS_IP}:8000/api"
USERNAME="myca"
PASSWORD="wj2YyxrJ4cqcXgCA"

echo -e "${BLUE}📍 VPS IP: ${VPS_IP}${NC}"
echo -e "${BLUE}🌐 API Base: ${API_BASE}${NC}"
echo ""

# Step 1: Check Docker containers
echo -e "${YELLOW}Step 1: Checking Docker containers...${NC}"
if docker ps | grep -q "on-prem-ai-note-taker-backend-1"; then
    echo -e "${GREEN}✅ Backend container is running${NC}"
else
    echo -e "${RED}❌ Backend container is not running${NC}"
    echo "Starting backend container..."
    docker compose up -d backend
fi

if docker ps | grep -q "on-prem-ai-note-taker-ollama-1"; then
    echo -e "${GREEN}✅ Ollama container is running${NC}"
else
    echo -e "${RED}❌ Ollama container is not running${NC}"
    echo "Starting Ollama container..."
    docker compose up -d ollama
fi

echo ""

# Step 2: Test basic connectivity
echo -e "${YELLOW}Step 2: Testing basic connectivity...${NC}"
if curl -s -f --max-time 10 "${API_BASE}/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ API is accessible without authentication (security issue!)${NC}"
else
    echo -e "${GREEN}✅ API properly requires authentication${NC}"
fi

# Step 3: Test with authentication
echo -e "${YELLOW}Step 3: Testing with authentication...${NC}"
AUTH_HEADER="Authorization: Basic $(echo -n "${USERNAME}:${PASSWORD}" | base64)"
if curl -s -f --max-time 10 -H "${AUTH_HEADER}" "${API_BASE}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Authentication is working${NC}"
    
    # Get health data
    HEALTH_DATA=$(curl -s -H "${AUTH_HEADER}" "${API_BASE}/health")
    echo -e "${GREEN}📊 Health Data: ${HEALTH_DATA}${NC}"
else
    echo -e "${RED}❌ Authentication is failing${NC}"
    echo "Checking backend logs..."
    docker logs on-prem-ai-note-taker-backend-1 --tail 10
fi

echo ""

# Step 4: Test CORS preflight
echo -e "${YELLOW}Step 4: Testing CORS preflight requests...${NC}"

# Test with localhost origin (common for dev)
echo "Testing with localhost:5173 origin..."
CORS_RESPONSE=$(curl -s -I \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Authorization,Content-Type" \
    -X OPTIONS \
    "${API_BASE}/health" 2>/dev/null || echo "Failed")

if echo "${CORS_RESPONSE}" | grep -q "access-control-allow-origin"; then
    echo -e "${GREEN}✅ CORS working for localhost:5173${NC}"
    echo "${CORS_RESPONSE}" | grep "access-control"
else
    echo -e "${RED}❌ CORS failing for localhost:5173${NC}"
    echo "Response: ${CORS_RESPONSE}"
fi

echo ""

# Test with null origin (common for file:// access)
echo "Testing with null origin..."
CORS_NULL_RESPONSE=$(curl -s -I \
    -H "Origin: null" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Authorization,Content-Type" \
    -X OPTIONS \
    "${API_BASE}/health" 2>/dev/null || echo "Failed")

if echo "${CORS_NULL_RESPONSE}" | grep -q "access-control-allow-origin"; then
    echo -e "${GREEN}✅ CORS working for null origin${NC}"
else
    echo -e "${RED}❌ CORS failing for null origin${NC}"
fi

echo ""

# Step 5: Check backend configuration
echo -e "${YELLOW}Step 5: Checking backend configuration...${NC}"

# Check if ALLOWED_ORIGINS is set correctly
if docker exec on-prem-ai-note-taker-backend-1 printenv ALLOWED_ORIGINS 2>/dev/null | grep -q "\*"; then
    echo -e "${GREEN}✅ ALLOWED_ORIGINS is set to * (wildcard)${NC}"
else
    echo -e "${YELLOW}⚠️ ALLOWED_ORIGINS might not be set to wildcard${NC}"
    echo "Current value:"
    docker exec on-prem-ai-note-taker-backend-1 printenv ALLOWED_ORIGINS 2>/dev/null || echo "Not set"
fi

echo ""

# Step 6: Common fixes
echo -e "${YELLOW}Step 6: Applying common fixes...${NC}"

# Fix 1: Restart backend to reload configuration
echo "🔄 Restarting backend to reload configuration..."
docker compose restart backend
sleep 5

# Fix 2: Check if any firewall rules are blocking
echo "🔥 Checking firewall rules..."
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${BLUE}🛡️ UFW is active. Checking rules...${NC}"
        if ufw status | grep -q "8000"; then
            echo -e "${GREEN}✅ Port 8000 is allowed in UFW${NC}"
        else
            echo -e "${YELLOW}⚠️ Port 8000 might not be explicitly allowed${NC}"
            echo "To allow port 8000: sudo ufw allow 8000"
        fi
    else
        echo -e "${GREEN}✅ UFW is inactive${NC}"
    fi
else
    echo -e "${BLUE}ℹ️ UFW not installed${NC}"
fi

echo ""

# Step 7: Final test
echo -e "${YELLOW}Step 7: Final connectivity test...${NC}"
sleep 3

echo "Testing API health with authentication..."
FINAL_TEST=$(curl -s -w "%{http_code}" -H "${AUTH_HEADER}" "${API_BASE}/health" 2>/dev/null)
HTTP_CODE="${FINAL_TEST: -3}"
RESPONSE_BODY="${FINAL_TEST%???}"

if [ "${HTTP_CODE}" = "200" ]; then
    echo -e "${GREEN}🎉 SUCCESS! API is working properly${NC}"
    echo -e "${GREEN}📊 Response: ${RESPONSE_BODY}${NC}"
    
    # Test CORS one more time
    echo ""
    echo "Final CORS test..."
    FINAL_CORS=$(curl -s -I \
        -H "Origin: http://localhost:5173" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Authorization,Content-Type" \
        -X OPTIONS \
        "${API_BASE}/health" 2>/dev/null || echo "Failed")
    
    if echo "${FINAL_CORS}" | grep -q "access-control-allow-origin"; then
        echo -e "${GREEN}🎉 CORS is working perfectly!${NC}"
        echo ""
        echo -e "${GREEN}✅ Your backend is ready! Here's what to do next:${NC}"
        echo ""
        echo -e "${BLUE}1. Frontend Configuration:${NC}"
        echo "   Make sure your frontend .env.local has:"
        echo "   VITE_API_BASE_URL=http://${VPS_IP}:8000/api"
        echo "   VITE_BASIC_AUTH_USERNAME=${USERNAME}"
        echo "   VITE_BASIC_AUTH_PASSWORD=${PASSWORD}"
        echo ""
        echo -e "${BLUE}2. Clear browser cache and try again${NC}"
        echo ""
        echo -e "${BLUE}3. If still having issues, open the CORS debug tool:${NC}"
        echo "   File: cors-debug.html (in this directory)"
        echo "   Open it in your browser and run tests"
        echo ""
        echo -e "${GREEN}🚀 Happy coding!${NC}"
    else
        echo -e "${RED}❌ API works but CORS is still failing${NC}"
        echo "This might require backend code changes..."
    fi
else
    echo -e "${RED}❌ API is not responding properly${NC}"
    echo "HTTP Code: ${HTTP_CODE}"
    echo "Response: ${RESPONSE_BODY}"
    echo ""
    echo "Check backend logs:"
    docker logs on-prem-ai-note-taker-backend-1 --tail 20
fi

echo ""
echo "🔧 CORS Fix Script completed!"
echo "If you're still having issues, check:"
echo "1. Frontend .env.local configuration"
echo "2. Browser developer console for specific CORS errors"
echo "3. Try the cors-debug.html tool"
echo "4. Clear browser cache/cookies"
