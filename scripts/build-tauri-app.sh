#!/bin/bash

# =============================================================================
# Tauri Desktop App - Production Build Script
# =============================================================================
# This script builds your offline-first AI note taker for production

set -e  # Exit on any error

echo "🏗️  Building Tauri Desktop App for Production"
echo "=============================================="

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

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Source Rust environment if it exists
if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
fi

# =============================================================================
# 1. PRE-BUILD VALIDATION
# =============================================================================

print_info "🔍 Pre-build validation..."

# Check environment
if [[ ! -f ".env" ]]; then
    print_warning ".env file not found, copying from env.example"
    cp env.example .env
fi

# Test compilation first
print_info "Testing compilation..."
cd src-tauri
if ! cargo check --quiet; then
    print_error "Rust compilation failed. Fix errors before building."
    exit 1
fi
print_status "Rust code compiles successfully"

cd ../frontend
if ! npm run type-check; then
    print_error "TypeScript compilation failed. Fix errors before building."
    exit 1
fi
print_status "TypeScript compiles successfully"

cd ..

# =============================================================================
# 2. DEPENDENCY INSTALLATION
# =============================================================================

print_info "📦 Installing production dependencies..."

# Frontend dependencies
cd frontend
npm ci --only=production
print_status "Frontend production dependencies installed"

# Rust dependencies are handled by Cargo during build

cd ..

# =============================================================================
# 3. PRODUCTION BUILD
# =============================================================================

print_info "🏗️  Starting production build..."

# Set production environment
export RUST_LOG=warn
export TAURI_DEBUG=false
export NODE_ENV=production

cd src-tauri

print_info "Building Tauri application..."
print_warning "This may take 5-10 minutes depending on your system..."

# Build with optimizations
if cargo tauri build; then
    print_status "Production build completed successfully!"
else
    print_error "Production build failed"
    exit 1
fi

# =============================================================================
# 4. BUILD ARTIFACTS
# =============================================================================

print_info "📁 Locating build artifacts..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    BUILD_DIR="target/release/bundle/macos"
    if [[ -d "$BUILD_DIR" ]]; then
        print_status "macOS app bundle created:"
        find "$BUILD_DIR" -name "*.app" -type d | head -1
        
        DMG_DIR="target/release/bundle/dmg"
        if [[ -d "$DMG_DIR" ]]; then
            print_status "macOS DMG installer created:"
            find "$DMG_DIR" -name "*.dmg" | head -1
        fi
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    BUILD_DIR="target/release/bundle"
    if [[ -d "$BUILD_DIR/deb" ]]; then
        print_status "Linux DEB package created:"
        find "$BUILD_DIR/deb" -name "*.deb" | head -1
    fi
    if [[ -d "$BUILD_DIR/appimage" ]]; then
        print_status "Linux AppImage created:"
        find "$BUILD_DIR/appimage" -name "*.AppImage" | head -1
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    BUILD_DIR="target/release/bundle/msi"
    if [[ -d "$BUILD_DIR" ]]; then
        print_status "Windows MSI installer created:"
        find "$BUILD_DIR" -name "*.msi" | head -1
    fi
    
    NSIS_DIR="target/release/bundle/nsis"
    if [[ -d "$NSIS_DIR" ]]; then
        print_status "Windows NSIS installer created:"
        find "$NSIS_DIR" -name "*.exe" | head -1
    fi
fi

# =============================================================================
# 5. BUILD SUMMARY
# =============================================================================

echo ""
print_status "🎉 Production build complete!"
echo ""
echo "📱 Your offline-first AI note taker is ready:"
echo ""
echo "✅ Features included:"
echo "   • Native system audio capture"
echo "   • Local Whisper Large-v3 AI"
echo "   • Speaker diarization" 
echo "   • English/Turkish language support"
echo "   • CPU/GPU auto-detection"
echo "   • Offline-first operation"
echo "   • VPS AI summarization integration"
echo ""
echo "📁 Build artifacts location:"
echo "   • macOS: src-tauri/target/release/bundle/macos/"
echo "   • Linux: src-tauri/target/release/bundle/deb/"
echo "   • Windows: src-tauri/target/release/bundle/msi/"
echo ""
echo "🚀 Ready for distribution!"

cd ..
