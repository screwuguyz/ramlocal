@echo off
chcp 65001 >nul
echo ========================================
echo RAM Proje - Otomatik Yedekleme Kurulumu
echo ========================================
echo.

:: Script dizinini ve PowerShell dosya yolunu al
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%auto-backup.ps1"

:: Once varsa eski gorevi sil
echo [1/3] Varsa eski gorev siliniyor...
schtasks /delete /tn "RAM Proje Otomatik Yedekleme" /f >nul 2>&1
echo     Tamamlandi.

echo.
echo [2/3] Yeni gorev ekleniyor...
schtasks /create /tn "RAM Proje Otomatik Yedekleme" /tr "powershell.exe -ExecutionPolicy Bypass -File \"%PS_SCRIPT%\"" /sc daily /st 16:00 /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo BASARILI! Otomatik yedekleme her gun saat 16:00 da calisacak.
    echo.
    echo [3/3] Gorev bilgileri:
    schtasks /query /tn "RAM Proje Otomatik Yedekleme" /fo list | findstr /i "TaskName Status"
) else (
    echo.
    echo HATA! Yonetici olarak calistirmayi deneyin.
)

echo.
echo ========================================
echo NOT: Yedeklemenin calismasi icin uygulama
echo localhost:3000 acik olmalidir!
echo ========================================
echo.
pause
