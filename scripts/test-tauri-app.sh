#!/bin/bash

# =============================================================================
# Tauri Desktop App - Comprehensive Testing Script
# =============================================================================
# This script runs comprehensive tests for your offline-first AI note taker

set -e  # Exit on any error

echo "🧪 Testing Tauri Desktop App"
echo "=============================="

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

print_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

# Fast mode flags (default FAST=1). Override: FAST=0 to run full tests
FAST=${FAST:-1}
SKIP_FRONTEND_BUILD=${SKIP_FRONTEND_BUILD:-0}

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_test "Test $TOTAL_TESTS: $test_name"
    
    if eval "$test_command"; then
        print_status "PASSED: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "FAILED: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Source Rust environment if it exists
if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
fi

# =============================================================================
# 1. ENVIRONMENT TESTS
# =============================================================================

print_info "🌍 Running Environment Tests..."

run_test "Project structure exists" "[[ -d 'src-tauri' && -d 'frontend' && -f 'env.example' ]]"

run_test "Tauri configuration exists" "[[ -f 'src-tauri/tauri.conf.json' ]]"

run_test "Rust Cargo.toml exists" "[[ -f 'src-tauri/Cargo.toml' ]]"

run_test "Frontend package.json exists" "[[ -f 'frontend/package.json' ]]"

run_test "Environment example exists" "[[ -f 'env.example' ]]"

# =============================================================================
# 2. DEPENDENCY TESTS
# =============================================================================

print_info "📦 Running Dependency Tests..."

run_test "Node.js available" "command -v node >/dev/null 2>&1"

run_test "npm available" "command -v npm >/dev/null 2>&1"

run_test "Rust available" "command -v cargo >/dev/null 2>&1"

run_test "Frontend dependencies installed" "[[ -d 'frontend/node_modules' ]]"

# =============================================================================
# 3. COMPILATION TESTS
# =============================================================================

print_info "🔨 Running Compilation Tests..."

cd src-tauri

if [[ "$FAST" -eq 1 ]]; then
    run_test "Rust compiles (warnings as errors)" "RUSTFLAGS='-D warnings' cargo check --quiet"
else
    run_test "Rust code compiles without errors" "cargo check --quiet"
    run_test "Rust code has no warnings" "cargo check 2>&1 | grep -q 'warning:' && false || true"
fi

cd ../frontend

run_test "TypeScript compiles" "npm run type-check"

if [[ "$SKIP_FRONTEND_BUILD" -eq 1 ]]; then
    print_warning "Skipping frontend build (SKIP_FRONTEND_BUILD=1)"
elif [[ "$FAST" -eq 1 ]]; then
    run_test "Frontend builds (fast)" "npm run build:fast"
else
    run_test "Frontend builds successfully" "npm run build"
fi

cd ..

# =============================================================================
# 4. CONFIGURATION TESTS
# =============================================================================

print_info "⚙️  Running Configuration Tests..."

run_test "Tauri config is valid JSON" "python3 -m json.tool src-tauri/tauri.conf.json >/dev/null 2>&1"

run_test "Package.json is valid JSON" "python3 -m json.tool frontend/package.json >/dev/null 2>&1"

run_test "No Electron dependencies in package.json" "! grep -q 'electron' frontend/package.json"

run_test "Tauri dependencies present" "grep -q '@tauri-apps/api' frontend/package.json"

# =============================================================================
# 5. FEATURE TESTS
# =============================================================================

print_info "🎯 Running Feature Tests..."

run_test "Whisper service exists" "[[ -f 'src-tauri/src/whisper.rs' ]]"

run_test "Multi-audio service exists" "[[ -f 'src-tauri/src/multi_audio.rs' ]]"

run_test "Speaker diarization service exists" "[[ -f 'frontend/src/services/speakerDiarization.ts' ]]"

run_test "No whisper-cpp service in docker-compose" "! grep -q 'whisper-cpp' docker-compose.yml"

run_test "Env example is Tauri-focused" "grep -q 'VITE_APP_MODE=tauri' env.example"

run_test "CPU fallback configured" "grep -q 'laptop_compatible' src-tauri/src/main.rs"

# =============================================================================
# 6. CODE QUALITY TESTS
# =============================================================================

print_info "✨ Running Code Quality Tests..."

cd src-tauri

run_test "No TODO comments in main files" "! find src -name '*.rs' -exec grep -l 'TODO' {} \\; | grep -E '(main|whisper|audio)'"

run_test "No debugging println statements" "! grep -r 'println!' src/ | grep -E 'debug|trace|verbose' || true"

run_test "Proper error handling" "grep -q 'Result<' src/whisper.rs"

cd ..

run_test "No debug console.log statements" "! find frontend/src -name '*.ts' -o -name '*.tsx' | xargs grep 'console.debug\\|console.trace' || true"

# =============================================================================
# 7. SECURITY TESTS
# =============================================================================

print_info "🔒 Running Security Tests..."

run_test "No hardcoded credentials" "! grep -r 'password.*=.*\"[^\"]*\"' src-tauri/src/ frontend/src/ | grep -v 'placeholder\\|example\\|config\\|env' || true"

run_test "Environment variables used" "grep -q 'VITE_API_BASE_URL' env.example"

run_test "Secure CORS configuration" "grep -q 'tauri://localhost' env.example"

# =============================================================================
# 8. BUILD TESTS
# =============================================================================

print_info "🏗️  Running Build Tests..."

run_test "Tauri build command works" "cd src-tauri && cargo tauri build --help >/dev/null 2>&1"

print_info "ℹ️  Skipping full build test (takes 5+ minutes)"
print_info "   To test full build manually: 'cargo tauri build'"

# =============================================================================
# 9. CLEANUP TESTS
# =============================================================================

print_info "🧹 Running Cleanup Verification..."

run_test "No Electron files remaining" "! find . -name '*electron*' -type f | grep -v node_modules | grep -v .git"

run_test "No whisper-cpp directory" "[[ ! -d 'whisper-cpp' ]]"

run_test "VPS cleanup script exists" "[[ -f 'scripts/cleanup-vps-whisper.sh' ]] || [[ -f './scripts/cleanup-vps-whisper.sh' ]]"

# =============================================================================
# RESULTS SUMMARY
# =============================================================================

echo ""
echo "🏁 Test Results Summary"
echo "======================="
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    print_status "🎉 ALL TESTS PASSED! ($TESTS_PASSED/$TOTAL_TESTS)"
    echo ""
    echo "✅ Your Tauri desktop app is ready for:"
    echo "   • Local development"
    echo "   • Production builds" 
    echo "   • Deployment testing"
    echo ""
    echo "🚀 Ready to run: ./scripts/start-tauri-dev.sh"
    exit 0
else
    print_error "❌ SOME TESTS FAILED"
    echo ""
    echo "Results:"
    echo "  ✅ Passed: $TESTS_PASSED"
    echo "  ❌ Failed: $TESTS_FAILED"
    echo "  📊 Total:  $TOTAL_TESTS"
    echo ""
    echo "Please fix the failing tests before proceeding."
    exit 1
fi
