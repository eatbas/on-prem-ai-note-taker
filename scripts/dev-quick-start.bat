@echo off
echo 🚀 Quick Start: On-Prem AI Note Taker Development
echo ================================================
echo.
echo This script will start the app in development mode.
echo The app will ALWAYS connect to VPS for AI services.
echo.
echo VPS Backend: http://95.111.244.159:8000/api
echo Username: myca
echo.
echo Press any key to start development...
pause >nul

call scripts\start-electron-dev.bat
