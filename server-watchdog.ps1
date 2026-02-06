# RAM Server Watchdog - Otomatik İzleme ve Kurtarma Scripti
# Bu script sunucuyu izler ve takılırsa otomatik yeniden başlatır

$projectPath = "C:\Users\lenovo ram4\Desktop\ram-proje"
$logFile = "$projectPath\server-watchdog.log"
$healthCheckUrl = "http://localhost:3000/api/state"
$checkInterval = 30  # Her 30 saniyede bir kontrol et
$maxFailures = 3     # 3 başarısız denemeden sonra yeniden başlat

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Add-Content -Path $logFile -Encoding UTF8
    Write-Host "$timestamp - $Message"
}

function Test-ServerHealth {
    try {
        $response = Invoke-WebRequest -Uri $healthCheckUrl -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Stop-AllNodeProcesses {
    Write-Log "Tum Node islemleri durduruluyor..."
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 3
}

function Start-Server {
    Write-Log "Sunucu baslatiliyor..."
    Set-Location $projectPath
    
    # Start the server in background
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "cmd.exe"
    $startInfo.Arguments = "/c npm start"
    $startInfo.WorkingDirectory = $projectPath
    $startInfo.CreateNoWindow = $true
    $startInfo.UseShellExecute = $false
    $startInfo.WindowStyle = "Hidden"
    
    $process = [System.Diagnostics.Process]::Start($startInfo)
    Write-Log "Sunucu islemi basladi (PID: $($process.Id))"
    
    # Wait for server to be ready
    Start-Sleep -Seconds 10
    
    # Verify it started
    for ($i = 1; $i -le 5; $i++) {
        if (Test-ServerHealth) {
            Write-Log "Sunucu basariyla basladi ve yanitliyor!"
            return $true
        }
        Start-Sleep -Seconds 3
    }
    
    Write-Log "UYARI: Sunucu basladi ama yanit vermiyor"
    return $false
}

function Restart-Server {
    Write-Log "===== SUNUCU YENIDEN BASLATILIYOR ====="
    Stop-AllNodeProcesses
    Start-Sleep -Seconds 2
    Start-Server
}

# Ana izleme dongusu
Write-Log "=========================================="
Write-Log "RAM Server Watchdog Baslatildi"
Write-Log "Proje Yolu: $projectPath"
Write-Log "Kontrol Araligi: $checkInterval saniye"
Write-Log "=========================================="

$failureCount = 0
$lastRestartTime = $null

# Ilk baslatma - sunucu calismiyorsa baslat
$nodeRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue
if (-not $nodeRunning) {
    Write-Log "Sunucu calismior, baslatiliyor..."
    Start-Server
}

while ($true) {
    Start-Sleep -Seconds $checkInterval
    
    if (Test-ServerHealth) {
        if ($failureCount -gt 0) {
            Write-Log "Sunucu tekrar yanitliyor. Hata sayaci sifirlandi."
        }
        $failureCount = 0
    } else {
        $failureCount++
        Write-Log "UYARI: Sunucu yanit vermiyor! (Hata: $failureCount/$maxFailures)"
        
        if ($failureCount -ge $maxFailures) {
            # Check if we restarted recently (within 2 minutes)
            if ($lastRestartTime -and ((Get-Date) - $lastRestartTime).TotalMinutes -lt 2) {
                Write-Log "Son 2 dakika icinde zaten yeniden baslatildi, bekleniyor..."
                continue
            }
            
            Write-Log "Maksimum hata sayisina ulasildi. Sunucu yeniden baslatiliyor..."
            Restart-Server
            $failureCount = 0
            $lastRestartTime = Get-Date
        }
    }
}
