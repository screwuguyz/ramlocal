Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run chr(34) & "C:\Users\lenovo ram4\Desktop\ram-proje\start-server.bat" & chr(34), 0

' Sunucunun acilmasi icin 10 saniye bekle
WScript.Sleep 10000

' Tarayiciyi ac
WshShell.Run "http://localhost:3000"

' Durum isigini ac
WshShell.Run chr(34) & "C:\Users\lenovo ram4\Desktop\ram-proje\server-durum-isigi.hta" & chr(34), 1

Set WshShell = Nothing
