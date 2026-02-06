const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'data', 'state.json');
const PDF_DIR = path.join(__dirname, 'data', 'pdf');

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
}

try {
    const stateData = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(stateData);
    const history = state.history || {};

    console.log('Restoring PDF files from state history...');

    let restoredCount = 0;

    // Iterate over each date in history
    for (const [date, cases] of Object.entries(history)) {
        if (!Array.isArray(cases) || cases.length === 0) continue;

        // Collect distinct PDF entries for this date
        const pdfEntries = [];
        const seenIds = new Set();

        let hasPdfData = false;

        for (const c of cases) {
            // Check if case has sourcePdfEntry
            if (c.sourcePdfEntry) {
                // Determine ID (use entry id or case id as fallback)
                const entryId = c.sourcePdfEntry.id || c.id;

                if (!seenIds.has(entryId)) {
                    pdfEntries.push({
                        id: entryId,
                        time: c.sourcePdfEntry.time || '00:00',
                        name: c.sourcePdfEntry.name || c.student,
                        fileNo: c.sourcePdfEntry.fileNo || c.fileNo || '',
                        extra: c.sourcePdfEntry.extra || ''
                    });
                    seenIds.add(entryId);
                    hasPdfData = true;
                }
            } else if (c.student) {
                // Even if no sourcePdfEntry, we can reconstruct a basic entry from the case itself
                if (!seenIds.has(c.id)) {
                    pdfEntries.push({
                        id: c.id,
                        time: '00:00', // Unknown time
                        name: c.student,
                        fileNo: c.fileNo || '',
                        extra: c.type || ''
                    });
                    seenIds.add(c.id);
                }
            }
        }

        if (pdfEntries.length > 0) {
            // Sort by time if possible
            pdfEntries.sort((a, b) => a.time.localeCompare(b.time));

            const targetFile = path.join(PDF_DIR, `${date}.json`);
            fs.writeFileSync(targetFile, JSON.stringify(pdfEntries, null, 2), 'utf8');
            console.log(`Restored ${date}.json (${pdfEntries.length} entries)`);
            restoredCount++;
        }
    }

    console.log(`\nSuccessfully restored ${restoredCount} PDF lists.`);

} catch (err) {
    console.error('Error restoring PDFs:', err);
}
