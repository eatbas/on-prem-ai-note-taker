#!/bin/bash

# Build script for Tauri application
set -e

echo "🚀 Building dgMeets Tauri Application"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v rustc &> /dev/null; then
        print_error "Rust is not installed. Please install Rust from https://rustup.rs/"
        exit 1
    fi

    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed. Please install Rust from https://rustup.rs/"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install Node.js from https://nodejs.org/"
        exit 1
    fi

    if ! command -v tauri &> /dev/null; then
        print_warning "Tauri CLI not found globally, using npx"
    fi

    print_status "All dependencies found"
}

# Build frontend
build_frontend() {
    print_status "Building frontend..."
    cd frontend

    if [ ! -d "node_modules" ]; then
        print_warning "Installing frontend dependencies..."
        npm install
    fi

    npm run build
    cd ..
    print_status "Frontend built successfully"
}

# Build Tauri application
build_tauri() {
    local target=$1

    print_status "Building Tauri application for $target..."

    case $target in
        "windows")
            npm run tauri:build:windows
            ;;
        "macos")
            npm run tauri:build:macos
            ;;
        "linux")
            npm run tauri:build:linux
            ;;
        "all")
            npm run tauri:build:all
            ;;
        *)
            npm run tauri:build
            ;;
    esac

    print_status "Tauri build completed"
}

# Main build process
main() {
    local target="all"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --target=*)
                target="${1#*=}"
                shift
                ;;
            --help)
                echo "Usage: $0 [--target=windows|macos|linux|all]"
                echo "Build Tauri application for specified platform"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    print_status "Starting build process for target: $target"

    check_dependencies
    build_frontend
    build_tauri "$target"

    print_status "Build completed successfully!"
    print_status "Check the 'src-tauri/target/release/bundle/' directory for installers"
}

# Run main function
main "$@"
