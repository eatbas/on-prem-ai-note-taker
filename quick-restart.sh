#!/bin/bash

# Simple and Fast Service Restart Script 🚀
# No timeouts, no hanging - just reliable restarts!

set -e

echo "🚀 Quick Service Restart (No Hanging Edition)"
echo "============================================="

# Check Docker
echo "🔍 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker not running. Starting..."
    sudo systemctl start docker
    sleep 2
fi
echo "✅ Docker is ready"

# Stop services
echo "🛑 Stopping services..."
docker compose down 2>/dev/null || true
echo "✅ Services stopped"

# Quick cleanup
echo "🧹 Quick cleanup..."
docker container prune -f > /dev/null 2>&1 || true
echo "✅ Cleanup done"

# Start services
echo "🚀 Starting services..."
docker compose up -d --build
echo "✅ Services starting..."

# Simple health check (no timeouts)
echo "🔍 Quick health check..."
sleep 10

# Check if containers are running
if docker compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "📊 Service Status:"
    docker compose ps
    echo ""
    echo "🌐 Your services are ready at:"
    echo "   Backend: http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost'):8000"
    echo "   Ollama: http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost'):11434"
    echo ""
    echo "🎉 Restart completed successfully!"
else
    echo "⚠️  Some services may still be starting..."
    echo "📊 Current status:"
    docker compose ps
    echo ""
    echo "💡 Give them a few more minutes to fully start up"
fi
