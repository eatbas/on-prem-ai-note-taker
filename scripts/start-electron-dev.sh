#!/bin/bash

echo "🚀 Starting On-Prem AI Note Taker in development mode..."

echo "📦 Building frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi
cd ..

echo "🎯 Starting Electron app..."
cd electron
npm start
cd ..

echo "✅ Done!"
