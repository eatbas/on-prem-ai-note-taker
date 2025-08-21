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
    echo ""
    echo -e "${BLUE}This script will:${NC}"
    echo "1. Check if Python and dependencies are installed"
    echo "2. Create local environment file"
    echo "3. Install Python dependencies"
    echo "4. Start local backend on port $LOCAL_PORT"
    echo "5. Configure it to connect to VPS at $VPS_IP"
    exit 1
fi

echo -e "${BLUE}🚀 Setting up local backend to connect to VPS at $VPS_IP...${NC}"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "backend/app/main.py" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check Python installation
echo -e "${BLUE}🐍 Checking Python installation...${NC}"
if ! command -v python3 >/dev/null 2>&1; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    echo "Please install Python 3.8+ and try again"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION found${NC}"

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo -e "${BLUE}🔧 Creating virtual environment...${NC}"
    cd backend
    python3 -m venv venv
    cd ..
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${BLUE}🔧 Activating virtual environment...${NC}"
source backend/venv/bin/activate
echo -e "${GREEN}✅ Virtual environment activated${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Create local environment file
echo -e "${BLUE}🔧 Creating local environment configuration...${NC}"
cat > backend/.env.local << EOF
# Local Backend Configuration
APP_HOST=0.0.0.0
APP_PORT=$LOCAL_PORT
ALLOWED_ORIGINS=*

# Connect to VPS services
OLLAMA_BASE_URL=http://$VPS_IP:11434
OLLAMA_MODEL=llama3.1:8b

# Whisper configuration (will use local models)
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=auto
WHISPER_DOWNLOAD_ROOT=./models

# Basic Auth (optional)
BASIC_AUTH_USERNAME=
BASIC_AUTH_PASSWORD=

# Logging
LOG_LEVEL=INFO
EOF

echo -e "${GREEN}✅ Local environment file created: backend/.env.local${NC}"

# Create models directory
mkdir -p backend/models

# Test VPS connectivity
echo -e "${BLUE}🔍 Testing VPS connectivity...${NC}"
if curl -s -f --max-time 10 "http://$VPS_IP:11434/api/tags" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama service is reachable${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama service is not reachable - check VPS status${NC}"
fi

if curl -s -f --max-time 10 "http://$VPS_IP:8000/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend service is reachable${NC}"
else
    echo -e "${YELLOW}⚠️  Backend service is not reachable - check VPS status${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Starting local backend...${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Local backend will run on: http://localhost:$LOCAL_PORT${NC}"
echo -e "${GREEN}✅ Connecting to VPS at: $VPS_IP${NC}"
echo ""
echo -e "${BLUE}📋 Available endpoints:${NC}"
echo "- Health check: http://localhost:$LOCAL_PORT/api/health"
echo "- API docs: http://localhost:$LOCAL_PORT/docs"
echo ""
echo -e "${BLUE}🔄 To stop the backend: Press Ctrl+C${NC}"
echo -e "${BLUE}🔄 To restart: Run this script again${NC}"
echo ""

# Start the backend
cd backend
# Export only non-comment lines
export $(grep -v '^#' .env.local | xargs)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $LOCAL_PORT
