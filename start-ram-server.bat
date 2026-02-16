@echo off
cd /d "%~dp0"

echo [RAM] Port 3000 kontrol ediliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo [RAM] Port 3000 dolu, temizleniyor - PID: %%a ...
    taskkill /f /pid %%a >nul 2>&1
)

echo [RAM] Baslatiliyor...
echo [RAM] Lutfen pencereyi KAPATMAYIN. Simge durumunda kucultebilirsiniz.

REM Arka planda sunucuyu başlat (Hata durumunda kapanmasın diye cmd /k)
start "RAM Server (KAPATMAYIN)" cmd /k "npm start"

echo [RAM] Tarayici aciliyor...
timeout /t 5 /nobreak >nul
start chrome "http://localhost:3000"

exit
