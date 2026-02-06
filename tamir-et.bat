@echo off
echo ============================================
echo RAM Proje - Tamir Araci
echo ============================================
echo.
echo Bu islem bozuk dosyalari silip bastan yukleyecektir.
echo Lutfen biraz bekleyin...
echo.

REM Kill node processes just in case
taskkill /F /IM node.exe >nul 2>nul

echo Eski dosyalar temizleniyor...
rmdir /s /q node_modules
del package-lock.json
rmdir /s /q .next

echo.
echo Gerekli dosyalar yukleniyor (Bu islem internet hizina gore zaman alabilir)...
echo.
call npm install
echo.

if %ERRORLEVEL% EQU 0 (
    echo BASARILI! Kurulum tamamlandi.
    echo.
    echo Simdi masaustundeki 'RAM Atama Sistemi' kisayolunu kullanabilirsiniz.
) else (
    echo HATA! Kurulum sirasinda sorun olustu.
)
echo.
pause
