#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Local Frontend...${NC}"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"

# Check if npm is installed
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ npm is not installed${NC}"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm $NPM_VERSION found${NC}"

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi

# Create frontend environment file
echo -e "${BLUE}🔧 Creating frontend environment configuration...${NC}"

# Get VPS credentials from root .env file
if [ -f ".env" ]; then
    VPS_USERNAME=$(grep "^BASIC_AUTH_USERNAME=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    VPS_PASSWORD=$(grep "^BASIC_AUTH_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
else
    VPS_USERNAME="admin"
    VPS_PASSWORD="password"
fi

# Create frontend .env.local file
cat > frontend/.env.local << EOF
# ===== FRONTEND .env.local =====
# This file connects your local frontend to your LOCAL backend

# ===== Local Backend Connection =====
# Your local backend API endpoint (running on port 8001)
VITE_API_BASE_URL=http://localhost:8001/api

# ===== Authentication Credentials =====
# These should match your VPS backend credentials
VITE_BASIC_AUTH_USERNAME=${VPS_USERNAME}
VITE_BASIC_AUTH_PASSWORD=${VPS_PASSWORD}

# ===== Frontend Settings =====
# Frontend will run on this port locally
VITE_FRONTEND_PORT=5173
VITE_FRONTEND_HOST=localhost

# ===== Development Settings =====
# Enable debug mode for development
VITE_DEBUG=true
VITE_LOG_LEVEL=info

# ===== SETUP NOTES =====
# 1. This frontend connects to your LOCAL backend on port 8001
# 2. Your LOCAL backend connects to VPS services on 95.111.244.159
# 3. Frontend runs at: http://localhost:5173
# 4. Local backend runs at: http://localhost:8001
# 5. VPS services at: http://95.111.244.159
EOF

echo -e "${GREEN}✅ Frontend environment file created: frontend/.env.local${NC}"

# Check if local backend is running
echo -e "${BLUE}🔍 Checking if local backend is running...${NC}"
if curl -s -f --max-time 5 "http://localhost:8001/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Local backend is running on port 8001${NC}"
else
    echo -e "${YELLOW}⚠️  Local backend is not running on port 8001${NC}"
    echo ""
    echo -e "${BLUE}To start local backend first:${NC}"
    echo "./scripts/setup-local-backend.sh \$(./scripts/get-vps-ip-only.sh)"
    echo ""
    echo -e "${BLUE}Or use the interactive menu:${NC}"
    echo "./scripts/get-vps-ip.sh"
    echo ""
    echo -e "${YELLOW}Starting frontend anyway (it may not work without backend)...${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Starting Local Frontend...${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Frontend will run on: http://localhost:5173${NC}"
echo -e "${GREEN}✅ Connecting to local backend on: http://localhost:8001${NC}"
echo -e "${GREEN}✅ Local backend connects to VPS on: $(./scripts/get-vps-ip-only.sh)${NC}"
echo ""
echo -e "${BLUE}📋 Available endpoints:${NC}"
echo "- Frontend: http://localhost:5173"
echo "- Local Backend API: http://localhost:8001/api"
echo "- Local Backend Docs: http://localhost:8001/docs"
echo ""
echo -e "${BLUE}🔄 To stop the frontend: Press Ctrl+C${NC}"
echo -e "${BLUE}🔄 To restart: Run this script again${NC}"
echo ""

# Start the frontend
cd frontend
npm run dev
