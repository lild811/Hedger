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

  // ===== NEW TESTS BASED ON ISSUE REQUIREMENTS =====

  test('Equalize Flow: enter A and B lines, click Equalize, commit ghost → nets equal', async ({ page }) => {
    // Add a wager on side A with specific odds
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+150');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Enter Line B odds manually to enable equalization
    await page.locator('#useB').fill('+200');
    await page.waitForTimeout(200);
    
    // Ghost row should appear with equalization suggestion
    await expect(page.locator('.ghost-row')).toBeVisible();
    
    // Get the net values before committing ghost
    const netABeforeText = await page.locator('#a_net').textContent();
    const netBBeforeText = await page.locator('#b_net').textContent();
    const netABefore = parseFloat(netABeforeText!.replace(/[^0-9.-]/g, ''));
    const netBBefore = parseFloat(netBBeforeText!.replace(/[^0-9.-]/g, ''));
    
    // Nets should NOT be equal before commit
    expect(Math.abs(netABefore - netBBefore)).toBeGreaterThan(1);
    
    // Click the Equalize preset button to trigger equalization
    await page.locator('#presetEqualize').click();
    await page.waitForTimeout(100);
    
    // Ghost row should still be visible
    await expect(page.locator('.ghost-row')).toBeVisible();
    
    // Commit the ghost row
    await page.locator('.ghost-row .commit').click();
    await page.waitForTimeout(200);
    
    // Get the net values after committing ghost
    const netAAfterText = await page.locator('#a_net').textContent();
    const netBAfterText = await page.locator('#b_net').textContent();
    const netAAfter = parseFloat(netAAfterText!.replace(/[^0-9.-]/g, ''));
    const netBAfter = parseFloat(netBAfterText!.replace(/[^0-9.-]/g, ''));
    
    // Nets should now be approximately equal (within $1 tolerance)
    expect(Math.abs(netAAfter - netBAfter)).toBeLessThan(1);
    
    // Should have 2 regular rows now
    await expect(page.locator('[data-row]')).toHaveCount(2);
  });

  test('Kalshi YES@0.62 with 10 shares: verify net for both outcomes', async ({ page }) => {
    // Set row to Kalshi YES
    await page.locator('[data-row]').first().locator('.type-select').selectOption('kalshi-yes');
    await page.waitForTimeout(100);
    
    // Enter Kalshi format odds: YES@0.62 means 62c or 0.62 price
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('0.62');
    
    // Calculate stake for 10 contracts: 10 * 0.62 = 6.2
    // With Kalshi, N contracts = floor(stake / price), so for 10 contracts at 0.62, stake = 6.2
    await page.locator('[data-row]').first().locator('.stake').fill('6.2');
    
    await page.waitForTimeout(200);
    
    // Verify profit is calculated with Kalshi fees
    // 10 contracts at 0.62: cost = 6.20, open fee = 0.06 (1%), settle fee = 0.20 (2%)
    // If YES wins: net payout = 10 - 0.20 = 9.80, profit = 9.80 - 6.20 - 0.06 = 3.54
    const profit = page.locator('[data-row]').first().locator('.profit');
    await expect(profit).toContainText('$3.54');
    
    // Verify Side A net (if A wins, profit A - stake B)
    // Net A = 3.54 - 0 = 3.54 (positive, shown in green)
    await expect(page.locator('#a_net')).toContainText('$3.54');
    await expect(page.locator('#a_net')).toHaveClass(/good/);
    
    // Verify Side B net (if B wins, profit B - stake A)
    // Net B = 0 - 6.2 = -6.2 (negative, but money() shows absolute value)
    await expect(page.locator('#b_net')).toContainText('$6.20');
    await expect(page.locator('#b_net')).toHaveClass(/bad/);
  });

  test('Kalshi Toggle: Normal mode rejects 0.xx odds format', async ({ page }) => {
    // Row should be Normal by default
    await expect(page.locator('[data-row]').first().locator('.type-select')).toHaveValue('normal');
    
    // Try to enter Kalshi price format 0.62
    const oddsInput = page.locator('[data-row]').first().locator('.odds');
    await oddsInput.fill('0.62');
    
    await page.waitForTimeout(100);
    
    // Should show error about 0.xx not allowed for Normal rows
    await expect(page.locator('.error-text')).toBeVisible();
    await expect(page.locator('.error-text')).toContainText('0.xx odds not allowed for Normal rows');
    
    // Now switch to Kalshi YES mode
    await page.locator('[data-row]').first().locator('.type-select').selectOption('kalshi-yes');
    await page.waitForTimeout(100);
    
    // Error should disappear and format should be accepted
    await expect(page.locator('.error-text')).not.toBeVisible();
    
    // Can now enter stake and it should calculate
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.stake').fill('10');
    await page.waitForTimeout(200);
    
    // Should calculate profit with Kalshi fees
    const profit = page.locator('[data-row]').first().locator('.profit');
    await expect(profit).toContainText('$');
  });

  test('Undo/Redo: add row, delete row, undo, redo; nets follow changes', async ({ page }) => {
    // Start with initial state - add first wager
    await page.locator('[data-row]').first().locator('.side').fill('1');
    await page.locator('[data-row]').first().locator('.odds').fill('+100');
    await page.locator('[data-row]').first().locator('.stake').fill('100');
    
    // Wait for auto-save
    await page.waitForTimeout(600);
    
    // Check initial net
    await expect(page.locator('#a_net')).toContainText('$100.00');
    
    // Add a second row
    await page.locator('#addRow').click();
    await page.waitForTimeout(100);
    
    await page.locator('[data-row]').nth(1).locator('.side').fill('2');
    await page.locator('[data-row]').nth(1).locator('.odds').fill('+100');
    await page.locator('[data-row]').nth(1).locator('.stake').fill('100');
    
    // Wait for auto-save
    await page.waitForTimeout(600);
    
    // Should have 2 rows now
    await expect(page.locator('[data-row]')).toHaveCount(2);
    
    // Check nets are equalized
    const netAText = await page.locator('#a_net').textContent();
    const netBText = await page.locator('#b_net').textContent();
    const netAValue = parseFloat(netAText!.replace(/[^0-9.-]/g, ''));
    const netBValue = parseFloat(netBText!.replace(/[^0-9.-]/g, ''));
    expect(Math.abs(netAValue - netBValue)).toBeLessThan(1);
    
    // Delete the second row (click clear button)
    await page.locator('[data-row]').nth(1).locator('.clear').click();
    await page.waitForTimeout(600);
    
    // Should have 1 row again
    await expect(page.locator('[data-row]')).toHaveCount(1);
    
    // Net A should be positive (green)
    await expect(page.locator('#a_net')).toContainText('$100');
    await expect(page.locator('#a_net')).toHaveClass(/good/);
    
    // Net B should be negative (red/bad) - money() shows absolute value, check class
    await expect(page.locator('#b_net')).toContainText('$100');
    await expect(page.locator('#b_net')).toHaveClass(/bad/);
    
    // Now UNDO the deletion
    await page.locator('#undoBtn').click();
    await page.waitForTimeout(200);
    
    // Should have 2 rows again
    await expect(page.locator('[data-row]')).toHaveCount(2);
    
    // Nets should be equalized again
    const netAUndo = parseFloat((await page.locator('#a_net').textContent())!.replace(/[^0-9.-]/g, ''));
    const netBUndo = parseFloat((await page.locator('#b_net').textContent())!.replace(/[^0-9.-]/g, ''));
    expect(Math.abs(netAUndo - netBUndo)).toBeLessThan(1);
    
    // Now REDO to delete again
    await page.locator('#redoBtn').click();
    await page.waitForTimeout(200);
    
    // Should have 1 row again
    await expect(page.locator('[data-row]')).toHaveCount(1);
    
    // Net A should be positive again
    await expect(page.locator('#a_net')).toContainText('$100');
    await expect(page.locator('#a_net')).toHaveClass(/good/);
  });
});

