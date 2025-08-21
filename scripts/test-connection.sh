#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_IP=${1:-}
LOCAL_PORT=${2:-8001}

if [ -z "$VPS_IP" ]; then
    echo -e "${RED}Usage: $0 <VPS_IP> [LOCAL_PORT]${NC}"
    echo "Example: $0 192.168.1.100 8001"
    exit 1
fi

echo -e "${BLUE}🧪 Testing connections...${NC}"
echo "=================================================="

# Test VPS services
echo -e "${BLUE}🔍 Testing VPS services...${NC}"

# Test Ollama
if curl -s -f --max-time 10 "http://$VPS_IP:11434/api/tags" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama service: OK${NC}"
else
    echo -e "${RED}❌ Ollama service: FAILED${NC}"
fi

# Test VPS Backend
if curl -s -f --max-time 10 "http://$VPS_IP:8000/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ VPS Backend: OK${NC}"
else
    echo -e "${RED}❌ VPS Backend: FAILED${NC}"
fi

echo ""

# Test local backend (if running)
echo -e "${BLUE}🔍 Testing local backend...${NC}"

if curl -s -f --max-time 10 "http://localhost:$LOCAL_PORT/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Local Backend: OK${NC}"
    
    # Test if local backend can reach VPS
    echo -e "${BLUE}🔍 Testing local backend connectivity to VPS...${NC}"
    
    # Get health response and check for any errors
    HEALTH_RESPONSE=$(curl -s --max-time 10 "http://localhost:$LOCAL_PORT/api/health" 2>/dev/null || echo "FAILED")
    
    if [ "$HEALTH_RESPONSE" != "FAILED" ]; then
        echo -e "${GREEN}✅ Local backend health check: OK${NC}"
        echo "Response: $HEALTH_RESPONSE"
    else
        echo -e "${RED}❌ Local backend health check: FAILED${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠️  Local Backend: NOT RUNNING (port $LOCAL_PORT)${NC}"
    echo ""
    echo -e "${BLUE}To start local backend:${NC}"
    echo "./scripts/setup-local-backend.sh $VPS_IP $LOCAL_PORT"
fi

echo ""
echo -e "${BLUE}📋 Connection Summary:${NC}"
echo "=================================================="
echo -e "VPS IP: $VPS_IP"
echo -e "Local Port: $LOCAL_PORT"
echo ""

# Count successful connections
SUCCESS_COUNT=0
TOTAL_CHECKS=0

# VPS checks
if curl -s -f --max-time 10 "http://$VPS_IP:11434/api/tags" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if curl -s -f --max-time 10 "http://$VPS_IP:8000/api/health" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Local backend check
if curl -s -f --max-time 10 "http://localhost:$LOCAL_PORT/api/health" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo -e "${BLUE}📊 Overall Status: $SUCCESS_COUNT/$TOTAL_CHECKS connections successful${NC}"

if [ $SUCCESS_COUNT -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}🎉 All connections are working! Your setup is ready.${NC}"
elif [ $SUCCESS_COUNT -ge 2 ]; then
    echo -e "${YELLOW}⚠️  Most connections are working. Check the failed ones above.${NC}"
else
    echo -e "${RED}❌ Multiple connection failures. Check your VPS and network setup.${NC}"
fi
