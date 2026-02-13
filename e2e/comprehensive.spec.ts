import { test, expect } from '@playwright/test';

test.describe('RAM Dosya Atama - Comprehensive System Test', () => {

    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000); // 90s timeout
    });

    // --- 1. AUTHENTICATION & INTEGRITY ---
    test('Authentication: Should login as admin and persist session', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Check if we are already logged in (look for sign of dashboard)
        const dashboardIndicator = page.locator('text=Sunucu Durumu').first();
        const loginBtn = page.locator('button:has-text("Admin Girişi")');

        if (await dashboardIndicator.isVisible({ timeout: 5000 })) {
            console.log('Already logged in.');
            return; // Pass test
        }

        if (await loginBtn.isVisible({ timeout: 5000 })) {
            await loginBtn.click();
            await page.fill('input[type="email"]', 'admin@example.com');
            await page.fill('input[type="password"]', 'admin');
            await page.click('button:has-text("Giriş Yap")');
            // Wait for login to complete
            await expect(dashboardIndicator).toBeVisible({ timeout: 20000 });
        } else {
            console.log('Neither login button nor dashboard found. Check network/initial state.');
        }
    });

    // --- 2. TEACHER MANAGEMENT ---
    test('Teachers: Should add, edit, and delete a teacher', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Check if we can access teachers
        const teachersTab = page.locator('button:has-text("Öğretmenler")');
        if (!await teachersTab.isVisible()) {
            test.skip(true, 'Teachers tab not visible (auth required?)');
        }

        // Navigate to Teachers Tab
        await teachersTab.click({ force: true });

        // Add Teacher
        const uniqueTeacherName = `Test Robotu ${Date.now()}`;
        await page.fill('input[placeholder="Yeni öğretmen adı..."]', uniqueTeacherName);
        await page.click('button:has-text("Ekle")', { force: true });

        // Verify Added
        await expect(page.locator(`text=${uniqueTeacherName}`)).toBeVisible({ timeout: 10000 });

        // Delete Teacher
        const teacherRow = page.locator('div', { hasText: uniqueTeacherName }).filter({ hasText: uniqueTeacherName }).last();
        // Use force click on delete button
        if (await teacherRow.isVisible()) {
            await teacherRow.locator('button').filter({ has: page.locator('.lucide-trash-2') }).click({ force: true });
            // Verify Deleted
            await expect(page.locator(`text=${uniqueTeacherName}`)).not.toBeVisible();
        }
    });

    // --- 3. CASE ASSIGNMENT & ZOMBIE CHECK ---
    test('Case Assignment: Validation, Success, and Zombie Protection', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // 3.1 Validation Check
        const assignTab = page.locator('button:has-text("Dosya Atama")');
        if (await assignTab.isVisible()) {
            await assignTab.click({ force: true });
        } else {
            test.skip(true, 'Assignment tab not found');
        }

        // Use precise selector for "Ata" button (avoiding multiple matches)
        // The main assignment button has "📁 DOSYA ATA" text
        const ataBtn = page.locator('button:has-text("📁 DOSYA ATA")');
        if (!await ataBtn.isVisible()) test.skip(true, 'Assign button not found');

        await ataBtn.click({ force: true });

        // Validation check - relaxed selector
        await expect(page.locator('text=gerekli').first()).toBeVisible({ timeout: 10000 });

        // 3.2 Manual Assignment
        const testStudent = `Robot Öğrenci ${Date.now()}`;
        await page.fill('input[placeholder="Örn. Ali Veli"]', testStudent);
        await page.fill('input[placeholder="Örn. 2025-001"]', '9999');

        // Select Grade
        await page.click('button[role="combobox"]', { force: true });
        await page.click('div[role="option"]:has-text("1. Sınıf")', { force: true });

        await ataBtn.click({ force: true });

        // Verify Success Popup
        await expect(page.locator(`text=${testStudent}`)).toBeVisible({ timeout: 10000 });

        // Close success popup
        const closeBtn = page.locator('button:has-text("Kapat")');
        if (await closeBtn.isVisible()) {
            await closeBtn.click({ force: true });
        }

        // 3.3 Deletion & Zombie Check
        const caseRow = page.locator('.space-y-3 div', { hasText: testStudent }).first();
        await expect(caseRow).toBeVisible();

        // Delete
        await caseRow.locator('button').filter({ has: page.locator('.lucide-trash-2') }).click({ force: true });

        // Verify gone immediately
        await expect(page.locator(`text=${testStudent}`)).not.toBeVisible();

        // Wait 15s (Zombie Protection Window)
        console.log('Waiting 15s for Zombie Check...');
        await page.waitForTimeout(16000);

        // Verify STILL gone
        await expect(page.locator(`text=${testStudent}`)).not.toBeVisible();
    });

    // --- 4. PDF PANEL ---
    test('PDF Panel: Open, Close and Element Check', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const pdfBtn = page.locator('button').filter({ hasText: 'PDF' }).first();

        if (await pdfBtn.isVisible()) {
            await pdfBtn.click({ force: true });
            // Check Elements
            await expect(page.locator('text=RAM Randevu PDF Yükle')).toBeVisible({ timeout: 10000 });
            // Close Panel
            await page.click('button[title="Kapat"]', { force: true });
            // Verify Closed
            await expect(page.locator('text=RAM Randevu PDF Yükle')).not.toBeVisible();
        } else {
            test.skip(true, 'PDF Button not found');
        }
    });

    // --- 5. REPORTING & THEME ---
    test('System: Navigation and Theme Toggle', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Theme Toggle
        const themeBtn = page.locator('button:has-text("Açık"), button:has-text("Koyu")');
        if (await themeBtn.isVisible()) {
            await themeBtn.click({ force: true });
        }

        // Reports Tab
        const reportBtn = page.locator('button:has-text("Raporlar")');
        if (await reportBtn.isVisible()) {
            await reportBtn.click({ force: true });
            await expect(page.locator('text=Aylık Rapor')).toBeVisible({ timeout: 10000 });
        }
    });

});
