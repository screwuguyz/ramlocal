@echo off
REM RAM Server Restart Script - Otomatik olusturuldu
echo Sunucu yeniden baslatiliyor...

REM 2 saniye bekle (mevcut istegin tamamlanmasi icin)
timeout /t 2 /nobreak >nul

REM Node.js islemlerini sonlandir
taskkill /F /IM node.exe >nul 2>nul

REM 1 saniye bekle
timeout /t 1 /nobreak >nul

REM Sunucuyu tekrar baslat
cd /d "C:\\Users\\lenovo ram4\\Desktop\\ram-proje"
start "" cmd /c "start-server.bat"

exit
