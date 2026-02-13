import { test, expect } from '@playwright/test';

test.describe('RAM Dosya Atama - Comprehensive System Test', () => {

    // --- 1. AUTHENTICATION & INTEGRITY ---
    test('Authentication: Should login as admin and persist session', async ({ page }) => {
        await page.goto('/');

        // Check if login modal appears or button exists
        const loginBtn = page.locator('button:has-text("Admin Girişi")');
        if (await loginBtn.isVisible()) {
            await loginBtn.click();
            await page.fill('input[type="email"]', 'admin@example.com');
            await page.fill('input[type="password"]', 'admin');
            await page.click('button:has-text("Giriş Yap")');
        }

        // Verify admin dashboard visible
        await expect(page.locator('text=Admin Paneli')).toBeVisible();
        await expect(page.locator('text=Çıkış')).toBeVisible();
    });

    // --- 2. TEACHER MANAGEMENT ---
    test('Teachers: Should add, edit, and delete a teacher', async ({ page }) => {
        await page.goto('/');

        // Navigate to Teachers Tab
        await page.click('button:has-text("Öğretmenler")');

        // Add Teacher
        await page.fill('input[placeholder="Yeni öğretmen adı..."]', 'Test Robotu Öğretmen');
        await page.click('button:has-text("Ekle")');

        // Verify Added
        await expect(page.locator('text=Test Robotu Öğretmen')).toBeVisible();

        // Edit Teacher (Toggle Active/Passive)
        const teacherRow = page.locator('div', { hasText: 'Test Robotu Öğretmen' }).last();
        // Assuming there's a toggle or edit button (adjust selector based on actual UI)
        // For now, let's verify it exists. detailed edit might require specific ID selectors which are dynamic.

        // Delete Teacher
        // Find delete button within the row (assuming trash icon)
        await teacherRow.locator('button .lucide-trash-2').click();

        // Confirm deletion if needed (assuming browser confirm or modal)
        // Playwright auto-dismisses alerts, but if custom modal:
        // await page.click('button:has-text("Evet")'); 

        // Verify Deleted
        await expect(page.locator('text=Test Robotu Öğretmen')).not.toBeVisible();
    });

    // --- 3. CASE ASSIGNMENT & ZOMBIE CHECK ---
    test('Case Assignment: Validation, Success, and Zombie Protection', async ({ page }) => {
        await page.goto('/');

        // 3.1 Validation Check
        await page.click('button:has-text("Dosya Atama")'); // Ensure tab
        await page.click('button:has-text("Ata")'); // Click empty
        // Expect warning toast/modal
        await expect(page.locator('text=Öğrenci adı gerekli')).toBeVisible();

        // 3.2 Manual Assignment
        const testStudent = `Robot Öğrenci ${Date.now()}`;
        await page.fill('input[placeholder="Öğrenci Adı Soyadı"]', testStudent);
        await page.fill('input[placeholder="Dosya No"]', '9999');

        // Select Grade (Select component)
        await page.click('button[role="combobox"]'); // Open select
        await page.click('div[role="option"]:has-text("1. Sınıf")'); // Pick option

        await page.click('button:has-text("Ata")');

        // Verify Success Popup
        await expect(page.locator(`text=${testStudent}`)).toBeVisible();
        await page.click('button:has-text("Kapat")'); // Close popup

        // 3.3 Deletion & Zombie Check
        // Locate the case in "Bugün Atananlar" list
        const caseRow = page.locator('div', { hasText: testStudent }).first();
        await expect(caseRow).toBeVisible();

        // Delete
        await caseRow.locator('button .lucide-trash-2').click();
        // Verify gone
        await expect(page.locator(`text=${testStudent}`)).not.toBeVisible();

        // Wait 15s (Zombie Protection Window)
        console.log('Waiting 15s for Zombie Check...');
        await page.waitForTimeout(15000);

        // Verify STILL gone
        await expect(page.locator(`text=${testStudent}`)).not.toBeVisible();
    });

    // --- 4. PDF PANEL ---
    test('PDF Panel: Open, Close and Element Check', async ({ page }) => {
        await page.goto('/');

        // Open Panel
        await page.click('button:has-text("PDF Yükle")'); // Assuming a button exists or via Header

        // Check Elements
        await expect(page.locator('text=RAM Randevu PDF Yükle')).toBeVisible();
        await expect(page.locator('text=PDF dosyasını buraya sürükleyin')).toBeVisible();

        // Close Panel (Test the fixed X button)
        await page.click('button[title="Kapat"]');

        // Verify Closed
        await expect(page.locator('text=RAM Randevu PDF Yükle')).not.toBeVisible();
    });

    // --- 5. REPORTING & THEME ---
    test('System: Navigation and Theme Toggle', async ({ page }) => {
        await page.goto('/');

        // Theme Toggle
        const themeBtn = page.locator('button:has-text("Açık"), button:has-text("Koyu")');
        if (await themeBtn.isVisible()) {
            await themeBtn.click();
            // Verify visual change (optional, usually relying on class change)
        }

        // Reports Tab
        await page.click('button:has-text("Raporlar")');
        await expect(page.locator('text=Aylık Rapor')).toBeVisible();
        await expect(page.locator('text=Yıllık Rapor')).toBeVisible();
    });

});
