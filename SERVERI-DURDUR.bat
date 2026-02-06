@echo off
taskkill /F /IM node.exe >nul 2>nul
echo RAM Server kapatildi.
ping 127.0.0.1 -n 2 >nul
