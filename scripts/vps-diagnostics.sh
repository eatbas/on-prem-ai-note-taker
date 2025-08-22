#!/bin/bash

echo "=== VPS DIAGNOSTICS ==="
echo "Timestamp: $(date)"
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

# 5. Quick Docker logs
echo "=== DOCKER COMPOSE LOGS (last 20 lines) ==="
docker compose logs --tail=20 2>/dev/null || echo "Failed to get logs"
echo ""

echo "=== DIAGNOSTICS COMPLETE ==="