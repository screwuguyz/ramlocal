const nodemailer = require('nodemailer');

async function main() {
    // .env.local'dan bilgileri manuel alıp deneyelim veya hardcode edelim (test için)
    // Kullanıcının .env.local dosyasındaki bilgiler:
    const config = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'ataafurkan@gmail.com',
            pass: 'fyeqsvraitemaivm'
        }
    };

    console.log('Transporter oluşturuluyor...', config);

    const transporter = nodemailer.createTransport(config);

    try {
        console.log('Bağlantı doğrulanıyor...');
        await transporter.verify();
        console.log('Bağlantı BAŞARILI!');

        console.log('Email gönderiliyor...');
        const info = await transporter.sendMail({
            from: config.auth.user,
            to: config.auth.user, // Kendine gönder
            subject: 'Test Email - Node Script',
            text: 'Bu bir test emailidir. Node.js scriptinden gönderildi.'
        });

        console.log('Email gönderildi:', info.messageId);
    } catch (err) {
        console.error('HATA OLUŞTU:');
        console.error(err);
    }
}

main();
