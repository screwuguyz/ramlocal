@echo off
echo ============================================
echo Otomatik Baslatma Ayarlaniyor...
echo ============================================
echo.

set "SOURCE=%~dp0gizli-baslat.vbs"
set "DEST=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ram-proje-gizli.vbs"

copy "%SOURCE%" "%DEST%" /Y

if %ERRORLEVEL% EQU 0 (
    echo.
    echo BASARILI! 
    echo Artik bilgisayar acildiginda sunucu otomatik ve GIZLI olarak baslayacak.
    echo Ekranda siyah pencere cikmayacak.
) else (
    echo.
    echo HATA! Dosya kopyalanamadi.
)
echo.
pause
