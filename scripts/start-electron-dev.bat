@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo 🚀 Starting On-Prem AI Note Taker in Development Mode
echo ===================================================

REM Get VPS IP from .env file or use default
set "VPS_IP=95.111.244.159"
if exist ".env" (
    for /f "tokens=2 delims==" %%a in ('findstr /B "VPS_HOST=" .env') do (
        set "VPS_IP=%%a"
    )
)
echo ✅ Using VPS Host: %VPS_IP%

REM Set environment variables for development
set "VITE_API_BASE_URL=http://%VPS_IP%:8000/api"
set "VITE_BASIC_AUTH_USERNAME=myca"
set "VITE_BASIC_AUTH_PASSWORD=wj2YyxrJ4cqcXgCA"
set "VITE_DEBUG=true"

echo 🔗 Development mode will connect to VPS at: %VITE_API_BASE_URL%
echo 📝 Note: App will use VPS backend for AI services (transcription, chat, etc.)

echo.
echo 📦 Setting up frontend for development...
cd frontend

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

cd ..

echo.
echo 🚀 Starting Vite dev server in background...
cd frontend
start "Vite Dev Server" cmd /c "npm run dev"
cd ..

echo ⏳ Waiting for Vite dev server to start...
timeout /t 5 /nobreak >nul

echo.
echo 🎯 Starting Electron app in development mode...
cd electron

REM Set Electron environment variables
set "API_BASE_URL=http://%VPS_IP%:8000/api"
set "BASIC_AUTH_USERNAME=myca"
set "BASIC_AUTH_PASSWORD=wj2YyxrJ4cqcXgCA"

echo 🚀 Starting Electron with VPS connection...
echo 💡 The app will now load from the live Vite dev server!
call npm start
cd ..

echo.
echo ✅ Development session ended
echo 💡 Remember: The app always connects to VPS for AI services
echo 🧹 Don't forget to close the Vite dev server window if it's still running
pause
