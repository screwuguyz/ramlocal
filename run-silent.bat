@echo off
cd /d "%~dp0"

echo [RAM] Port 3000 kontrol ediliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [RAM] Baslatiliyor...
npm start
