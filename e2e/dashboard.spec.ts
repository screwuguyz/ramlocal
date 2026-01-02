import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display dashboard cards', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for dashboard cards
    const cards = page.locator('[class*="from-teal-500"], [class*="from-orange-500"], [class*="from-purple-500"], [class*="from-emerald-500"]');
    
    // Should have at least one card
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display correct card labels', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for specific card labels
    const bugunAtanan = page.locator('text=Bugün Atanan');
    const bekleyenRandevu = page.locator('text=Bekleyen Randevu');
    const arsivliGun = page.locator('text=Arşivli Gün');

    // At least one should be visible
    const visible = await Promise.all([
      bugunAtanan.isVisible().catch(() => false),
      bekleyenRandevu.isVisible().catch(() => false),
      arsivliGun.isVisible().catch(() => false),
    ]);

    expect(visible.some(v => v)).toBe(true);
  });

  test('should display numbers in cards', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find cards with numbers (text-3xl font-bold)
    const cardNumbers = page.locator('[class*="text-3xl"][class*="font-bold"]');
    
    const count = await cardNumbers.count();
    expect(count).toBeGreaterThan(0);

    // Check if numbers are visible
    const firstNumber = cardNumbers.first();
    const text = await firstNumber.textContent();
    expect(text).toBeTruthy();
    expect(/\d+/.test(text || '')).toBe(true);
  });
});


test.describe('Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display dashboard cards', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for dashboard cards
    const cards = page.locator('[class*="from-teal-500"], [class*="from-orange-500"], [class*="from-purple-500"], [class*="from-emerald-500"]');
    
    // Should have at least one card
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display correct card labels', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for specific card labels
    const bugunAtanan = page.locator('text=Bugün Atanan');
    const bekleyenRandevu = page.locator('text=Bekleyen Randevu');
    const arsivliGun = page.locator('text=Arşivli Gün');

    // At least one should be visible
    const visible = await Promise.all([
      bugunAtanan.isVisible().catch(() => false),
      bekleyenRandevu.isVisible().catch(() => false),
      arsivliGun.isVisible().catch(() => false),
    ]);

    expect(visible.some(v => v)).toBe(true);
  });

  test('should display numbers in cards', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find cards with numbers (text-3xl font-bold)
    const cardNumbers = page.locator('[class*="text-3xl"][class*="font-bold"]');
    
    const count = await cardNumbers.count();
    expect(count).toBeGreaterThan(0);

    // Check if numbers are visible
    const firstNumber = cardNumbers.first();
    const text = await firstNumber.textContent();
    expect(text).toBeTruthy();
    expect(/\d+/.test(text || '')).toBe(true);
  });
});




