import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

// Sunucuyu yeniden başlatma API'si
// Bu endpoint çağrıldığında sunucu kapanır ve start-server.bat tarafından tekrar açılır

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.action !== "restart") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // LOCAL_MODE kontrolü - sadece local modda çalışsın
        const isLocalMode = process.env.LOCAL_MODE === "true";
        if (!isLocalMode) {
            return NextResponse.json({ error: "Only available in local mode" }, { status: 403 });
        }

        // Yeniden başlatma işlemini başlat
        const projectPath = process.cwd();
        const restartScript = path.join(projectPath, "restart-server.bat");

        // Restart script'i oluştur
        const restartBatContent = `REM RAM Server Restart Script - Otomatik olusturuldu
echo Sunucu yeniden baslatiliyor...

REM 2 saniye bekle (mevcut istegin tamamlanmasi icin)
timeout /t 2 /nobreak >nul

REM Node.js islemlerini sonlandir
taskkill /F /IM node.exe >nul 2>nul

REM Eski sunucu penceresini kapat (Basliktan bul)
taskkill /FI "WINDOWTITLE eq RAM Server (KAPATMAYIN)" /F >nul 2>nul

REM 1 saniye bekle
timeout /t 1 /nobreak >nul

REM Sunucuyu tekrar baslat
cd /d "${projectPath.replace(/\\/g, "\\\\")}"
start "" cmd /c "start-ram-server.bat"

exit
`;

        fs.writeFileSync(restartScript, restartBatContent);

        // Restart script'i çalıştır
        exec(`start "" /min cmd /c "${restartScript}"`);

        return NextResponse.json({
            success: true,
            message: "Sunucu 3 saniye içinde yeniden başlatılacak..."
        });

    } catch (err: any) {
        console.error("Restart error:", err);
        return NextResponse.json({
            error: "Restart failed",
            details: err.message
        }, { status: 500 });
    }
}
