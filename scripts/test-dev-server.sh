#!/bin/bash

echo "==================================================="
echo "🧪 Testing Vite Dev Server Connection"
echo "==================================================="

echo "🔍 Checking if Vite dev server is running on localhost:5173..."

# Try to connect to the dev server
if curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:5173; then
    echo "✅ Vite dev server is accessible!"
    echo "🌐 You can now start Electron and it will load from the dev server"
else
    echo "❌ Vite dev server is not accessible"
    echo "💡 Make sure to run 'npm run dev' in the frontend folder first"
    echo "💡 Or use the updated start-electron-dev.sh script"
fi

echo ""
echo "📋 To start the dev environment:"
echo "1. Run: scripts/start-electron-dev.sh"
echo "2. Or manually: cd frontend && npm run dev (in one terminal)"
echo "3. Then: cd electron && npm start (in another terminal)"
