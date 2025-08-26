#!/bin/bash

set -euo pipefail

AUTO_FIX_UFW=false
if [[ "${1:-}" == "--auto-fix-ufw" ]]; then
  AUTO_FIX_UFW=true
fi

echo "=== VPS DIAGNOSTICS ==="
echo "Timestamp: $(date)"
echo ""

echo "=== HOST INFORMATION ==="
echo -n "Hostname: "; hostname || true
echo -n "Kernel: "; uname -a || true
echo -n "Private IPs: "; hostname -I 2>/dev/null || echo "N/A"
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 https://ipinfo.io/ip || echo "N/A")
echo "Public IP: ${PUBLIC_IP}"
echo ""

# 1. Docker Compose Status
echo "=== DOCKER COMPOSE STATUS ==="
docker compose ps 2>/dev/null || echo "Docker Compose not found"
echo ""

# 2. All Docker containers
echo "=== ALL DOCKER CONTAINERS ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not available"
echo ""

# 3. Network Binding Check
echo "=== NETWORK BINDING CHECK ==="
echo "Services listening on ports 11434 and 8000:"
ss -ltnp 2>/dev/null | grep -E ':11434|:8000' || echo "No services found listening on ports 11434 or 8000"
echo ""

# 4. Local HTTP Tests
echo "=== LOCAL HTTP TESTS ==="
echo "Testing Ollama /api/version locally:"
curl -sSf http://127.0.0.1:11434/api/version 2>/dev/null && echo "✅ SUCCESS" || echo "❌ FAILED"

echo "Testing Ollama /api/tags locally:"
curl -sSf http://127.0.0.1:11434/api/tags 2>/dev/null && echo "✅ SUCCESS" || echo "❌ FAILED"

echo "Testing Backend /api/health locally:"
curl -sSf http://127.0.0.1:8000/api/health 2>/dev/null && echo "✅ SUCCESS" || echo "❌ FAILED"
echo ""

echo "=== FIREWALL CHECKS ==="
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -n1 || echo "inactive")
  echo "UFW Status: ${UFW_STATUS}"
  echo "UFW Rules (grep 8000/11434):"
  ufw status numbered 2>/dev/null | grep -E '8000|11434' || echo "No explicit UFW rules for 8000/11434"

  if [[ "${UFW_STATUS}" == *"active"* ]]; then
    if ! ufw status | grep -qE '8000/tcp.*ALLOW|ALLOW.*8000'; then
      echo "UFW: port 8000 not allowed"
      if [[ "$AUTO_FIX_UFW" == true ]]; then
        echo "Applying: ufw allow 8000/tcp"
        sudo ufw allow 8000/tcp || true
      fi
    fi
    if ! ufw status | grep -qE '11434/tcp.*ALLOW|ALLOW.*11434'; then
      echo "UFW: port 11434 not allowed"
      if [[ "$AUTO_FIX_UFW" == true ]]; then
        echo "Applying: ufw allow 11434/tcp"
        sudo ufw allow 11434/tcp || true
      fi
    fi
  fi
else
  echo "UFW not installed"
fi

echo ""
echo "=== IPTABLES (TOP 50 RULES) ==="
if command -v iptables >/dev/null 2>&1; then
  sudo iptables -S | head -n 50 || true
else
  echo "iptables not available"
fi

echo ""
echo "=== NFTABLES RULESET (TOP 80 LINES) ==="
if command -v nft >/dev/null 2>&1; then
  sudo nft list ruleset | head -n 80 || true
else
  echo "nft not in use"
fi

echo ""
# 5. Quick Docker logs
echo "=== DOCKER COMPOSE LOGS (last 20 lines) ==="
docker compose logs --tail=20 2>/dev/null || echo "Failed to get logs"
echo ""

echo "=== NEXT STEPS ==="
echo "From your local machine, test reachability:" 
echo "  curl -sSf http://${PUBLIC_IP}:8000/api/health"
echo "  curl -sSf http://${PUBLIC_IP}:11434/api/version"
echo "If these fail while services listen on 0.0.0.0 and UFW allows them, check your cloud provider's firewall/security group for ports 8000 and 11434 (TCP)."
echo ""
echo "Tip: Run with --auto-fix-ufw to auto-open ports via UFW if it is active."
echo ""
echo "=== DIAGNOSTICS COMPLETE ==="