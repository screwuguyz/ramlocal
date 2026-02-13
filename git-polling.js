const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ayarlar
const PROJECT_DIR = path.resolve(__dirname);
const LOG_FILE = path.join(PROJECT_DIR, 'deploy.log');
const CHECK_INTERVAL = 60000; // 1 dakika (ms)

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: PROJECT_DIR, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`${error.message}\n${stderr}`));
                return;
            }
            resolve(stdout.trim());
        });
    });
}

async function checkForUpdates() {
    try {
        // Fetch latest from remote
        await runCommand('git fetch ramlocal main');

        // Get local and remote commit hashes
        const localHash = await runCommand('git rev-parse HEAD');
        const remoteHash = await runCommand('git rev-parse ramlocal/main');

        if (localHash !== remoteHash) {
            log(`🔄 Yeni güncelleme bulundu!`);
            log(`   Local:  ${localHash.substring(0, 7)}`);
            log(`   Remote: ${remoteHash.substring(0, 7)}`);

            // Deploy
            log('🚀 Deployment başlatılıyor...');
            await runCommand('git reset --hard ramlocal/main');
            await runCommand('npm install');
            await runCommand('npm run build');
            log('✅ Deployment tamamlandı!');

            return true;
        } else {
            // Her kontrol loglamayın, sadece değişiklik varsa
            process.stdout.write('.');
        }
        return false;
    } catch (error) {
        log(`❌ Hata: ${error.message}`);
        return false;
    }
}

async function main() {
    log('🎯 Git Polling başlatıldı');
    log(`   Kontrol aralığı: ${CHECK_INTERVAL / 1000} saniye`);
    log(`   Proje dizini: ${PROJECT_DIR}`);
    log('   Değişiklikleri bekliyor...');

    // İlk kontrol
    await checkForUpdates();

    // Periyodik kontrol
    setInterval(checkForUpdates, CHECK_INTERVAL);
}

main();
