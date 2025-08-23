#!/bin/bash

# ===== On-Prem AI Note Taker - VPS Service Restart Script =====
# This script restarts all services with updated codebase including Redis
# Run this after updating your code: ./restart-services.sh

set -e  # Exit on any error

echo "🚀 Starting VPS Service Restart Process..."
echo "=========================================="

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker is not running. Starting Docker service..."
        sudo systemctl start docker
        sleep 3
        if ! docker info > /dev/null 2>&1; then
            echo "❌ Failed to start Docker. Please check Docker installation."
            exit 1
        fi
    fi
    echo "✅ Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    if ! docker compose version > /dev/null 2>&1; then
        echo "❌ Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    echo "✅ Docker Compose is available"
}

# Function to update codebase from Git
update_codebase() {
    echo ""
    echo "📥 Updating codebase from Git..."
    echo "================================"
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        echo "❌ Not a git repository. Skipping git update."
        return
    fi
    
    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  Warning: You have uncommitted changes:"
        git status --short
        echo ""
        read -p "Do you want to stash changes before pulling? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "📦 Stashing uncommitted changes..."
            git stash push -m "Auto-stash before restart: $(date)"
            echo "✅ Changes stashed"
        else
            echo "❌ Aborting due to uncommitted changes. Please commit or stash them first."
            exit 1
        fi
    fi
    
    # Fetch latest changes
    echo "📡 Fetching latest changes from remote..."
    git fetch origin
    
    # Check if we're behind the remote
    local current_branch=$(git branch --show-current)
    local behind_count=$(git rev-list HEAD..origin/$current_branch --count)
    
    if [ "$behind_count" -gt 0 ]; then
        echo "🔄 Pulling $behind_count new commits from origin/$current_branch..."
        git pull origin $current_branch
        echo "✅ Codebase updated successfully"
    else
        echo "✅ Codebase is already up to date"
    fi
    
    # Show current commit info
    echo ""
    echo "📋 Current commit info:"
    echo "   Branch: $(git branch --show-current)"
    echo "   Commit: $(git rev-parse --short HEAD)"
    echo "   Message: $(git log -1 --pretty=format:'%s')"
    echo "   Date: $(git log -1 --pretty=format:'%cd' --date=short)"
}

# Function to show current service status
show_status() {
    echo ""
    echo "📊 Current Service Status:"
    echo "=========================="
    docker compose ps
}

# Function to stop services
stop_services() {
    echo ""
    echo "🛑 Stopping all services..."
    echo "==========================="
    docker compose down
    echo "✅ All services stopped"
}

# Function to clean up (optional)
cleanup() {
    echo ""
    echo "🧹 Cleaning up Docker resources..."
    echo "================================"
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images (optional - uncomment if you want to clean images)
    # docker image prune -f
    
    # Remove unused networks
    docker network prune -f
    
    echo "✅ Cleanup completed"
}

# Function to start services
start_services() {
    echo ""
    echo "🚀 Starting services with updated codebase..."
    echo "============================================="
    
    # Build and start services
    docker compose up -d --build
    
    echo "✅ Services started successfully"
}

# Function to wait for services to be healthy
wait_for_health() {
    echo ""
    echo "⏳ Waiting for services to be healthy..."
    echo "======================================="
    
    local max_attempts=30
    local attempt=1
    
    # Wait for Redis to be healthy first
    echo "🔍 Checking Redis health..."
    while [ $attempt -le $max_attempts ]; do
        if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis is healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ Redis health check failed after $max_attempts attempts"
            echo "Checking Redis logs..."
            docker compose logs redis
            exit 1
        fi
        
        echo "⏳ Redis not ready yet, waiting 5 seconds... (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    # Reset attempt counter for backend check
    attempt=1
    
    # Wait for backend to be healthy
    echo "🔍 Checking Backend health..."
    while [ $attempt -le $max_attempts ]; do
        echo "Checking backend health... (attempt $attempt/$max_attempts)"
        
        # Check if backend is responding
        if curl -s -f "http://localhost:8000/api/health" > /dev/null 2>&1; then
            echo "✅ Backend is healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ Backend health check failed after $max_attempts attempts"
            echo "Checking service logs..."
            docker compose logs backend
            exit 1
        fi
        
        echo "⏳ Backend not ready yet, waiting 5 seconds..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    # Wait for Ollama to be healthy
    echo "🔍 Checking Ollama health..."
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker compose exec -T ollama ollama list > /dev/null 2>&1; then
            echo "✅ Ollama is healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ Ollama health check failed after $max_attempts attempts"
            echo "Checking Ollama logs..."
            docker compose logs ollama
            exit 1
        fi
        
        echo "⏳ Ollama not ready yet, waiting 5 seconds... (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
}

# Function to show final status
show_final_status() {
    echo ""
    echo "🎉 Service Restart Complete!"
    echo "============================"
    echo ""
    echo "📊 Final Service Status:"
    docker compose ps
    echo ""
    echo "🌐 Service URLs:"
    echo "   Backend API: http://$(curl -s ifconfig.me):8000"
    echo "   Ollama: http://$(curl -s ifconfig.me):11434"
    echo "   Redis: redis://$(curl -s ifconfig.me):6385"
    echo ""
    echo "⚡ Performance Optimizations Applied:"
    echo "   ✅ Docker resource limits (prevents 100% CPU usage)"
    echo "   ✅ Whisper model caching (loads once, reuses)"
    echo "   ✅ Ollama connection pooling (faster requests)"
    echo "   ✅ int8 compute type (2-3x faster transcription)"
    echo "   ✅ Queue system with 2 workers (handles concurrent users)"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Update your local frontend .env.local with the new backend URL"
    echo "   2. Test the connection from your local machine"
    echo "   3. Monitor resource usage: docker stats"
    echo "   4. Check the logs if you encounter any issues: docker compose logs"
    echo "   5. For 20+ users, consider scaling Redis workers if needed"
}

# Main execution
main() {
    echo "🔄 VPS Service Restart Script (Optimized for 20+ Users)"
    echo "======================================================="
    echo "This script will:"
    echo "  1. Check Docker and Docker Compose availability"
    echo "  2. Update codebase from Git repository (auto-stash uncommitted changes)"
    echo "  3. Stop all running Docker services gracefully"
    echo "  4. Clean up unused Docker resources (containers, networks)"
    echo "  5. Rebuild and start services with performance optimizations"
    echo "  6. Wait for all services (Redis, Backend, Ollama) to be healthy"
    echo "  7. Display final service status and resource usage"
    echo ""
    echo "🎯 Performance Settings:"
    echo "   • Ollama: 4 CPU cores, 12GB RAM limit"
    echo "   • Redis: 2 CPU cores, 4GB RAM limit"
    echo "   • Backend: Unlimited (for API performance)"
    echo "   • Whisper: int8 compute, base model"
    echo ""
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Update codebase from Git
    update_codebase
    
    # Show current status
    show_status
    
    # Stop services
    stop_services
    
    # Cleanup
    cleanup
    
    # Start services
    start_services
    
    # Wait for health
    wait_for_health
    
    # Show final status
    show_final_status
}

# Run main function
main "$@"
