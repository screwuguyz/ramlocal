Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run chr(34) & "C:\Users\lenovo ram4\Desktop\ram-proje\run-silent.bat" & chr(34), 0

' Sunucunun acilmasi icin 10 saniye bekle
WScript.Sleep 10000

' Tarayiciyi ac
WshShell.Run "chrome http://localhost:3000"

Set WshShell = Nothing
