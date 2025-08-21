@echo off
echo 🚀 Starting AI Note Taker App...
echo.

REM Check if we're in the right directory
if not exist "frontend" (
    echo ❌ Error: frontend folder not found!
    echo Please run this script from the project root folder.
    pause
    exit /b 1
)

REM Navigate to frontend folder
cd frontend

REM Check if .env.local exists
if not exist ".env.local" (
    echo ⚠️  Warning: .env.local file not found!
    echo Please create it with your VPS credentials first.
    echo.
    echo Example content:
    echo VITE_API_BASE_URL=http://95.111.244.159:8000/api
    echo VITE_BASIC_AUTH_USERNAME=your_username
    echo VITE_BASIC_AUTH_PASSWORD=your_password
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies (first time only)...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies!
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully!
    echo.
)

echo 🎯 Starting development server...
echo 🌐 Your app will be available at: http://localhost:5173
echo.
echo 💡 Press Ctrl+C to stop the server
echo.

REM Start the development server
npm run dev

pause
