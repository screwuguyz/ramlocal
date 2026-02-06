import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Server start time için global state
const serverStartTime = new Date();

// Son health check zamanı
let lastHealthCheck = new Date();
let consecutiveFailures = 0;

export async function GET() {
    lastHealthCheck = new Date();

    const now = new Date();
    const uptimeMs = now.getTime() - serverStartTime.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    // Bellek kullanımı
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);

    // state.json dosyasını kontrol et
    let stateFileOk = false;
    let stateFileSize = 0;
    let lastModified = null;
    try {
        const statePath = path.join(process.cwd(), "data", "state.json");
        const stats = fs.statSync(statePath);
        stateFileOk = stats.size > 100;
        stateFileSize = stats.size;
        lastModified = stats.mtime.toISOString();
    } catch (err) {
        stateFileOk = false;
    }

    // PDF klasörünü kontrol et
    let pdfFolderExists = false;
    let pdfFileCount = 0;
    try {
        const pdfPath = path.join(process.cwd(), "data", "pdf");
        if (fs.existsSync(pdfPath)) {
            pdfFolderExists = true;
            const files = fs.readdirSync(pdfPath);
            pdfFileCount = files.filter(f => f.endsWith(".json")).length;
        }
    } catch (err) {
        pdfFolderExists = false;
    }

    // Node.js bilgileri
    const nodeVersion = process.version;
    const platform = process.platform;
    const pid = process.pid;

    const status = {
        status: "OK",
        timestamp: now.toISOString(),
        server: {
            startTime: serverStartTime.toISOString(),
            uptime: {
                days: uptimeDays,
                hours: uptimeHours % 24,
                minutes: uptimeMinutes % 60,
                seconds: uptimeSeconds % 60,
                formatted: `${uptimeDays}g ${uptimeHours % 24}s ${uptimeMinutes % 60}d ${uptimeSeconds % 60}sn`
            },
            memory: {
                heapUsed: `${heapUsedMB} MB`,
                heapTotal: `${heapTotalMB} MB`,
                rss: `${rssMB} MB`,
                heapUsedPercent: Math.round((heapUsedMB / heapTotalMB) * 100)
            },
            node: {
                version: nodeVersion,
                platform: platform,
                pid: pid
            }
        },
        data: {
            stateFile: {
                exists: stateFileOk,
                size: `${Math.round(stateFileSize / 1024)} KB`,
                lastModified: lastModified
            },
            pdfFolder: {
                exists: pdfFolderExists,
                fileCount: pdfFileCount
            }
        },
        checks: {
            serverRunning: true,
            dataAccessible: stateFileOk,
            memoryHealthy: heapUsedMB < 500, // 500MB altında sağlıklı kabul ediyoruz
            overall: stateFileOk && heapUsedMB < 500 ? "HEALTHY" : "WARNING"
        }
    };

    return NextResponse.json(status);
}

// POST: Admin tarafından manuel health check tetikleme veya email uyarı testi
export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.action === "test-email") {
            // Email test gönder
            const emailResult = await sendHealthAlert("Test uyarısı - RAM Server sağlık kontrolü çalışıyor");
            return NextResponse.json({
                success: emailResult.success,
                message: emailResult.message
            });
        }

        if (body.action === "report-failure") {
            consecutiveFailures++;

            // 3 ardışık hatadan sonra email gönder
            if (consecutiveFailures >= 3) {
                await sendHealthAlert(`RAM Server ${consecutiveFailures} kez yanıt vermedi. Lütfen kontrol edin.`);
                consecutiveFailures = 0;
            }

            return NextResponse.json({
                success: true,
                failures: consecutiveFailures
            });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}

// Email gönderme fonksiyonu
async function sendHealthAlert(message: string): Promise<{ success: boolean; message: string }> {
    const alertEmail = process.env.HEALTH_ALERT_EMAIL || "fztataa@gmail.com";
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;

    // SMTP yapılandırılmamışsa Pushover dene
    if (!smtpHost || !smtpUser || !smtpPass) {
        // Pushover ile göndermeyi dene
        const pushoverToken = process.env.PUSHOVER_TOKEN;
        const pushoverUser = process.env.PUSHOVER_USER_KEY || process.env.HEALTH_ALERT_PUSHOVER_KEY;

        if (pushoverToken && pushoverUser) {
            try {
                const res = await fetch("https://api.pushover.net/1/messages.json", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        token: pushoverToken,
                        user: pushoverUser,
                        title: "⚠️ RAM Server Uyarısı",
                        message: message,
                        priority: 1
                    })
                });

                if (res.ok) {
                    return { success: true, message: "Pushover ile uyarı gönderildi" };
                }
            } catch (err) {
                console.error("Pushover error:", err);
            }
        }

        return { success: false, message: "Email/Pushover yapılandırılmamış" };
    }

    // Nodemailer ile email gönder
    try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(smtpPort) || 465,
            secure: true,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

        await transporter.sendMail({
            from: smtpFrom || smtpUser,
            to: alertEmail,
            subject: "⚠️ RAM Server Sağlık Uyarısı",
            text: message,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #dc2626;">⚠️ RAM Server Uyarısı</h2>
          <p style="font-size: 16px;">${message}</p>
          <p style="color: #666; font-size: 12px;">Bu otomatik bir uyarı mesajıdır.</p>
          <hr />
          <p style="color: #999; font-size: 11px;">${new Date().toLocaleString("tr-TR")}</p>
        </div>
      `
        });

        return { success: true, message: `Email gönderildi: ${alertEmail}` };
    } catch (err: any) {
        console.error("Email send error:", err);
        return { success: false, message: `Email gönderilemedi: ${err.message}` };
    }
}
