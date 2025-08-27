#!/bin/bash

echo "🔥 Killing all existing Node.js/Vite processes..."

# Kill all node processes (be careful - this kills ALL node processes)
pkill -f "node" 2>/dev/null || echo "No node processes to kill"
pkill -f "vite" 2>/dev/null || echo "No vite processes to kill"
pkill -f "electron" 2>/dev/null || echo "No electron processes to kill"

# Wait a moment for processes to terminate
sleep 2

echo "🧹 Clearing caches..."
# Clear Vite cache
if [ -d "frontend/node_modules/.vite" ]; then
    rm -rf frontend/node_modules/.vite
fi

# Clear any old built files
if [ -d "electron/dist" ]; then
    rm -rf electron/dist
fi

echo "📦 Setting up frontend..."
cd frontend

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "🚀 Starting Vite dev server on port 5173..."

# Kill any process using port 5173 (Windows/Git Bash compatible)
PORT_PID=$(netstat -ano 2>/dev/null | grep ":5173 " | awk '{print $5}' | head -1)
if [ ! -z "$PORT_PID" ]; then
    echo "🔥 Killing process $PORT_PID using port 5173"
    taskkill /F /PID $PORT_PID 2>/dev/null || kill -9 $PORT_PID 2>/dev/null || echo "Process already terminated"
    sleep 1
fi

# Start Vite in background with forced port
nohup npm run dev -- --port 5173 --host > ../vite.log 2>&1 &
VITE_PID=$!
echo "📝 Vite PID: $VITE_PID (logged to vite.log)"

cd ..

echo "⏳ Waiting for Vite dev server to start..."
max_attempts=15
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
    echo "❌ Dev server failed to start!"
    echo "📋 Vite log:"
    cat vite.log
    kill $VITE_PID 2>/dev/null
    exit 1
fi

echo "🎯 Starting Electron with clean dev server..."
cd electron

echo "🔥 Loading fresh development version from http://localhost:5173"
echo "💡 All your latest changes should now be visible!"

# Start Electron
if [ "$EUID" -eq 0 ]; then
    npx electron . --no-sandbox
else
    npx electron .
fi

cd ..

echo "🧹 Cleaning up..."
kill $VITE_PID 2>/dev/null || true
echo "✅ Session ended"
