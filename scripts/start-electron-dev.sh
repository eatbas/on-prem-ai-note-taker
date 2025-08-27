#!/bin/bash

echo "🚀 Starting On-Prem AI Note Taker in development mode (Simple Version)..."

echo "📦 Setting up frontend for development..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

cd ..

echo "🚀 Starting Vite dev server..."
cd frontend

# Start Vite dev server in background
echo "Starting Vite dev server on port 5173..."
nohup npm run dev > vite.log 2>&1 &
VITE_PID=$!

cd ..

echo "⏳ Waiting 8 seconds for Vite dev server to start..."
sleep 8

echo "🔍 Checking if Vite dev server is responding..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Vite dev server is ready on port 5173!"
else
    echo "⚠️  Vite dev server may not be ready, but continuing anyway..."
    echo "📋 Checking Vite logs:"
    if [ -f "frontend/vite.log" ]; then
        tail -10 frontend/vite.log
    fi
fi

echo "🎯 Starting Electron app in development mode..."
cd electron

echo "🚀 Starting Electron with live frontend development server!"
echo "💡 The app will now load from http://localhost:5173"
echo "🌐 You can see your frontend changes in real-time in Electron!"
echo "📝 Make changes to frontend code and they'll appear immediately in Electron"

# Start Electron
npx electron .

cd ..

echo "✅ Development session ended"
echo "💡 Remember: The app always connects to VPS for AI services"
echo "🧹 Cleaning up Vite dev server..."
kill $VITE_PID 2>/dev/null || true
echo "🔍 TIP: Check Electron console for '🔥 Loading LIVE development version' to confirm latest code loaded"
