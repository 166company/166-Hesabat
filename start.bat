@echo off
title Ads Audit Launcher
set NODEPATH=C:\Program Files\nodejs
set PATH=%PATH%;%NODEPATH%

echo ============================================
echo   Ads Audit - Bashlanir...
echo ============================================

echo [1/2] SERVER bashlanir (port 5000)...
start "Ads Audit - SERVER" "%~dp0server\keep-alive.cmd"
timeout /t 5 /nobreak > nul

echo [2/2] CLIENT bashlanir (port 5173)...
start "Ads Audit - CLIENT" "%~dp0start-client.cmd"
timeout /t 8 /nobreak > nul

echo.
echo Brauzer achilir: http://localhost:5173
start "" "http://localhost:5173"
