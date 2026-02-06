@echo off
title RAM Server Durum Kontrol
cls
echo ============================================
echo RAM Server Durum Kontrolu
echo ============================================
echo.

REM 1. Node.js Sureci Kontrolu
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Node.js motoru calisiyor.
) else (
    echo [HATA] Node.js calismiyor!
    goto :ServerKapali
)

REM 2. Port 3000 Kontrolu
netstat -an | find "3000" | find "LISTENING" >nul
if "%ERRORLEVEL%"=="0" (
    echo [OK] Port 3000 dinleniyor (Web sunucusu aktif).
) else (
    echo [HATA] Port 3000 aktif degil (Sunucu baslatiliyor olabilir veya hata verdi).
    goto :ServerKapali
)

echo.
echo ============================================
echo SONUC: SERVER SORUNSUZ CALISIYOR!
echo ============================================
echo.
echo Tarayicidan su adrese gidebilirsiniz:
echo http://localhost:3000
echo.

msg * "RAM Server Calisiyor! Web sayfasina girebilirsiniz."
pause
exit

:ServerKapali
echo.
echo ============================================
echo SONUC: SERVER KAPALI GORUNUYOR!
echo ============================================
echo.
echo Lutfen 'start-server.bat' dosyasini calistirarak tekrar deneyin.
echo.
msg * "DIKKAT: RAM Server Kapali veya Yanit Vermiyor!"
pause
