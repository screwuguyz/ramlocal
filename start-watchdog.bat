@echo off
:: RAM Server - Sessiz Watchdog Başlatıcı
:: Bu dosya Windows başlangıcında çalışır ve sunucuyu sessizce izler

cd /d "C:\Users\lenovo ram4\Desktop\ram-proje"

:: PowerShell ile watchdog'u gizli pencerede başlat
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\lenovo ram4\Desktop\ram-proje\server-watchdog.ps1"
