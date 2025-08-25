@echo off
echo Setting up frontend environment for VPS connection...
echo.

cd frontend

if exist .env.local (
    echo .env.local already exists. Backing up to .env.local.backup
    copy .env.local .env.local.backup
)

echo Creating .env.local file...
(
echo # Frontend Environment Configuration - CLIENT SIDE ^(Your Laptop^)
echo # This file configures your frontend to connect to your VPS backend
echo.
echo # =============================================================================
echo # VPS CONNECTION CONFIGURATION ^(REQUIRED^)
echo # =============================================================================
echo.
echo # Your frontend connects to the VPS backend at this URL
echo VITE_API_BASE_URL=http://95.111.244.159:8000/api
echo.
echo # =============================================================================
echo # AUTHENTICATION ^(REQUIRED - Must match VPS backend^)
echo # =============================================================================
echo.
echo VITE_BASIC_AUTH_USERNAME=myca
echo VITE_BASIC_AUTH_PASSWORD=wj2YyxrJ4cqcXgCA
echo.
echo # =============================================================================
echo # DEVELOPMENT ^& DEPLOYMENT
echo # =============================================================================
echo.
echo VITE_DEV_MODE=true
echo VITE_LOG_LEVEL=info
echo.
echo # =============================================================================
echo # FEATURE FLAGS
echo # =============================================================================
echo.
echo VITE_ENABLE_PROGRESS_TRACKING=true
echo VITE_ENABLE_SSE=true
echo VITE_ENABLE_JOB_MANAGEMENT=true
echo VITE_ENABLE_SPEAKER_IDENTIFICATION=true
echo VITE_ENABLE_TURKISH_SUPPORT=true
echo.
echo # =============================================================================
echo # UI CONFIGURATION
echo # =============================================================================
echo.
echo VITE_DEFAULT_LANGUAGE=auto
echo VITE_SHOW_LANGUAGE_SELECTOR=true
echo VITE_SHOW_PROGRESS_BARS=true
echo VITE_SHOW_ETA=true
echo.
echo # =============================================================================
echo # PERFORMANCE
echo # =============================================================================
echo.
echo VITE_PROGRESS_UPDATE_INTERVAL=500
echo VITE_SSE_TIMEOUT=30000
echo VITE_MAX_FILE_SIZE_MB=200
echo.
echo # =============================================================================
echo # DEBUGGING
echo # =============================================================================
echo.
echo VITE_DEBUG_MODE=true
echo VITE_SHOW_DEBUG_INFO=true
echo VITE_LOG_API_CALLS=true
) > .env.local

echo.
echo .env.local file created successfully!
echo.
echo IMPORTANT: Please verify the following settings:
echo 1. VPS IP address: 95.111.244.159
echo 2. Username: myca
echo 3. Password: wj2YyxrJ4cqcXgCA
echo.
echo If any of these are incorrect, please edit .env.local manually.
echo.
echo After making changes, restart your frontend development server.
echo.
pause
