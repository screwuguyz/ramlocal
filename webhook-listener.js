const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Ayarlar
const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'ram-deploy-secret-2026';
const PROJECT_DIR = path.resolve(__dirname);
const LOG_FILE = path.join(PROJECT_DIR, 'deploy.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(LOG_FILE, logMessage);
}

function verifySignature(payload, signature) {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

function deploy() {
    return new Promise((resolve, reject) => {
        log('🚀 Deployment başlatılıyor...');

        const commands = [
            'git fetch ramlocal',
            'git reset --hard ramlocal/main',
            'npm install',
            'npm run build'
        ];

        const fullCommand = commands.join(' && ');

        exec(fullCommand, { cwd: PROJECT_DIR, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                log(`❌ Deployment hatası: ${error.message}`);
                log(`Stderr: ${stderr}`);
                reject(error);
                return;
            }
            log(`✅ Deployment başarılı!`);
            log(`Stdout: ${stdout}`);
            resolve(stdout);
        });
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Webhook listener çalışıyor' }));
        return;
    }

    if (req.method !== 'POST' || req.url !== '/webhook') {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        const signature = req.headers['x-hub-signature-256'];

        // Signature doğrulama (opsiyonel ama önerilir)
        if (SECRET && !verifySignature(body, signature)) {
            log('⚠️ Geçersiz signature, istek reddedildi');
            res.writeHead(401);
            res.end('Unauthorized');
            return;
        }

        try {
            const payload = JSON.parse(body);

            // Sadece main branch push'larını işle
            if (payload.ref !== 'refs/heads/main') {
                log(`ℹ️ Push main branch değil (${payload.ref}), atlanıyor`);
                res.writeHead(200);
                res.end('OK - Not main branch');
                return;
            }

            log(`📥 Push alındı: ${payload.head_commit?.message || 'No message'}`);

            res.writeHead(200);
            res.end('OK - Deploying...');

            // Async olarak deploy et
            deploy().catch(err => log(`Deploy hatası: ${err.message}`));

        } catch (err) {
            log(`❌ Payload parse hatası: ${err.message}`);
            res.writeHead(400);
            res.end('Bad Request');
        }
    });
});

server.listen(PORT, () => {
    log(`🎯 Webhook listener başlatıldı: http://localhost:${PORT}`);
    log(`   Health check: http://localhost:${PORT}/health`);
    log(`   Webhook endpoint: http://localhost:${PORT}/webhook`);
});
