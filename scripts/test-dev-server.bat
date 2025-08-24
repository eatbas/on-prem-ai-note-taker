@echo off
echo ===================================================
echo 🧪 Testing Vite Dev Server Connection
echo ===================================================

echo 🔍 Checking if Vite dev server is running on localhost:5173...

REM Try to connect to the dev server
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost:5173

if %errorlevel% equ 0 (
    echo ✅ Vite dev server is accessible!
    echo 🌐 You can now start Electron and it will load from the dev server
) else (
    echo ❌ Vite dev server is not accessible
    echo 💡 Make sure to run 'npm run dev' in the frontend folder first
    echo 💡 Or use the updated start-electron-dev.bat script
)

echo.
echo 📋 To start the dev environment:
echo 1. Run: scripts\start-electron-dev.bat
echo 2. Or manually: cd frontend && npm run dev (in one terminal)
echo 3. Then: cd electron && npm start (in another terminal)
pause
