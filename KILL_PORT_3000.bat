@echo off
echo ============================================
echo PORT 3000 PROCESSI OLDURME ARACI
echo ============================================

:: Yonetici izni kontrolu
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo HATA: Bu dosyayi SAG TIKLAYIP "Yonetici olarak calistir" secmeniz gerekiyor!
    pause
    exit /b 1
)

echo Port 3000 kullanan servisler araniyor...

:: Port 3000 uzerindeki islemi bul ve oldur
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo PID bulundu: %%a
    echo Islem sonlandiriliyor...
    taskkill /f /pid %%a
)

echo.
echo Islem tamamlandi. Simdi normal sunucunuzu baslatabilirsiniz.
pause
