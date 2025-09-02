#!/bin/bash

# =============================================================================
# VPS Whisper Cleanup Script
# =============================================================================
# This script removes all Whisper-related Docker services from your VPS
# Run this script on your VPS after deploying the updated docker-compose.yml

echo "🧹 Starting VPS Whisper Cleanup..."
echo "======================================="

# Stop and remove whisper-cpp container if it exists
echo "📦 Stopping whisper-cpp container..."
if docker ps -a | grep -q whisper-cpp; then
    docker stop whisper-cpp 2>/dev/null || true
    docker rm whisper-cpp 2>/dev/null || true
    echo "✅ whisper-cpp container removed"
else
    echo "ℹ️  whisper-cpp container not found"
fi

# Remove whisper-cpp image if it exists
echo "🖼️  Removing whisper-cpp image..."
if docker images | grep -q whisper-cpp; then
    docker rmi $(docker images | grep whisper-cpp | awk '{print $3}') 2>/dev/null || true
    echo "✅ whisper-cpp image removed"
else
    echo "ℹ️  whisper-cpp image not found"
fi

# Remove whisper-related volumes
echo "💾 Removing whisper-related volumes..."
docker volume rm whisper_models 2>/dev/null || echo "ℹ️  whisper_models volume not found"
docker volume rm whisper_cpp_models 2>/dev/null || echo "ℹ️  whisper_cpp_models volume not found"
docker volume rm on-prem-ai-note-taker_whisper_models 2>/dev/null || echo "ℹ️  prefixed whisper_models volume not found"
docker volume rm on-prem-ai-note-taker_whisper_cpp_models 2>/dev/null || echo "ℹ️  prefixed whisper_cpp_models volume not found"

echo "✅ Whisper volumes cleanup complete"

# Clean up unused volumes and images
echo "🗑️  Cleaning up unused Docker resources..."
docker system prune -f --volumes
echo "✅ Docker cleanup complete"

# Show current Docker status
echo ""
echo "📊 Current Docker Status:"
echo "========================="
echo "🐳 Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Active volumes:"
docker volume ls --format "table {{.Name}}\t{{.Driver}}"

echo ""
echo "💻 Memory usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "🎉 VPS Whisper Cleanup Complete!"
echo "================================="
echo "✅ whisper-cpp service removed"
echo "✅ whisper-cpp Docker image removed"  
echo "✅ whisper-related volumes removed"
echo "✅ Docker system cleaned up"
echo ""
echo "💡 Resources freed up:"
echo "   - CPU: 6.0 cores (previously used by whisper-cpp)"
echo "   - Memory: 6GB (previously used by whisper-cpp)"
echo "   - Storage: ~3GB (whisper models and container)"
echo ""
echo "🚀 Your VPS now runs only:"
echo "   - Ollama (AI summarization)"
echo "   - Redis (job queue)"
echo "   - Backend (meeting management)"
echo ""
echo "🖥️  All Whisper processing is now handled locally in your Tauri desktop app!"
