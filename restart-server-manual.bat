@echo off
REM RAM Server Restart Script - Manual Run by Agent
echo Sunucu yeniden baslatiliyor...

REM 2 saniye bekle
timeout /t 2 /nobreak >nul

REM Node.js islemlerini sonlandir
taskkill /F /IM node.exe >nul 2>nul

REM 1 saniye bekle
timeout /t 1 /nobreak >nul

REM Sunucuyu tekrar baslat
cd /d "c:\Users\lenovo ram4\Desktop\ram-proje"
start "" cmd /c "start-server.bat"

exit
