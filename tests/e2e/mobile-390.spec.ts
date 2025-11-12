import { test, expect } from './setup.compact';

test.describe('Mobile Mode at 390×780', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/index.html');
  });

  test('displays wager row above Totals card without horizontal scroll', async ({ page }) => {
    // Check no horizontal scroll on body
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5); // Allow small margin
    
    // Check that first row is visible
    const row = page.locator('[data-row]').first();
    await expect(row).toBeVisible();
    
    // Check that condensed totals card is visible
    const condensedTotals = page.locator('.condensed-totals');
    await expect(condensedTotals).toBeVisible();
    
    // Verify wager row is above the condensed totals
    const rowBox = await row.boundingBox();
    const totalsBox = await condensedTotals.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(totalsBox).not.toBeNull();
    if(rowBox && totalsBox) {
      expect(rowBox.y).toBeLessThan(totalsBox.y);
    }
  });

  test('main wager fields fit on one line without horizontal scroll', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    
    // Check that main row fields are visible
    await expect(row.locator('.side')).toBeVisible();
    await expect(row.locator('.odds')).toBeVisible();
    await expect(row.locator('.stake')).toBeVisible();
    await expect(row.locator('.payout')).toBeVisible();
    await expect(row.locator('.profit')).toBeVisible();
    
    // Check that action buttons are visible
    await expect(row.locator('.more-toggle-btn')).toBeVisible();
    await expect(row.locator('.copy-row-btn')).toBeVisible();
    await expect(row.locator('.clear-btn')).toBeVisible();
    await expect(row.locator('.delete-btn')).toBeVisible();
    
    // Verify no wrapping causes hidden inputs
    const oddsInput = row.locator('.odds');
    const oddsBox = await oddsInput.boundingBox();
    expect(oddsBox).not.toBeNull();
    if(oddsBox) {
      expect(oddsBox.width).toBeGreaterThan(0);
      expect(oddsBox.height).toBeGreaterThan(0);
    }
  });

  test('Type and Sportsbook are collapsed by default with aria-hidden and tabindex=-1', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const secondary = row.locator('.row-secondary');
    const moreBtn = row.locator('.more-toggle-btn');
    
    // Initially collapsed
    await expect(secondary).not.toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(secondary).toHaveAttribute('aria-hidden', 'true');
    
    // Type and Sportsbook should have tabindex=-1 and aria-hidden when collapsed
    const typeSelect = row.locator('.type-select');
    const sportsbook = row.locator('.sportsbook');
    await expect(typeSelect).toHaveAttribute('tabindex', '-1');
    await expect(typeSelect).toHaveAttribute('aria-hidden', 'true');
    await expect(sportsbook).toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).toHaveAttribute('aria-hidden', 'true');
  });

  test('More toggle expands Type and Sportsbook, removes tabindex restrictions', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    const secondary = row.locator('.row-secondary');
    const typeSelect = row.locator('.type-select');
    const sportsbook = row.locator('.sportsbook');
    
    // Click More button
    await moreBtn.click();
    
    // Should expand
    await expect(secondary).toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(moreBtn).toHaveClass(/active/);
    await expect(secondary).toHaveAttribute('aria-hidden', 'false');
    
    // Fields should be accessible now (no tabindex=-1 or aria-hidden)
    await expect(typeSelect).not.toHaveAttribute('tabindex', '-1');
    await expect(typeSelect).not.toHaveAttribute('aria-hidden', 'true');
    await expect(sportsbook).not.toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).not.toHaveAttribute('aria-hidden', 'true');
    
    // Click again to collapse
    await moreBtn.click();
    await expect(secondary).not.toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
    
    // Should be hidden again
    await expect(typeSelect).toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).toHaveAttribute('tabindex', '-1');
  });

  test('condensed Totals card displays all 4 metrics', async ({ page }) => {
    // Fill in some wagers
    const row = page.locator('[data-row]').first();
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');
    
    // Wait for recalc
    await page.waitForTimeout(300);
    
    // Check condensed totals are visible and populated
    await expect(page.locator('#condensed_total_stake')).toBeVisible();
    await expect(page.locator('#sum_total_profit')).toBeVisible();
    await expect(page.locator('#condensed_a_net')).toBeVisible();
    await expect(page.locator('#condensed_b_net')).toBeVisible();
    
    // Verify values are updated
    await expect(page.locator('#condensed_total_stake')).toContainText('$100.00');
    await expect(page.locator('#sum_total_profit')).toContainText('$100.00');
  });

  test('ProphetX (PX!) behaves identically at 390px', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    
    // Fill main fields
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');
    
    // Expand and set PX! sportsbook
    await moreBtn.click();
    await row.locator('.sportsbook').fill('PX!');
    
    // Wait for recalc
    await page.waitForTimeout(300);
    
    // Check no horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);
    
    // Profit should be 99 (1% fee)
    await expect(row.locator('.profit')).toContainText('$99.00');
    
    // Collapse More
    await moreBtn.click();
    
    // Layout should remain stable
    await expect(row.locator('.side')).toBeVisible();
    await expect(row.locator('.odds')).toBeVisible();
  });

  test('session summary strip is hidden on mobile, condensed totals shown', async ({ page }) => {
    const sessionSummary = page.locator('.session-summary');
    const condensedTotals = page.locator('.condensed-totals');
    
    // Session summary should be hidden on mobile
    await expect(sessionSummary).toBeHidden();
    
    // Condensed totals should be visible
    await expect(condensedTotals).toBeVisible();
  });

  test('visual snapshot at 390×780', async ({ page }) => {
    // Fill with extreme values to test field widths
    const row1 = page.locator('[data-row]').first();
    await row1.locator('.side').fill('1');
    await row1.locator('.odds').fill('+9999');
    await row1.locator('.stake').fill('99999.99');

    // Wait for calculations
    await page.waitForTimeout(300);

    // Take snapshot
    await expect(page).toHaveScreenshot('mobile-390.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Cover & Equalize section may be below fold but accessible', async ({ page }) => {
    // The Cover & Equalize section is in the aside, which should be accessible
    // even if it requires scrolling
    const aside = page.locator('aside');
    
    // It should exist in the DOM
    await expect(aside).toBeAttached();
    
    // Scroll to it
    await aside.scrollIntoViewIfNeeded();
    
    // Now it should be visible
    await expect(aside).toBeVisible();
  });

  test('native details element works for helper text', async ({ page }) => {
    const helperDetails = page.locator('#helperDetails');
    
    // Initially closed
    const isOpen = await helperDetails.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpen).toBe(false);
    
    // Click to open
    await helperDetails.locator('summary').click();
    
    // Should be open now
    const isOpenAfter = await helperDetails.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpenAfter).toBe(true);
    
    // Content should be visible
    await expect(helperDetails).toContainText('Accept:');
    await expect(helperDetails).toContainText('Parse:');
  });

  test('all wager row fields have proper heights at mobile size', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    
    // Fill fields to make them active
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');
    
    // Check input heights are approximately 32px
    const sideHeight = await row.locator('.side').evaluate((el: HTMLElement) => el.offsetHeight);
    const oddsHeight = await row.locator('.odds').evaluate((el: HTMLElement) => el.offsetHeight);
    const stakeHeight = await row.locator('.stake').evaluate((el: HTMLElement) => el.offsetHeight);
    
    expect(sideHeight).toBeGreaterThanOrEqual(28);
    expect(sideHeight).toBeLessThanOrEqual(36);
    expect(oddsHeight).toBeGreaterThanOrEqual(28);
    expect(oddsHeight).toBeLessThanOrEqual(36);
    expect(stakeHeight).toBeGreaterThanOrEqual(28);
    expect(stakeHeight).toBeLessThanOrEqual(36);
  });
});
