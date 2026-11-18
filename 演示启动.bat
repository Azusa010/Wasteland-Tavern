@echo off
cd /d "%~dp0"
title Wasteland Tavern - Demo Launcher

echo ============================================
echo   Wasteland Tavern - Local Demo (Production)
echo   URL: http://localhost:7860
echo ============================================
echo.
echo [1/2] Building latest frontend...
call npm run build
if errorlevel 1 (
    echo [WARN] Build failed. Continuing with existing dist folder.
)

echo.
echo [2/2] Starting production server on port 7860 ...
set NODE_ENV=production
set PORT=7860

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:7860"

npx tsx server.ts

echo.
echo Server stopped. If there is an error above, take a screenshot.
pause
