#!/bin/bash

echo "🔄 Rolling back to Electron..."

# Remove Tauri files
rm -rf src-tauri/
rm -rf frontend/src/services/tauri*
rm -rf frontend/src/lib/tauri.ts
rm -f frontend/dist/floating-recorder.html

# Restore original package.json (if backup exists)
if [ -f "package.json.backup" ]; then
    mv package.json.backup package.json
    echo "✅ Restored original package.json"
fi

# Reinstall Electron dependencies
npm install

# Restore original frontend files
if [ -d "frontend.backup" ]; then
    cp -r frontend.backup/* frontend/
    rm -rf frontend.backup
    echo "✅ Restored original frontend files"
fi

echo "✅ Rollback completed. Run 'npm run dev' to start with Electron"
echo "⚠️  Note: You may need to manually restore any Electron-specific configurations"
