import { test, expect } from '@playwright/test';

test.describe('Fast Hedger v2.3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('loads the page successfully', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('Wagers');
  });

  test('has initial empty row', async ({ page }) => {
    const rows = page.locator('[data-row]');
    await expect(rows).toHaveCount(1);
  });

  test('can add a wager with American odds', async ({ page }) => {
    // Fill in first row
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+150');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Check profit is calculated
    const profit = page.locator('[data-row]').first().locator('.profit');
    await expect(profit).toContainText('$150.00');
  });

  test('can add a wager with Kalshi format', async ({ page }) => {
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('25c');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Kalshi 25c = +300 American, but with fees
    // Check that profit is calculated (should be ~291 based on our test)
    const profit = page.locator('[data-row]').first().locator('.profit');
    await expect(profit).toContainText('$291');
  });

  test('shows unified analytics', async ({ page }) => {
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Check Side A analytics
    await expect(page.locator('#a_stake')).toContainText('$100.00');
    await expect(page.locator('#a_profit')).toContainText('$100.00');
    await expect(page.locator('#a_net')).toContainText('$100.00');
  });

  test('can clear all wagers', async ({ page }) => {
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    await page.locator('#clearAll').click();
    
    // Should reset to one empty row
    const rows = page.locator('[data-row]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.side')).toHaveValue('');
  });

  test('validates odds input', async ({ page }) => {
    const oddsInput = page.locator('[data-row]').first().locator('.odds');
    
    // Try invalid American odds
    await oddsInput.fill('+50');
    
    // Should show error
    await expect(page.locator('.error-text')).toBeVisible();
    await expect(page.locator('.error-text')).toContainText('American odds must be ≤-100 or ≥+100');
  });

  test('calculates cover correctly', async ({ page }) => {
    // Add a wager on side A
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Set odds for side B so cover can be calculated
    await page.locator('#useB').fill('+100');
    
    // Wait a bit for recalc
    await page.waitForTimeout(100);
    
    // Check Cover B = 0 (to neutralize if A wins)
    // Net B = -100, with +100 odds, need to stake 100
    await expect(page.locator('#bebStake')).toContainText('$100.00');
  });

  test('shows ghost row for equalization', async ({ page }) => {
    // Add a wager on side A
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Set odds for side B
    await page.locator('#useB').fill('+100');
    
    // Ghost row should appear with equalization suggestion
    await expect(page.locator('.ghost-row')).toBeVisible();
    
    // Check that it suggests betting on side 2
    const ghostSide = page.locator('.ghost-row .side');
    await expect(ghostSide).toHaveValue('2');
  });

  test('can commit ghost row', async ({ page }) => {
    // Add a wager on side A
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Set odds for side B
    await page.locator('#useB').fill('+100');
    
    // Wait for ghost row
    await expect(page.locator('.ghost-row')).toBeVisible();
    
    // Commit the ghost row
    await page.locator('.ghost-row .commit').click();
    
    // Should now have 2 regular rows
    const rows = page.locator('[data-row]');
    await expect(rows).toHaveCount(2);
  });

  test('formats odds in different formats', async ({ page }) => {
    // Add a wager
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Set odds for side B to trigger ghost
    await page.locator('#useB').fill('+100');
    await expect(page.locator('.ghost-row')).toBeVisible();
    
    // Toggle to decimal format
    await page.locator('.format-btn[data-format="decimal"]').click();
    
    // Ghost odds should now show decimal format
    const ghostOdds = page.locator('.ghost-row .odds');
    await expect(ghostOdds).toHaveValue('2.00');
  });
});
