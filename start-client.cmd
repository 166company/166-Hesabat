@echo off
title Ads Audit - CLIENT (port 5173)
cd /d "%~dp0client"

if exist "C:\Program Files\nodejs\node.exe" (
    set PATH=C:\Program Files\nodejs;%PATH%
)

echo ================================
echo  Ads Audit Frontend Client
echo  Port: 5173
echo  URL:  http://localhost:5173
echo ================================
echo.

"C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" vite --port 5173

echo.
echo [ERROR] Client dayandi!
pause
