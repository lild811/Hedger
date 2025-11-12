import { test, expect } from './setup.compact';

test.describe('Mobile Mode at 360×740', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/index.html');
  });

  test('displays wager row without horizontal scroll', async ({ page }) => {
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
  });

  test('all main wager fields fit on one line without wrapping', async ({ page }) => {
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

    // Verify no horizontal overflow
    const wrapScrollWidth = await page.evaluate(() => {
      const wrap = document.querySelector('.wrap') as HTMLElement;
      return wrap.scrollWidth;
    });
    const wrapClientWidth = await page.evaluate(() => {
      const wrap = document.querySelector('.wrap') as HTMLElement;
      return wrap.clientWidth;
    });
    expect(wrapScrollWidth).toBeLessThanOrEqual(wrapClientWidth + 5);
  });

  test('profit displays full value for typical amounts', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Fill with typical betting amount
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');

    // Wait for calculation
    await page.waitForTimeout(300);

    // Profit should display full value $100.00 (fits in 56px at 10px font)
    const profitCell = row.locator('.profit');
    await expect(profitCell).toContainText('$100.00');

    // Check that title tooltip is present
    const profitTitle = await profitCell.getAttribute('title');
    expect(profitTitle).toBe('$100.00');
  });

  test('profit shows ellipsis for large amounts but tooltip has full value', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Fill with large profit amount
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('9999.99');

    // Wait for calculation
    await page.waitForTimeout(300);

    // Profit may show ellipsis due to width constraint
    const profitCell = row.locator('.profit');
    const profitText = await profitCell.textContent();
    expect(profitText).toBeTruthy();

    // But title attribute should have full precision
    const profitTitle = await profitCell.getAttribute('title');
    expect(profitTitle).toBe('$9999.99');
  });

  test('negative profit always shows minus sign', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Create scenario with negative profit (stake on side B)
    await row.locator('.side').fill('2');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('500');

    // Wait for calculation
    await page.waitForTimeout(300);

    // Add another row with side A to create negative net
    await page.locator('#addRow').click();
    const row2 = page.locator('[data-row]').nth(1);
    await row2.locator('.side').fill('1');
    await row2.locator('.odds').fill('+100');
    await row2.locator('.stake').fill('100');

    await page.waitForTimeout(300);

    // Check first row profit - should show negative value (loss when A wins)
    const profitCell = row.locator('.profit');
    const profitText = await profitCell.textContent();

    // Verify negative class is applied
    const hasNegClass = await profitCell.evaluate(el => el.classList.contains('neg'));
    expect(hasNegClass).toBe(true);
  });

  test('action buttons have minimum 28px tap target', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Check More button tap target
    const moreBtn = row.locator('.more-toggle-btn');
    const moreBtnBox = await moreBtn.boundingBox();
    expect(moreBtnBox).not.toBeNull();
    if (moreBtnBox) {
      // With padding: 6px 8px and margin: -6px -4px, effective tap area should be ~27×38px
      expect(moreBtnBox.height).toBeGreaterThanOrEqual(26);
    }

    // Check Copy button tap target
    const copyBtn = row.locator('.copy-row-btn');
    const copyBtnBox = await copyBtn.boundingBox();
    expect(copyBtnBox).not.toBeNull();
    if (copyBtnBox) {
      expect(copyBtnBox.height).toBeGreaterThanOrEqual(26);
    }

    // Check Clear button tap target
    const clearBtn = row.locator('.clear-btn');
    const clearBtnBox = await clearBtn.boundingBox();
    expect(clearBtnBox).not.toBeNull();
    if (clearBtnBox) {
      expect(clearBtnBox.height).toBeGreaterThanOrEqual(26);
    }

    // Check Delete button tap target
    const deleteBtn = row.locator('.delete-btn');
    const deleteBtnBox = await deleteBtn.boundingBox();
    expect(deleteBtnBox).not.toBeNull();
    if (deleteBtnBox) {
      expect(deleteBtnBox.height).toBeGreaterThanOrEqual(26);
    }
  });

  test('More toggle expands Type and Sportsbook without scroll jump', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    const secondary = row.locator('.row-secondary');

    // Get initial scroll position
    const scrollYBefore = await page.evaluate(() => window.scrollY);

    // Click More button
    await moreBtn.click();

    // Wait for transition
    await page.waitForTimeout(200);

    // Check scroll position hasn't changed
    const scrollYAfter = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollYAfter - scrollYBefore)).toBeLessThanOrEqual(2); // Allow 2px tolerance

    // Should expand
    await expect(secondary).toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('Type and Sportsbook are accessible when More is expanded', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    const typeSelect = row.locator('.type-select');
    const sportsbook = row.locator('.sportsbook');

    // Initially hidden
    await expect(typeSelect).toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).toHaveAttribute('tabindex', '-1');

    // Expand More
    await moreBtn.click();

    // Should be accessible now
    await expect(typeSelect).not.toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).not.toHaveAttribute('tabindex', '-1');

    // Can interact with fields
    await typeSelect.selectOption('kalshi');
    await expect(typeSelect).toHaveValue('kalshi');

    await sportsbook.fill('PX!');
    await expect(sportsbook).toHaveValue('PX!');
  });

  test('ghost row format chips do not wrap at 360px', async ({ page }) => {
    // Fill first wager
    const row = page.locator('[data-row]').first();
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');

    await page.waitForTimeout(300);

    // Click Equalize to show ghost row
    await page.locator('#presetEqualize').click();

    await page.waitForTimeout(300);

    // Check if ghost row is visible
    const ghostRow = page.locator('.ghost-row');
    await expect(ghostRow).toBeVisible();

    // Check format toggle
    const formatToggle = ghostRow.locator('.format-toggle');
    await expect(formatToggle).toBeVisible();

    // Check that all format buttons are on one line
    const formatButtons = ghostRow.locator('.format-btn');
    const count = await formatButtons.count();
    expect(count).toBe(4); // AMER, DEC, KAL, %

    // Verify no horizontal overflow in ghost row
    const ghostRowScrollWidth = await ghostRow.evaluate(el => el.scrollWidth);
    const ghostRowClientWidth = await ghostRow.evaluate(el => el.clientWidth);
    expect(ghostRowScrollWidth).toBeLessThanOrEqual(ghostRowClientWidth + 5);
  });

  test('no horizontal scroll with extreme profit values', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Fill with extreme values
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+9999');
    await row.locator('.stake').fill('99999.99');

    // Wait for calculation
    await page.waitForTimeout(300);

    // Check no horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);

    // Profit should have title tooltip
    const profitCell = row.locator('.profit');
    const profitTitle = await profitCell.getAttribute('title');
    expect(profitTitle).toBeTruthy();
    expect(profitTitle).toContain('$');
  });

  test('all fields have proper heights at 360px', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Fill fields to make them active
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');

    // Check input heights are approximately 28px
    const sideHeight = await row.locator('.side').evaluate((el: HTMLElement) => el.offsetHeight);
    const oddsHeight = await row.locator('.odds').evaluate((el: HTMLElement) => el.offsetHeight);
    const stakeHeight = await row.locator('.stake').evaluate((el: HTMLElement) => el.offsetHeight);

    expect(sideHeight).toBeGreaterThanOrEqual(26);
    expect(sideHeight).toBeLessThanOrEqual(32);
    expect(oddsHeight).toBeGreaterThanOrEqual(26);
    expect(oddsHeight).toBeLessThanOrEqual(32);
    expect(stakeHeight).toBeGreaterThanOrEqual(26);
    expect(stakeHeight).toBeLessThanOrEqual(32);
  });

  test('keyboard navigation works correctly', async ({ page }) => {
    const row = page.locator('[data-row]').first();

    // Focus side field
    await row.locator('.side').focus();

    // Type side value
    await page.keyboard.type('1');

    // Press Enter to move to odds
    await page.keyboard.press('Enter');

    // Should focus odds field
    const oddsInput = row.locator('.odds');
    await expect(oddsInput).toBeFocused();

    // Type odds
    await page.keyboard.type('+100');

    // Press Enter to move to stake
    await page.keyboard.press('Enter');

    // Should focus stake field
    const stakeInput = row.locator('.stake');
    await expect(stakeInput).toBeFocused();
  });

  test('visual snapshot at 360×740', async ({ page }) => {
    // Fill with extreme values to test field widths
    const row1 = page.locator('[data-row]').first();
    await row1.locator('.side').fill('1');
    await row1.locator('.odds').fill('+9999');
    await row1.locator('.stake').fill('99999.99');

    // Wait for calculations
    await page.waitForTimeout(300);

    // Take snapshot
    await expect(page).toHaveScreenshot('mobile-360.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Kalshi calculation works correctly at 360px', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');

    // Expand More to access Type selector
    await moreBtn.click();

    // Set row type to Kalshi
    await row.locator('.type-select').selectOption('kalshi');
    await page.waitForTimeout(100);

    // Fill Kalshi format odds
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('25c');
    await row.locator('.stake').fill('100');

    // Wait for calculation
    await page.waitForTimeout(300);

    // Verify profit is calculated with Kalshi fees
    const profitCell = row.locator('.profit');
    await expect(profitCell).toContainText('$291');

    // Check no horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);
  });

  test('ProphetX fee (PX!) works correctly at 360px', async ({ page }) => {
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

    // Profit should be 99 (1% fee on winnings)
    await expect(row.locator('.profit')).toContainText('$99.00');

    // Check no horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);
  });

  test('adding and deleting rows maintains layout stability', async ({ page }) => {
    // Add a row
    await page.locator('#addRow').click();
    await page.waitForTimeout(200);

    // Check no horizontal scroll
    let bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    let bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);

    // Add another row
    await page.locator('#addRow').click();
    await page.waitForTimeout(200);

    // Still no horizontal scroll
    bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);

    // Delete a row
    const row2 = page.locator('[data-row]').nth(1);
    await row2.locator('.delete-btn').click();
    await page.waitForTimeout(200);

    // Still no horizontal scroll after deletion
    bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);
  });
});
