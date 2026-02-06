$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\RAM Atama Sistemi.lnk")
$Shortcut.TargetPath = "c:\Users\lenovo ram4\Desktop\ram-proje\start-server.bat"
$Shortcut.WorkingDirectory = "c:\Users\lenovo ram4\Desktop\ram-proje"
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,14"
$Shortcut.Description = "RAM Dosya Atama Sistemini Başlat"
$Shortcut.Save()
Write-Host "Kısayol başarıyla oluşturuldu: $DesktopPath\RAM Atama Sistemi.lnk"
