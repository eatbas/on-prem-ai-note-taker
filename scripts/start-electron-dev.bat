@echo off
echo 🚀 Starting On-Prem AI Note Taker in development mode...

echo 📦 Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
)
cd ..

echo 🎯 Starting Electron app...
cd electron
call npm start
cd ..

echo ✅ Done!
pause
