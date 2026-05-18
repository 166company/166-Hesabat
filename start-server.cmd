@echo off
title Ads Audit - SERVER (port 5000)
cd /d "%~dp0server"

:: Node.js-i tap
if exist "C:\Program Files\nodejs\node.exe" (
    set PATH=C:\Program Files\nodejs;%PATH%
)

echo ================================
echo  Ads Audit Backend Server
echo  Port: 5000
echo ================================
echo.

"C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" ts-node-dev --transpile-only src/index.ts

echo.
echo [ERROR] Server dayandi! Xetani yoxlayin.
pause
