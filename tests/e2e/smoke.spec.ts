import { test, expect } from '@playwright/test';

test('loads Fast Hedger and shows title', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle(/Fast Hedger/);
  await expect(page.locator('h1:has-text("Wagers")')).toBeVisible();
});
