#!/bin/bash

echo "🚀 Starting On-Prem AI Note Taker in development mode..."

echo "📦 Setting up frontend for development..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

cd ..

echo "🚀 Starting Vite dev server in background..."
cd frontend
nohup npm run dev > vite.log 2>&1 &
VITE_PID=$!
cd ..

echo "⏳ Waiting for Vite dev server to start..."
sleep 5

echo "🎯 Starting Electron app in development mode..."
cd electron

echo "🚀 Starting Electron with VPS connection..."
echo "💡 The app will now load from the live Vite dev server!"
npm start
cd ..

echo "✅ Development session ended"
echo "💡 Remember: The app always connects to VPS for AI services"
echo "🧹 Don't forget to stop the Vite dev server: kill $VITE_PID"
