#!/bin/bash

# Centralized Environment Setup Script
# This script helps manage the single .env file configuration

set -e

echo "🔧 Setting up centralized environment configuration..."

PROJECT_ROOT="$(dirname "$0")/.."
cd "$PROJECT_ROOT"

# Function to copy main env to .env
setup_env() {
    if [ ! -f ".env" ]; then
        if [ -f "env.example" ]; then
            echo "📋 Copying env.example to .env..."
            cp env.example .env
            echo "✅ Created .env from env.example"
        else
            echo "❌ env.example not found!"
            exit 1
        fi
    else
        echo "✅ .env file already exists"
    fi
}

# Function to install dependencies with centralized config
install_deps() {
    echo "📦 Installing dependencies..."
    
    # Backend dependencies (includes python-dotenv for env loading)
    if [ -f "backend/requirements.txt" ]; then
        echo "📦 Installing backend dependencies..."
        cd backend
        pip install -r requirements.txt
        cd ..
    fi
    
    # Frontend dependencies
    if [ -f "frontend/package.json" ]; then
        echo "📦 Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
    fi
    
    # Electron dependencies
    if [ -f "electron/package.json" ]; then
        echo "📦 Installing electron dependencies..."
        cd electron
        npm install
        cd ..
    fi
}

# Function to remove old env files
cleanup_old_env_files() {
    echo "🧹 Cleaning up old environment files..."
    
    # Remove old env files (but keep examples for reference)
    [ -f "backend/.env" ] && rm backend/.env && echo "🗑️ Removed backend/.env"
    [ -f "backend/.env.local" ] && rm backend/.env.local && echo "🗑️ Removed backend/.env.local"
    [ -f "frontend/.env" ] && rm frontend/.env && echo "🗑️ Removed frontend/.env"
    [ -f "frontend/.env.local" ] && rm frontend/.env.local && echo "🗑️ Removed frontend/.env.local"
    
    echo "✅ Cleanup complete - now using centralized .env file only"
}

# Function to test the configuration
test_config() {
    echo "🧪 Testing centralized configuration..."
    
    # Test backend can load env
    if [ -f "backend/app/core/env_loader.py" ]; then
        echo "✅ Backend env loader found"
    else
        echo "❌ Backend env loader missing"
    fi
    
    # Test frontend can load env
    if [ -f "frontend/src/utils/envLoader.ts" ]; then
        echo "✅ Frontend env loader found"
    else
        echo "❌ Frontend env loader missing"
    fi
    
    # Test vite config
    if [ -f "vite.frontend.config.js" ]; then
        echo "✅ Centralized Vite config found"
    else
        echo "❌ Centralized Vite config missing"
    fi
}

# Main execution
main() {
    echo "🚀 Centralized Environment Setup"
    echo "=================================="
    
    setup_env
    install_deps
    cleanup_old_env_files
    test_config
    
    echo ""
    echo "🎉 Centralized configuration setup complete!"
    echo ""
    echo "📋 Key changes:"
    echo "   ✅ All configuration now in root .env file"
    echo "   ✅ Backend loads from root .env via env_loader.py"
    echo "   ✅ Frontend loads from root .env via envLoader.ts"
    echo "   ✅ Docker Compose uses env_file: .env"
    echo "   ✅ Electron updates root .env file"
    echo ""
    echo "🔄 To modify settings:"
    echo "   Edit .env file in project root"
    echo "   Restart services to apply changes"
    echo ""
    echo "🚀 Ready to start services!"
}

# Handle command line arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "cleanup")
        cleanup_old_env_files
        ;;
    "test")
        test_config
        ;;
    *)
        echo "Usage: $0 [setup|cleanup|test]"
        echo "  setup   - Full centralized setup (default)"
        echo "  cleanup - Remove old env files"
        echo "  test    - Test configuration"
        exit 1
        ;;
esac
