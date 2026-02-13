@echo off
echo ========================================
echo   RAM Auto Deploy - Webhook Listener
echo ========================================
echo.
cd /d "%~dp0"
echo Calisan dizin: %CD%
echo Webhook listener baslatiliyor...
echo Port: 9000
echo.
node webhook-listener.js
pause
