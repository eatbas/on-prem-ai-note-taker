#!/bin/bash

echo "🧹 Clearing Electron browser cache and temporary files..."

# Clear Electron cache directories (common locations)
if [ -d "$HOME/.config/dgMeets" ]; then
    echo "🗑️ Clearing app config cache..."
    rm -rf "$HOME/.config/dgMeets"
fi

if [ -d "$HOME/.config/Electron" ]; then
    echo "🗑️ Clearing Electron cache..."
    rm -rf "$HOME/.config/Electron"
fi

# Clear any old built files
if [ -d "electron/dist" ]; then
    echo "🗑️ Removing old built files..."
    rm -rf electron/dist
fi

# Clear node_modules/.vite if exists (Vite cache)
if [ -d "frontend/node_modules/.vite" ]; then
    echo "🗑️ Clearing Vite cache..."
    rm -rf frontend/node_modules/.vite
fi

# Clear npm cache if needed
echo "🧹 Clearing npm cache..."
cd frontend
npm cache clean --force 2>/dev/null || true
cd ..

echo "✅ Cache cleared! Now restart with: ./scripts/start-electron-dev.sh"
echo "💡 This should fix any issues with outdated cached content"
