#!/bin/bash

# ===== On-Prem AI Note Taker - VPS Service Restart Script =====
# This script restarts all services with updated codebase
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
    
    while [ $attempt -le $max_attempts ]; do
        echo "Checking health... (attempt $attempt/$max_attempts)"
        
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
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Update your local frontend .env.local with the new backend URL"
    echo "   2. Test the connection from your local machine"
    echo "   3. Check the logs if you encounter any issues: docker compose logs"
}

# Main execution
main() {
    echo "🔄 VPS Service Restart Script"
    echo "============================="
    echo "This script will:"
    echo "  1. Check Docker and Docker Compose"
    echo "  2. Stop all running services"
    echo "  3. Clean up Docker resources"
    echo "  4. Start services with updated code"
    echo "  5. Wait for services to be healthy"
    echo "  6. Show final status"
    echo ""
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
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
