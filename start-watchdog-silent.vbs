' RAM Server Watchdog - VBS Launcher
' Bu dosya Windows başlangıcında çalışır ve hiçbir pencere açmadan watchdog'u başlatır

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\lenovo ram4\Desktop\ram-proje"
WshShell.Run "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\lenovo ram4\Desktop\ram-proje\server-watchdog.ps1""", 0, False
Set WshShell = Nothing
