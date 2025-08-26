#!/usr/bin/env bash

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APPLY_UFW=false
if [[ "${1:-}" == "--apply-ufw" ]]; then
  APPLY_UFW=true
fi

echo -e "${BLUE}🌐 Fix External Access (ports 8000, 11434)${NC}"
echo "=================================================="

# Public/Private IP
echo -e "${BLUE}🔎 Detecting IP addresses...${NC}"
PRIVATE_IPS=$(hostname -I 2>/dev/null || echo "N/A")
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 https://ipinfo.io/ip || echo "N/A")
echo -e "Private IPs: ${GREEN}${PRIVATE_IPS}${NC}"
echo -e "Public IP:  ${GREEN}${PUBLIC_IP}${NC}"
echo ""

# Compose status
echo -e "${BLUE}🐳 Checking Docker Compose services...${NC}"
docker compose ps | cat || echo -e "${YELLOW}⚠️  docker compose not available${NC}"
echo ""

# Listening sockets
echo -e "${BLUE}🔌 Checking listening ports (8000, 11434)...${NC}"
ss -ltnp 2>/dev/null | grep -E ':8000|:11434' || echo "No listeners detected on 8000/11434"
echo ""

# Local HTTP checks
echo -e "${BLUE}🌍 Local HTTP checks...${NC}"
echo -n "Backend /api/health: "
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/health || echo "ERR"
echo -n "Ollama /api/version: "
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:11434/api/version || echo "ERR"
echo ""

# UFW
echo -e "${BLUE}🧱 UFW firewall...${NC}"
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -n1 || echo "inactive")
  echo "UFW Status: ${UFW_STATUS}"
  NEED_8000_ALLOW=false
  NEED_11434_ALLOW=false
  if [[ "${UFW_STATUS}" == *"active"* ]]; then
    ufw status numbered 2>/dev/null | cat
    if ! ufw status | grep -qE '8000/tcp.*ALLOW|ALLOW.*8000'; then NEED_8000_ALLOW=true; fi
    if ! ufw status | grep -qE '11434/tcp.*ALLOW|ALLOW.*11434'; then NEED_11434_ALLOW=true; fi
    if ${NEED_8000_ALLOW} || ${NEED_11434_ALLOW}; then
      echo -e "${YELLOW}⚠️  Required UFW allows missing${NC}"
      if ${APPLY_UFW}; then
        [[ ${NEED_8000_ALLOW} == true ]] && { echo "Applying: ufw allow 8000/tcp"; sudo ufw allow 8000/tcp || true; }
        [[ ${NEED_11434_ALLOW} == true ]] && { echo "Applying: ufw allow 11434/tcp"; sudo ufw allow 11434/tcp || true; }
        echo "Reloading UFW (if needed)..."; sudo ufw reload || true
      else
        echo -e "Run with --apply-ufw to auto-open required ports."
      fi
    else
      echo -e "${GREEN}✅ UFW allows for 8000 and 11434 are present${NC}"
    fi
  else
    echo "UFW is not active."
  fi
else
  echo "UFW not installed."
fi
echo ""

# iptables/nftables hint
echo -e "${BLUE}🧩 Kernel firewall (iptables/nftables) quick view...${NC}"
if command -v nft >/dev/null 2>&1; then
  sudo nft list ruleset | head -n 60 || true
elif command -v iptables >/dev/null 2>&1; then
  sudo iptables -S | head -n 60 || true
else
  echo "No nftables/iptables commands available."
fi
echo ""

echo -e "${BLUE}🧭 Next steps from your local machine:${NC}"
echo "  curl -sSf http://${PUBLIC_IP}:8000/api/health || echo 'backend unreachable'"
echo "  curl -sSf http://${PUBLIC_IP}:11434/api/version || echo 'ollama unreachable'"
echo "If listeners are up and UFW allows, but calls still fail, check your cloud provider's firewall/security group to open TCP 8000 and 11434 to your IP or 0.0.0.0/0 as needed."
echo ""
echo -e "${GREEN}✅ Fix script completed${NC}"


