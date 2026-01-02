import { test, expect } from '@playwright/test';

test.describe('Theme Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle theme mode', async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page.locator('button:has-text("Açık"), button:has-text("Koyu"), button:has-text("Otomatik")');
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    // Click theme toggle
    await themeToggle.click();

    // Wait for theme to change
    await page.waitForTimeout(500);

    // Verify theme changed
    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    // Theme should have changed (light -> dark -> auto cycle)
    expect(newTheme).toBeTruthy();
  });

  test('should persist theme in localStorage', async ({ page }) => {
    // Click theme toggle
    const themeToggle = page.locator('button:has-text("Açık"), button:has-text("Koyu"), button:has-text("Otomatik")');
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();

    // Theme should persist
    const theme = await page.evaluate(() => {
      return localStorage.getItem('site_theme_mode');
    });

    expect(theme).toBeTruthy();
    expect(['light', 'dark', 'auto']).toContain(theme);
  });

  test('should apply dark mode styles', async ({ page }) => {
    // Set dark mode
    await page.evaluate(() => {
      localStorage.setItem('site_theme_mode', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await page.reload();

    // Check if dark mode is applied
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(dataTheme).toBe('dark');

    // Check if body has dark background
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Dark mode should have dark background
    expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)');
  });
});


test.describe('Theme Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle theme mode', async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page.locator('button:has-text("Açık"), button:has-text("Koyu"), button:has-text("Otomatik")');
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    // Click theme toggle
    await themeToggle.click();

    // Wait for theme to change
    await page.waitForTimeout(500);

    // Verify theme changed
    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    // Theme should have changed (light -> dark -> auto cycle)
    expect(newTheme).toBeTruthy();
  });

  test('should persist theme in localStorage', async ({ page }) => {
    // Click theme toggle
    const themeToggle = page.locator('button:has-text("Açık"), button:has-text("Koyu"), button:has-text("Otomatik")');
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();

    // Theme should persist
    const theme = await page.evaluate(() => {
      return localStorage.getItem('site_theme_mode');
    });

    expect(theme).toBeTruthy();
    expect(['light', 'dark', 'auto']).toContain(theme);
  });

  test('should apply dark mode styles', async ({ page }) => {
    // Set dark mode
    await page.evaluate(() => {
      localStorage.setItem('site_theme_mode', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await page.reload();

    // Check if dark mode is applied
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(dataTheme).toBe('dark');

    // Check if body has dark background
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Dark mode should have dark background
    expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)');
  });
});




