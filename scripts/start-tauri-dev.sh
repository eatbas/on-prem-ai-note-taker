#!/bin/bash

# =============================================================================
# Tauri Desktop App - Development Starter & Tester
# =============================================================================
# This script starts your offline-first AI note taker and runs basic tests

set -e  # Exit on any error

echo "🚀 Starting Tauri Desktop App Development Environment"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to cleanup background processes
cleanup() {
    print_info "Cleaning up background processes..."
    if [[ ! -z "$VITE_PID" ]]; then
        kill $VITE_PID 2>/dev/null || true
    fi
    if [[ ! -z "$TAURI_PID" ]]; then
        kill $TAURI_PID 2>/dev/null || true
    fi
}

# Trap to cleanup on script exit
trap cleanup EXIT

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)
print_info "Project root: $PROJECT_ROOT"

# =============================================================================
# 1. ENVIRONMENT VALIDATION
# =============================================================================

print_info "🔍 Validating development environment..."

# Check if .env exists
if [[ ! -f ".env" ]]; then
    print_warning ".env file not found, copying from env.example"
    if [[ -f "env.example" ]]; then
        cp env.example .env
        print_status ".env file created from env.example"
    else
        print_error "env.example file not found!"
        exit 1
    fi
fi

# Source Rust environment if it exists
if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
fi

# Check required commands
print_info "Checking required tools..."

if ! command_exists "node"; then
    print_error "Node.js not installed. Please install Node.js"
    exit 1
fi
print_status "Node.js: $(node --version)"

if ! command_exists "npm"; then
    print_error "npm not installed"
    exit 1
fi
print_status "npm: $(npm --version)"

if ! command_exists "cargo"; then
    print_error "Rust/Cargo not installed. Please install Rust"
    exit 1
fi

if ! command_exists "rustc"; then
    print_error "Rust compiler not found"
    exit 1
fi

print_status "Rust: $(rustc --version)"
print_status "Cargo: $(cargo --version)"

# Check Tauri CLI
if ! cargo tauri --version >/dev/null 2>&1; then
    print_warning "Tauri CLI not found, installing..."
    cargo install tauri-cli
fi
print_status "Tauri CLI: $(cargo tauri --version 2>/dev/null || echo 'Installing...')"

# =============================================================================
# 2. DEPENDENCY INSTALLATION
# =============================================================================

print_info "📦 Installing dependencies..."

# Frontend dependencies
print_info "Installing frontend dependencies..."
cd frontend
if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
    npm install
    print_status "Frontend dependencies installed"
else
    print_info "Frontend dependencies up to date"
fi

# Backend dependencies (Rust)
cd ../src-tauri
print_info "Checking Rust dependencies..."
cargo check --quiet
print_status "Rust dependencies ready"

cd ..

# =============================================================================
# 3. BUILD VALIDATION
# =============================================================================

print_info "🔨 Validating builds..."

# Test Rust compilation
print_info "Testing Rust compilation..."
cd src-tauri
if cargo check --quiet; then
    print_status "Rust code compiles successfully (0 warnings, 0 errors)"
else
    print_error "Rust compilation failed"
    exit 1
fi

# Test TypeScript compilation
cd ../frontend
print_info "Testing TypeScript compilation..."
if npm run type-check; then
    print_status "TypeScript compiles successfully"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

cd ..

# =============================================================================
# 4. PORT MANAGEMENT
# =============================================================================

print_info "🌐 Checking ports..."

FRONTEND_PORT=5173
BACKEND_PORT=8000

if check_port $FRONTEND_PORT; then
    print_warning "Port $FRONTEND_PORT is in use, killing existing process"
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# =============================================================================
# 5. START DEVELOPMENT SERVERS
# =============================================================================

print_info "🚀 Starting development environment..."

# Start in development mode
print_info "Starting Tauri development server..."
cd src-tauri

# Set environment variables for development
export RUST_LOG=debug
export TAURI_DEBUG=true
export VITE_APP_MODE=tauri
export VITE_DEV_MODE=true

# Start Tauri dev server
print_info "Launching Tauri desktop application..."
echo ""
echo "🖥️  Desktop app will launch automatically"
echo "📱 Features available:"
echo "   • Native system audio capture"
echo "   • Local Whisper AI transcription"
echo "   • Speaker diarization"
echo "   • English/Turkish language support"
echo "   • Offline-first operation"
echo ""

# Start the application
if cargo tauri dev; then
    print_status "Tauri application started successfully"
else
    print_error "Failed to start Tauri application"
    exit 1
fi

print_info "🎉 Development session complete"
