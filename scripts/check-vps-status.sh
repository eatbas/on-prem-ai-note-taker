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

if [ -z "$VPS_IP" ]; then
    echo -e "${RED}Usage: $0 <VPS_IP> [VPS_USER]${NC}"
    echo "Example: $0 192.168.1.100 ubuntu"
    exit 1
fi

echo -e "${BLUE}🔍 Checking VPS status for $VPS_IP...${NC}"
echo "=================================================="

# Function to check if a port is open
check_port() {
    local port=$1
    local service=$2
    
    if timeout 5 bash -c "</dev/tcp/$VPS_IP/$port" 2>/dev/null; then
        echo -e "${GREEN}✅ $service (port $port): OPEN${NC}"
        return 0
    else
        echo -e "${RED}❌ $service (port $port): CLOSED${NC}"
        return 1
    fi
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local port=$1
    local endpoint=$2
    local service=$3
    
    if curl -s -f --max-time 10 "http://$VPS_IP:$port$endpoint" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $service HTTP endpoint: RESPONDING${NC}"
        return 0
    else
        echo -e "${RED}❌ $service HTTP endpoint: NOT RESPONDING${NC}"
        return 1
    fi
}

# Function to check Docker service status
check_docker_service() {
    local service=$1
    local port=$2
    
    echo -e "${BLUE}📋 Checking $service service...${NC}"
    
    # Check if port is open
    if check_port $port $service; then
        # Try to get service info via SSH if possible
        if command -v ssh >/dev/null 2>&1; then
            echo -e "${BLUE}🔧 Attempting to get detailed service status...${NC}"
            ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" \
                "docker compose ps $service 2>/dev/null || echo 'Service not found'" 2>/dev/null || true
        fi
    fi
}

# Check basic connectivity
echo -e "${BLUE}🌐 Checking basic connectivity...${NC}"
if ping -c 3 -W 5 "$VPS_IP" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ VPS is reachable${NC}"
else
    echo -e "${RED}❌ VPS is not reachable${NC}"
    exit 1
fi

# Check SSH access
echo -e "${BLUE}🔑 Checking SSH access...${NC}"
if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH access: OK${NC}"
    SSH_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  SSH access: FAILED (continuing with port checks only)${NC}"
    SSH_AVAILABLE=false
fi

echo ""
echo -e "${BLUE}🔍 Checking service ports...${NC}"
echo "=================================================="

# Check all required ports
check_port 11434 "Ollama"
check_port 8000 "Backend API"

echo ""
echo -e "${BLUE}🔍 Checking HTTP endpoints...${NC}"
echo "=================================================="

# Check backend health endpoint
check_http_endpoint 8000 "/api/health" "Backend Health"

# Check Ollama API
if check_port 11434 "Ollama"; then
    if curl -s -f --max-time 10 "http://$VPS_IP:11434/api/tags" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama API: RESPONDING${NC}"
    else
        echo -e "${RED}❌ Ollama API: NOT RESPONDING${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🔍 Checking Docker services...${NC}"
echo "=================================================="

# If SSH is available, get detailed Docker service status
if [ "$SSH_AVAILABLE" = true ]; then
    echo -e "${BLUE}📊 Getting detailed service status...${NC}"
    
    # Check Docker Compose status
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" \
        "cd on-prem-ai-note-taker && docker compose ps" 2>/dev/null || echo "Could not get Docker Compose status"
    
    # Check service logs for any errors
    echo ""
    echo -e "${BLUE}📋 Checking recent service logs...${NC}"
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" \
        "cd on-prem-ai-note-taker && docker compose logs --tail=10" 2>/dev/null || echo "Could not get service logs"
    
    # Check if models are available
    echo ""
    echo -e "${BLUE}🤖 Checking Ollama models...${NC}"
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" \
        "docker compose exec -T ollama ollama list 2>/dev/null || echo 'Could not check models'" 2>/dev/null || echo "Could not check models"
fi

echo ""
echo -e "${BLUE}📋 Summary${NC}"
echo "=================================================="

# Count successful checks
SUCCESS_COUNT=0
TOTAL_CHECKS=0

# Port checks
if check_port 11434 "Ollama" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if check_port 8000 "Backend API" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# HTTP endpoint checks
if check_http_endpoint 8000 "/api/health" "Backend Health" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if curl -s -f --max-time 10 "http://$VPS_IP:11434/api/tags" >/dev/null 2>&1; then SUCCESS_COUNT=$((SUCCESS_COUNT + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo -e "${BLUE}📊 Overall Status: $SUCCESS_COUNT/$TOTAL_CHECKS services are running${NC}"

if [ $SUCCESS_COUNT -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}🎉 VPS is running correctly! All services are operational.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. ✅ VPS is ready"
    echo "2. 🔧 Set up local backend environment"
    echo "3. 🚀 Start local backend"
    echo "4. 🌐 Configure frontend to connect to VPS"
else
    echo -e "${YELLOW}⚠️  Some services are not running correctly.${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting steps:${NC}"
    echo "1. SSH into VPS: ssh $VPS_USER@$VPS_IP"
    echo "2. Check Docker services: cd on-prem-ai-note-taker && docker compose ps"
    echo "3. View logs: docker compose logs [service_name]"
    echo "4. Restart services: docker compose restart"
fi

echo ""
echo -e "${BLUE}🔧 To set up local backend:${NC}"
echo "1. Copy VPS IP: $VPS_IP"
echo "2. Update local environment variables"
echo "3. Run: cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001"
