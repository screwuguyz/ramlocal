@echo off
echo ========================================
echo   RAM Auto Deploy - Git Polling
echo ========================================
echo.
cd /d "%~dp0"
echo Calisan dizin: %CD%
echo Her 1 dakikada GitHub kontrol edilecek...
echo.
node git-polling.js
pause
