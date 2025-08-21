#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found in current directory${NC}"
    echo ""
    echo -e "${BLUE}To create a .env file:${NC}"
    echo "1. Run: python py/generate_env.py"
    echo "2. Or manually create .env file with VPS_HOST=your_vps_ip"
    echo ""
    echo -e "${BLUE}Example .env content:${NC}"
    echo "VPS_HOST=192.168.1.100"
    echo "VPS_USER=ubuntu"
    echo "VPS_PORT=22"
    exit 1
fi

# Function to get value from .env file
get_env_value() {
    local key=$1
    local value
    
    # Try to get value from .env file
    if value=$(grep "^${key}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'"); then
        echo "$value"
    else
        echo ""
    fi
}

# Get VPS information from .env file
VPS_HOST=$(get_env_value "VPS_HOST")
VPS_USER=$(get_env_value "VPS_USER")
VPS_PORT=$(get_env_value "VPS_PORT")

# Set defaults if not found
VPS_USER=${VPS_USER:-root}
VPS_PORT=${VPS_PORT:-22}

# Check if VPS_HOST is set
if [ -z "$VPS_HOST" ]; then
    echo -e "${RED}❌ VPS_HOST not found in .env file${NC}"
    echo ""
    echo -e "${BLUE}Please add VPS_HOST to your .env file:${NC}"
    echo "VPS_HOST=your_vps_ip_address"
    echo ""
    echo -e "${BLUE}Example:${NC}"
    echo "VPS_HOST=192.168.1.100"
    exit 1
fi

echo -e "${BLUE}🔍 VPS Configuration from .env file:${NC}"
echo "=================================================="
echo -e "${GREEN}✅ VPS Host: $VPS_HOST${NC}"
echo -e "${GREEN}✅ VPS User: $VPS_USER${NC}"
echo -e "${GREEN}✅ VPS Port: $VPS_PORT${NC}"
echo ""

# Ask user what they want to do
echo -e "${BLUE}🚀 What would you like to do?${NC}"
echo "1. 🔍 Check VPS status"
echo "2. 🚀 Set up local backend"
echo "3. 🧪 Test connections"
echo "4. 🚀 Quick start (check + setup)"
echo "5. 📋 Show VPS info only"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo -e "${BLUE}🔍 Checking VPS status...${NC}"
        ./scripts/check-vps-status.sh "$VPS_HOST" "$VPS_USER"
        ;;
    2)
        echo -e "${BLUE}🚀 Setting up local backend...${NC}"
        ./scripts/setup-local-backend.sh "$VPS_HOST"
        ;;
    3)
        echo -e "${BLUE}🧪 Testing connections...${NC}"
        ./scripts/test-connection.sh "$VPS_HOST"
        ;;
    4)
        echo -e "${BLUE}🚀 Quick start...${NC}"
        ./scripts/quick-start.sh "$VPS_HOST" "$VPS_USER"
        ;;
    5)
        echo -e "${BLUE}📋 VPS Information:${NC}"
        echo "=================================================="
        echo -e "Host: $VPS_HOST"
        echo -e "User: $VPS_USER"
        echo -e "Port: $VPS_PORT"
        echo ""
        echo -e "${BLUE}🔧 Manual commands:${NC}"
        echo "Check VPS: ./scripts/check-vps-status.sh $VPS_HOST $VPS_USER"
        echo "Setup backend: ./scripts/setup-local-backend.sh $VPS_HOST"
        echo "Test connections: ./scripts/test-connection.sh $VPS_HOST"
        echo "Quick start: ./scripts/quick-start.sh $VPS_HOST $VPS_USER"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Please run the script again.${NC}"
        exit 1
        ;;
esac
