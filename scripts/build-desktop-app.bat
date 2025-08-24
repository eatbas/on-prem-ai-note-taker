@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo 🚀 Building On-Prem AI Note Taker Desktop App
echo ===================================================

REM Check if we're in the right directory
if not exist "electron\package.json" (
    echo ❌ Please run this script from the project root directory
    exit /b 1
)

REM Get VPS IP from .env file
set "VPS_IP=95.111.244.159"
if exist ".env" (
    for /f "tokens=2 delims==" %%a in ('findstr /B "VPS_HOST=" .env') do (
        set "VPS_IP=%%a"
    )
)
echo ✅ Using VPS Host: %VPS_IP%

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% found

echo.
echo 📋 Architecture: Desktop App (Frontend Only) + VPS Backend
echo 💡 The desktop app will connect to your VPS for AI services
echo 🌐 No local Python backend needed

REM Step 1: Build Frontend
echo.
echo 📦 Step 1: Building Frontend...
cd frontend

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

REM Create production build
echo Creating production build...
call npm run build

cd ..
echo ✅ Frontend built successfully

REM Step 2: Prepare Electron
echo.
echo 📦 Step 2: Preparing Electron App...
cd electron

REM Install Electron dependencies
if not exist "node_modules" (
    echo Installing Electron dependencies...
    call npm install
)

REM Copy frontend build to electron directory
echo Copying frontend build...
if exist "dist" rd /s /q "dist"
xcopy /E /I /Y "..\frontend\dist" "dist"

echo ✅ Electron prepared successfully

REM Step 3: Build executables
echo.
echo 📦 Step 3: Building Desktop Application...
echo Choose your platform:
echo 1. Windows (.exe)
echo 2. macOS (.dmg) - Not available on Windows
echo 3. Linux (.AppImage) - Not available on Windows
echo 4. Windows only (recommended)

set /p platform_choice="Enter your choice (1-4): "

if "%platform_choice%"=="1" goto build_windows
if "%platform_choice%"=="4" goto build_windows
goto invalid_choice

:build_windows
echo Building for Windows...
call npm run build:win
goto build_complete

:invalid_choice
echo ❌ Invalid choice or platform not available on Windows
exit /b 1

:build_complete
cd ..

echo.
echo 🎉 Build completed successfully!
echo ===================================================
echo 📁 Output location: electron\dist-electron\
echo.
echo 📋 What's included:
echo - ✅ React frontend (built for production)
echo - ✅ Electron wrapper (native desktop app)
echo - ✅ Automatic VPS connection for AI services
echo - ❌ NO Python backend (connects to VPS instead)
echo.
echo 🚀 Next steps:
echo 1. Find your installer in electron\dist-electron\
echo 2. Install the application
echo 3. Launch and start recording!
echo.
echo 📱 The app will:
echo - Store all data locally in %%USERPROFILE%%\.on-prem-ai-notes\
echo - Connect to VPS at %VPS_IP% for AI processing
echo - Work offline for viewing existing notes
echo - Auto-detect your username for authentication
echo.
echo 🌐 VPS Services Required:
echo - Backend API running on port 8000
echo - Ollama running on port 11434
echo - Database and file storage
echo.
echo 💡 This creates a lightweight desktop app that uses your VPS for AI processing!

pause
