#!/bin/bash

echo "🚀 Starting AI Note Taker App..."
echo

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend folder not found!"
    echo "Please run this script from the project root folder."
    exit 1
fi

# Navigate to frontend folder
cd frontend

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local file not found!"
    echo "Please create it with your VPS credentials first."
    echo
    echo "Example content:"
    echo "VITE_API_BASE_URL=http://95.111.244.159:8000/api"
    echo "VITE_BASIC_AUTH_USERNAME=your_username"
    echo "VITE_BASIC_AUTH_PASSWORD=your_password"
    echo
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first time only)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies!"
        exit 1
    fi
    echo "✅ Dependencies installed successfully!"
    echo
fi

echo "🎯 Starting development server..."
echo "🌐 Your app will be available at: http://localhost:5173"
echo
echo "💡 Press Ctrl+C to stop the server"
echo

# Start the development server
npm run dev
