#!/bin/bash

# Mac App Installation Script for On-Prem AI Note Taker
# This script helps install and run the desktop application

set -e

echo "🍎 On-Prem AI Note Taker - Mac Installation"
echo "============================================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is for macOS only!"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "Please install Python 3.8+ from https://python.org"
    echo "Or run: brew install python"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if the DMG exists
DMG_PATH="electron/dist-electron/OnPremNoteTaker-1.0.0.dmg"
if [ ! -f "$DMG_PATH" ]; then
    echo "❌ DMG file not found at $DMG_PATH"
    echo "Please build the app first: ./scripts/build-desktop-app.sh"
    exit 1
fi

echo "✅ DMG file found: $DMG_PATH"

# Check if app is already installed
APP_NAME="On-Prem AI Note Taker"
APP_PATH="/Applications/$APP_NAME.app"

if [ -d "$APP_PATH" ]; then
    echo "📱 App already installed at $APP_PATH"
    echo ""
    echo "To run the app:"
    echo "1. Open Applications folder"
    echo "2. Double-click '$APP_NAME'"
    echo "3. Or use Spotlight: Cmd + Space, type '$APP_NAME'"
    echo ""
    echo "To reinstall, first remove the existing app:"
    echo "rm -rf '$APP_PATH'"
    echo ""
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Keeping existing installation"
        exit 0
    fi
    echo "🗑️  Removing existing app..."
    rm -rf "$APP_PATH"
fi

echo ""
echo "🚀 Installing $APP_NAME..."

# Mount the DMG
echo "📂 Mounting DMG..."
MOUNT_POINT=$(hdiutil attach "$DMG_PATH" | grep "/Volumes" | cut -f 3)

if [ -z "$MOUNT_POINT" ]; then
    echo "❌ Failed to mount DMG"
    exit 1
fi

echo "✅ DMG mounted at: $MOUNT_POINT"

# Copy the app to Applications
echo "📱 Copying app to Applications..."
cp -R "$MOUNT_POINT/$APP_NAME.app" "/Applications/"

# Unmount the DMG
echo "📂 Unmounting DMG..."
hdiutil detach "$MOUNT_POINT"

echo ""
echo "✅ Installation complete!"
echo ""
echo "🎉 $APP_NAME is now installed!"
echo ""
echo "To run the app:"
echo "1. Open Applications folder"
echo "2. Double-click '$APP_NAME'"
echo "3. Or use Spotlight: Cmd + Space, type '$APP_NAME'"
echo ""
echo "Note: On first run, macOS may show a security warning."
echo "To allow the app:"
echo "1. Go to System Preferences → Security & Privacy"
echo "2. Click 'Open Anyway'"
echo "3. Or right-click the app → Open"
echo ""
echo "The app will automatically:"
echo "- Install Python dependencies on first run"
echo "- Connect to your VPS for AI services"
echo "- Store all your data locally"
echo ""
echo "Happy note-taking! 📝✨"
