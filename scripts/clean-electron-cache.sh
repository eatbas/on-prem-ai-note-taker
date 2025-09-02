#!/bin/bash

echo "🧹 Cleaning Electron development cache..."

# Remove old built files that might interfere
if [ -d "electron/dist" ]; then
    echo "🗑️ Removing old electron/dist files..."
    rm -rf electron/dist
fi

# Clear Vite cache
if [ -d "frontend/node_modules/.vite" ]; then
    echo "🗑️ Clearing Vite cache..."
    rm -rf frontend/node_modules/.vite
fi

# Clear any running Vite processes
echo "🔍 Checking for running Vite processes..."
if pgrep -f "vite.*5173" > /dev/null; then
    echo "⚠️ Killing existing Vite processes..."
    pkill -f "vite.*5173" || true
fi

# Clear frontend dist if it exists
if [ -d "frontend/dist" ]; then
    echo "🗑️ Removing frontend/dist..."
    rm -rf frontend/dist
fi

echo "✅ Electron cache cleaned!"
echo "💡 Now run: bash scripts/start-electron-dev.sh"
