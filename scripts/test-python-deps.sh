#!/bin/bash

# Test Python Dependencies Installation
# This script helps diagnose Python dependency installation issues

echo "🐍 Testing Python Dependencies Installation"
echo "=========================================="

# Check Python version
echo "📋 Python Version:"
python3 --version

# Check pip version
echo -e "\n📦 Pip Version:"
python3 -m pip --version

# Check if we can install packages
echo -e "\n🧪 Testing package installation..."

# Try to install a simple package
echo "📥 Installing test package..."
if python3 -m pip install --user requests; then
    echo "✅ Successfully installed 'requests' package"
    
    # Test import
    if python3 -c "import requests; print('✅ Successfully imported requests')"; then
        echo "✅ Package import test passed"
    else
        echo "❌ Package import test failed"
    fi
    
    # Clean up test package
    echo "🧹 Cleaning up test package..."
    python3 -m pip uninstall -y requests
    echo "✅ Test package removed"
else
    echo "❌ Failed to install test package"
    echo "This indicates a fundamental issue with pip or permissions"
fi

# Check if we can install our required packages
echo -e "\n📋 Testing our required packages..."
REQUIRED_PACKAGES=("fastapi" "uvicorn" "sqlalchemy" "aiosqlite" "python-multipart")

for package in "${REQUIRED_PACKAGES[@]}"; do
    echo "🔍 Checking $package..."
    if python3 -c "import $package" 2>/dev/null; then
        echo "✅ $package is already installed"
    else
        echo "❌ $package is not installed"
    fi
done

echo -e "\n💡 If you see errors above, try:"
echo "1. Check your internet connection"
echo "2. Ensure Python 3.8+ is installed"
echo "3. Try: python3 -m pip install --upgrade pip"
echo "4. Try: python3 -m pip install --user fastapi uvicorn sqlalchemy aiosqlite python-multipart"

echo -e "\n🎯 Ready to test the desktop app!"
