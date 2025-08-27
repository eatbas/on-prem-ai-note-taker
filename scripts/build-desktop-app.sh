#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building dgMeets Desktop App${NC}"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "electron/package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Get VPS IP from .env file
if [ -f ".env" ]; then
    VPS_HOST=$(grep "^VPS_HOST=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$VPS_HOST" ]; then
        echo -e "${GREEN}✅ Using VPS Host: $VPS_HOST${NC}"
        export VPS_IP=$VPS_HOST
    else
        echo -e "${YELLOW}⚠️  VPS_HOST not found in .env file, using default${NC}"
        export VPS_IP="95.111.244.159"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found, using default VPS IP${NC}"
    export VPS_IP="95.111.244.159"
fi

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"

# Check Python (for backend packaging)
if ! command -v python3 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Python 3 not found - backend may not work in packaged app${NC}"
fi

# Step 1: Build Frontend
echo ""
echo -e "${BLUE}📦 Step 1: Building Frontend...${NC}"
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    npm install
fi

# Create production build
echo -e "${BLUE}Creating production build...${NC}"
npm run build

cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Step 2: Prepare Backend
echo ""
echo -e "${BLUE}📦 Step 2: Preparing Backend...${NC}"
cd backend

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo -e "${BLUE}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Install backend dependencies
echo -e "${BLUE}Installing backend dependencies...${NC}"
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    source venv/Scripts/activate 2>/dev/null || true
fi

pip install --upgrade pip
pip install -r requirements.txt

cd ..
echo -e "${GREEN}✅ Backend prepared successfully${NC}"

# Step 3: Prepare Electron
echo ""
echo -e "${BLUE}📦 Step 3: Preparing Electron App...${NC}"
cd electron

# Install Electron dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing Electron dependencies...${NC}"
    npm install
fi

# Copy frontend build to electron directory
echo -e "${BLUE}Copying frontend build...${NC}"
rm -rf dist
cp -r ../frontend/dist .

echo -e "${GREEN}✅ Electron prepared successfully${NC}"

# Step 4: Build executables
echo ""
echo -e "${BLUE}📦 Step 4: Building Desktop Application...${NC}"
echo -e "${BLUE}Choose your platform:${NC}"
echo "1. Windows (.exe)"
echo "2. macOS (.dmg)"
echo "3. Linux (.AppImage)"
echo "4. All platforms"

read -p "Enter your choice (1-4): " platform_choice

case $platform_choice in
    1)
        echo -e "${BLUE}Building for Windows...${NC}"
        npm run build:win
        ;;
    2)
        echo -e "${BLUE}Building for macOS...${NC}"
        npm run build:mac
        ;;
    3)
        echo -e "${BLUE}Building for Linux...${NC}"
        npm run build:linux
        ;;
    4)
        echo -e "${BLUE}Building for all platforms...${NC}"
        npm run build:win
        npm run build:mac
        npm run build:linux
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

cd ..

echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo "=================================================="
echo -e "${BLUE}📁 Output location:${NC} electron/dist-electron/"
echo ""
echo -e "${BLUE}📋 What's included:${NC}"
echo "- ✅ React frontend (built for production)"
echo "- ✅ Python backend (with SQLite database)"
echo "- ✅ Electron wrapper (native desktop app)"
echo "- ✅ Automatic VPS connection for AI services"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo "1. Find your installer in electron/dist-electron/"
echo "2. Install the application"
echo "3. Launch and start recording!"
echo ""
echo -e "${GREEN}📱 The app will:${NC}"
echo "- Store all data locally in ~/.dgmeets/"
echo "- Connect to VPS at $VPS_IP for AI processing"
echo "- Work offline for viewing existing notes"
echo "- Auto-detect your username for authentication"
