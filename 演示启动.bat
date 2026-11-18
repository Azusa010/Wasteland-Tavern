@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Wasteland Tavern - Demo Launcher

echo ============================================
echo   废土酒馆 · 本地演示启动器(生产模式)
echo ============================================
echo.
echo [1/2] 正在构建最新前端(约 1 分钟)...
call npm run build
if errorlevel 1 (
    echo [警告] 构建失败,将使用已有的 dist 目录继续启动。
)

echo.
echo [2/2] 启动生产服务: http://localhost:7860
set NODE_ENV=production
set PORT=7860

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:7860"

npx tsx server.ts

echo.
echo 服务已停止。如果上方有报错信息,请截图发我。
pause
