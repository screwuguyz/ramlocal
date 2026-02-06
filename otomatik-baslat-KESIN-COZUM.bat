@echo off
echo ============================================
echo RAM Server - KESIN COZUM (Yonetici Olarak Calisin!)
echo ============================================
echo.

REM Yonetici kontrolu
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo HATA: Bu dosyayi SAG TIKLAYIP "Yonetici olarak calistir" secmeniz gerekiyor!
    echo.
    pause
    exit /b 1
)

echo [1/4] Eski gorev siliniyor...
schtasks /delete /tn "RAMServerBaslat" /f >nul 2>&1

echo [2/4] Yeni gorev XML'den yukleniyor...
schtasks /create /tn "RAMServerBaslat" /xml "%~dp0ram-server-task.xml" /f
if %errorLevel% neq 0 (
    echo HATA: Gorev olusturulamadi!
    pause
    exit /b 1
)

echo [3/4] Uyku modu kapatiliyor...
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0

echo [4/4] Test ediliyor - Server simdi baslatiliyor...
schtasks /run /tn "RAMServerBaslat"

echo.
echo ============================================
echo BASARILI!
echo ============================================
echo.
echo Artik bilgisayar her acildiginda server otomatik baslayacak.
echo Pil modunda bile calisacak sekilde ayarlandi.
echo Uyku modu kapatildi.
echo.
echo Simdi 10 saniye bekleyin, tarayici otomatik acilacak.
echo.
pause
