@echo off
echo 🚀 Building dgMeets Tauri Application for Windows

cd /d "%~dp0.."

echo ✅ Building frontend...
cd frontend
if not exist node_modules (
    echo ⚠️  Installing frontend dependencies...
    call npm install
)
call npm run build
cd ..

echo ✅ Building Tauri application...
call npm run tauri:build:windows

echo ✅ Build completed successfully!
echo 📁 Check the 'src-tauri\target\release\bundle\' directory for installers
pause
