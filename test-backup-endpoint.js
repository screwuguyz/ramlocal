// Native fetch in Node 18+

async function testBackup() {
    try {
        console.log("Testing backup endpoint...");
        const res = await fetch('http://localhost:3000/api/cron/backup');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}

testBackup();
