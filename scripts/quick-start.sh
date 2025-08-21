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
VPS_USER=${2:-root}
LOCAL_PORT=${3:-8001}

if [ -z "$VPS_IP" ]; then
    echo -e "${RED}Usage: $0 <VPS_IP> [VPS_USER] [LOCAL_PORT]${NC}"
    echo "Example: $0 192.168.1.100 ubuntu 8001"
    echo ""
    echo -e "${BLUE}This script will:${NC}"
    echo "1. 🔍 Check if VPS is running correctly"
    echo "2. 🚀 Set up local backend environment"
    echo "3. 🌐 Start local backend connecting to VPS"
    echo ""
    echo -e "${BLUE}Prerequisites:${NC}"
    echo "- VPS must be running with Docker services"
    echo "- Python 3.8+ installed locally"
    echo "- Network access to VPS IP"
    exit 1
fi

echo -e "${BLUE}🚀 Quick Start: VPS Check + Local Backend Setup${NC}"
echo "=================================================="
echo -e "${BLUE}VPS IP: $VPS_IP${NC}"
echo -e "${BLUE}VPS User: $VPS_USER${NC}"
echo -e "${BLUE}Local Port: $LOCAL_PORT${NC}"
echo ""

# Step 1: Check VPS status
echo -e "${BLUE}📋 Step 1: Checking VPS status...${NC}"
echo "=================================================="

# Run VPS status check
if ./scripts/check-vps-status.sh "$VPS_IP" "$VPS_USER"; then
    echo -e "${GREEN}✅ VPS status check completed${NC}"
else
    echo -e "${YELLOW}⚠️  VPS status check had issues - continuing anyway${NC}"
fi

echo ""
echo -e "${BLUE}📋 Step 2: Setting up local backend...${NC}"
echo "=================================================="

# Step 2: Set up local backend
if ./scripts/setup-local-backend.sh "$VPS_IP" "$LOCAL_PORT"; then
    echo -e "${GREEN}✅ Local backend setup completed${NC}"
else
    echo -e "${RED}❌ Local backend setup failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Quick start completed successfully!${NC}"
echo "=================================================="
echo -e "${BLUE}📋 Summary:${NC}"
echo "- ✅ VPS is running at $VPS_IP"
echo "- ✅ Local backend is running on port $LOCAL_PORT"
echo "- ✅ Local backend is connected to VPS services"
echo ""
echo -e "${BLUE}🌐 Access your application:${NC}"
echo "- Local backend: http://localhost:$LOCAL_PORT"
echo "- API docs: http://localhost:$LOCAL_PORT/docs"
echo "- Health check: http://localhost:$LOCAL_PORT/api/health"
echo ""
echo -e "${BLUE}🔄 Next steps:${NC}"
echo "1. Open frontend in your browser"
echo "2. Configure frontend to connect to local backend"
echo "3. Start recording and transcribing!"
echo ""
echo -e "${BLUE}🛑 To stop: Press Ctrl+C in the backend terminal${NC}"
