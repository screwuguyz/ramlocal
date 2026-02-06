# RAM Proje - Otomatik Yedekleme Script
# Windows Task Scheduler ile her gün 16:00'da çalıştırılır

$ErrorActionPreference = "Stop"

# API endpoint
$backupUrl = "http://localhost:3000/api/cron/backup"

Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Otomatik yedekleme başlıyor..."

try {
    # Önce sunucunun çalışıp çalışmadığını kontrol et
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET -TimeoutSec 5
    Write-Host "Sunucu durumu: OK"
    
    # Yedekleme API'sini çağır
    $response = Invoke-RestMethod -Uri $backupUrl -Method GET -TimeoutSec 30
    
    if ($response.success) {
        Write-Host "✅ Yedekleme başarılı: $($response.message)"
        Write-Host "Silinen eski yedek sayısı: $($response.deletedOldBackups)"
    }
    else {
        Write-Host "❌ Yedekleme başarısız: $($response.error)"
        exit 1
    }
}
catch {
    Write-Host "❌ Hata oluştu: $($_.Exception.Message)"
    
    # Eğer sunucu çalışmıyorsa bilgi ver
    if ($_.Exception.Message -like "*Unable to connect*" -or $_.Exception.Message -like "*bağlantı*") {
        Write-Host "⚠️ Sunucu çalışmıyor olabilir. Lütfen uygulamanın açık olduğundan emin olun."
    }
    exit 1
}

Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - İşlem tamamlandı."
