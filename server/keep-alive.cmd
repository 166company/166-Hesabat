@echo off
title Ads Audit - SERVER (port 5000)
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

:restart
echo [%time%] Server bashlaniyor...
"C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" ts-node-dev --transpile-only src/index.ts
echo [%time%] Server dayandi! 3 saniye sonra yeniden bashlaniyor...
timeout /t 3 /nobreak > nul
goto restart
