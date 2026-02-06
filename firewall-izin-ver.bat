@echo off
echo ============================================
echo Port 3000 Firewall Izni Ayarlaniyor...
echo ============================================
echo.
netsh advfirewall firewall add rule name="RAM Proje - Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
echo.
if %ERRORLEVEL% EQU 0 (
    echo BASARILI! Port 3000 izni verildi.
    echo Artik diger bilgisayarlardan baglanabilirsiniz.
) else (
    echo HATA! Lutfen bu dosyaya Sag Tiklayip "Yonetici Olarak Calistir" deyin.
)
echo.
pause
