import { test, expect } from '@playwright/test';

test('basic smoke test', async ({ page }) => {
  await page.goto('/index.html');
  
  // Check that the page title is correct
  await expect(page).toHaveTitle(/Fast Hedger/);
  
  // Check that the main header is present
  await expect(page.locator('h1').first()).toContainText('Wagers');
  
  // Check that the Add Wager button exists
  await expect(page.locator('#addRow')).toBeVisible();
});
