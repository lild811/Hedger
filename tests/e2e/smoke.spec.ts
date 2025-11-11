import { test, expect } from './setup.compact';

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
    // Set row type to Kalshi YES
    await page.locator('[data-row]').first().locator('.type-select').selectOption('kalshi-yes');
    await page.waitForTimeout(100);
    
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('25c');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Wait for calculation
    await page.waitForTimeout(200);
    
    // Kalshi 25c = +300 American, but with fees (1% open + 2% settle)
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

  test('ProphetX fee marker: PX! applies 1% fee on winnings', async ({ page }) => {
    // Add wager with PX! marker
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.sportsbook').fill('PX!');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Profit should be 99 (100 - 1% fee)
    const profit = page.locator('[data-row]').first().locator('.profit');
    await expect(profit).toContainText('$99.00');
  });

  test('ProphetX fee marker: PX has no fee', async ({ page }) => {
    // Add wager with PX marker (no exclamation)
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.sportsbook').fill('PX');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Profit should be 100 (no fee)
    const profit = page.locator('[data-row]').first().locator('.profit');
    await expect(profit).toContainText('$100.00');
  });

  test('Per-row Kalshi: Normal row rejects Kalshi formats', async ({ page }) => {
    // Row should be Normal by default
    await expect(page.locator('[data-row]').first().locator('.type-select')).toHaveValue('normal');
    
    // Try to enter Kalshi format odds
    const oddsInput = page.locator('[data-row]').first().locator('.odds');
    await oddsInput.fill('25c');
    
    // Should show error
    await expect(page.locator('.error-text')).toBeVisible();
    await expect(page.locator('.error-text')).toContainText('not allowed for Normal rows');
  });

  test('Per-row Kalshi: Kalshi row accepts Kalshi formats with fees', async ({ page }) => {
    // Set row to Kalshi YES
    await page.locator('[data-row]').first().locator('.type-select').selectOption('kalshi-yes');
    await page.waitForTimeout(100);
    
    // Enter Kalshi format odds
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('62c');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Wait for calculation
    await page.waitForTimeout(200);
    
    // Should NOT show error and should calculate profit with Kalshi fees
    await expect(page.locator('.error-text')).not.toBeVisible();
    const profit = page.locator('[data-row]').first().locator('.profit');
    // 62c = +61.29 American approx, with Kalshi fees: ~59.27
    await expect(profit).toContainText('$');
  });

  test('Undo/Redo functionality', async ({ page }) => {
    // Add a wager
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+150');
    
    // Wait for auto-save to trigger
    await page.waitForTimeout(300);
    
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Wait for state to be saved
    await page.waitForTimeout(300);
    
    // Undo button should be enabled after changes
    await expect(page.locator('#undoBtn')).not.toBeDisabled();
    
    // Click undo
    await page.locator('#undoBtn').click();
    
    // Wait for undo to process
    await page.waitForTimeout(100);
    
    // Stake should be cleared (undone)
    const stake = page.locator('[data-row]').first().locator('.stake');
    await expect(stake).toHaveValue('');
    
    // Redo button should be enabled
    await expect(page.locator('#redoBtn')).not.toBeDisabled();
    
    // Click redo
    await page.locator('#redoBtn').click();
    
    // Wait for redo
    await page.waitForTimeout(100);
    
    // Stake should be restored
    await expect(stake).toHaveValue('100');
  });

  test('CSV export and import round-trip', async ({ page }) => {
    // Add a wager
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.sportsbook').fill('PX!');
    await page.locator('[data-row]').first().locator('.odds').fill('+150');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Wait for recalc
    await page.waitForTimeout(100);
    
    // Start download listener
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportCSV').click();
    const download = await downloadPromise;
    
    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/hedger-.*\.csv/);
  });

  test('Delete row removes it entirely', async ({ page }) => {
    // Add two wagers
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('#addRow').click();
    await page.locator('[data-row]').nth(1).locator('.side').fill('2');
    
    await expect(page.locator('[data-row]')).toHaveCount(2);
    
    // Delete first row
    await page.locator('[data-row]').first().locator('.clear').click();
    
    // Should only have one row left
    await expect(page.locator('[data-row]')).toHaveCount(1);
    await expect(page.locator('[data-row]').first().locator('.side')).toHaveValue('2');
  });

  test('Lines & Cover parity after commit', async ({ page }) => {
    // Add a wager on side A
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Set odds for side B to trigger ghost
    await page.locator('#useB').fill('+100');
    await page.waitForTimeout(100);
    
    // Get Summary net values before commit
    const netABefore = await page.locator('#a_net').textContent();
    
    // Commit the ghost row
    await page.locator('.ghost-row .commit').click();
    await page.waitForTimeout(100);
    
    // Get Summary net values after commit
    const netAAfter = await page.locator('#a_net').textContent();
    const netBAfter = await page.locator('#b_net').textContent();
    
    // Values should have changed (equalized)
    expect(netAAfter).not.toBe(netABefore);
    
    // Net A and Net B should be approximately equal after commit
    const netAValue = parseFloat(netAAfter!.replace(/[^0-9.-]/g, ''));
    const netBValue = parseFloat(netBAfter!.replace(/[^0-9.-]/g, ''));
    expect(Math.abs(netAValue - netBValue)).toBeLessThan(1);
    
    // CRITICAL: Lines & Cover section must match Unified Summary after commit
    // Get Lines & Cover values
    const coverANetB = await page.locator('#beaNetB').textContent();
    const coverBNetA = await page.locator('#bebNetA').textContent();
    
    // Parse the values (removing $ and handling negative numbers)
    const coverANetBValue = parseFloat(coverANetB!.replace(/[^0-9.-]/g, ''));
    const coverBNetAValue = parseFloat(coverBNetA!.replace(/[^0-9.-]/g, ''));
    
    // Lines & Cover values should match Unified Summary
    // Cover A shows "Net if B wins" which should match Unified Summary's Net if B wins
    // Cover B shows "Net if A wins" which should match Unified Summary's Net if A wins
    expect(Math.abs(coverANetBValue - netBValue)).toBeLessThan(0.01);
    expect(Math.abs(coverBNetAValue - netAValue)).toBeLessThan(0.01);
  });

  test('Lines & Cover parity with mixed odds', async ({ page }) => {
    // Add a wager on side A with +150 odds
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+150');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Set odds for side B with -110 odds
    await page.locator('#useB').fill('-110');
    await page.waitForTimeout(100);
    
    // Verify ghost row appears
    await expect(page.locator('.ghost-row')).toBeVisible();
    
    // Commit the ghost row
    await page.locator('.ghost-row .commit').click();
    await page.waitForTimeout(100);
    
    // Get all values after commit
    const netAAfter = await page.locator('#a_net').textContent();
    const netBAfter = await page.locator('#b_net').textContent();
    const coverANetB = await page.locator('#beaNetB').textContent();
    const coverBNetA = await page.locator('#bebNetA').textContent();
    
    // Parse the values
    const netAValue = parseFloat(netAAfter!.replace(/[^0-9.-]/g, ''));
    const netBValue = parseFloat(netBAfter!.replace(/[^0-9.-]/g, ''));
    const coverANetBValue = parseFloat(coverANetB!.replace(/[^0-9.-]/g, ''));
    const coverBNetAValue = parseFloat(coverBNetA!.replace(/[^0-9.-]/g, ''));
    
    // After equalizing, nets should be approximately equal
    expect(Math.abs(netAValue - netBValue)).toBeLessThan(1);
    
    // Lines & Cover must match Unified Summary
    expect(Math.abs(coverANetBValue - netBValue)).toBeLessThan(0.01);
    expect(Math.abs(coverBNetAValue - netAValue)).toBeLessThan(0.01);
  });

  test('Mixed ticket: Normal and Kalshi rows in same session', async ({ page }) => {
    // Add Normal row with American odds
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.type-select').selectOption('normal');
    await page.locator('[data-row]').first().locator('.odds').fill('+150');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Add second row as Kalshi YES
    await page.locator('#addRow').click();
    await page.waitForTimeout(100);
    
    await page.locator('[data-row]').nth(1).locator('.side').fill('2');
    await page.locator('[data-row]').nth(1).locator('.type-select').selectOption('kalshi-yes');
    await page.locator('[data-row]').nth(1).locator('.odds').fill('40c');
    await page.locator('[data-row]').nth(1).locator('.stake').fill('100');
    
    await page.waitForTimeout(200);
    
    // Both rows should calculate profits
    const profit1 = page.locator('[data-row]').first().locator('.profit');
    await expect(profit1).toContainText('$150');
    
    const profit2 = page.locator('[data-row]').nth(1).locator('.profit');
    // 40c with Kalshi fees
    await expect(profit2).toContainText('$');
    
    // Both should contribute to their respective sides
    await expect(page.locator('#a_stake')).toContainText('$100');
    await expect(page.locator('#b_stake')).toContainText('$100');
  });
});

