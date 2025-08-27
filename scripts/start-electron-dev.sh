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

# Check if port 5173 is already in use and offer to kill it
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "⚠️  Port 5173 is already in use (possibly another Electron app)"
    echo "🔥 Attempting to free up port 5173..."
    
    # Try to find and kill process using port 5173
    PORT_PID=$(netstat -ano 2>/dev/null | grep ":5173 " | awk '{print $5}' | head -1)
    if [ ! -z "$PORT_PID" ]; then
        echo "🔥 Killing process $PORT_PID using port 5173"
        taskkill /F /PID $PORT_PID 2>/dev/null || kill -9 $PORT_PID 2>/dev/null || echo "Could not kill process"
        sleep 2
    fi
fi

nohup npm run dev > vite.log 2>&1 &
VITE_PID=$!
cd ..

echo "⏳ Waiting for Vite dev server to start..."
sleep 3

echo "🔍 Checking if Vite dev server is ready on port 5173..."
# Wait for the dev server to be ready (max 30 seconds)
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ Vite dev server is ready on port 5173!"
        break
    fi
    echo "⏳ Waiting for dev server... (attempt $((attempt + 1))/$max_attempts)"
    sleep 1
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Dev server failed to start in time on port 5173!"
    echo "🧹 Cleaning up Vite process..."
    kill $VITE_PID 2>/dev/null || true
    exit 1
fi

echo "🎯 Starting Electron app in development mode..."
cd electron

echo "🚀 Starting Electron with live frontend development server!"
echo "💡 The app will now load from http://localhost:5173"
echo "🌐 You can see your frontend changes in real-time in Electron!"
echo "📝 Make changes to frontend code and they'll appear immediately in Electron"

# Check if running as root and add --no-sandbox flag if needed
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Running as root - adding --no-sandbox flag for Electron"
    npx electron . --no-sandbox
else
    npx electron .
fi
cd ..

echo "✅ Development session ended"
echo "💡 Remember: The app always connects to VPS for AI services"
echo "🧹 Cleaning up Vite dev server..."
kill $VITE_PID 2>/dev/null || true
echo "🔍 TIP: Check Electron console for '🔥 Loading LIVE development version' to confirm latest code loaded"
