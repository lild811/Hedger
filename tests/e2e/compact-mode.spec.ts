import { test, expect } from './setup.compact';

test.describe('Compact Mode at 430px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 800 });
    await page.goto('/index.html');
  });

  test('displays all main fields without horizontal scrolling', async ({ page }) => {
    // Check that main row fields are visible
    const row = page.locator('[data-row]').first();
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
    
    // Check no horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5); // Allow small margin
  });

  test('More button toggles Type and Sportsbook fields', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    const secondary = row.locator('.row-secondary');
    
    // Initially collapsed
    await expect(secondary).not.toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
    
    // Type and Sportsbook should be hidden from accessibility
    const typeSelect = row.locator('.type-select');
    const sportsbook = row.locator('.sportsbook');
    await expect(typeSelect).toHaveAttribute('tabindex', '-1');
    await expect(typeSelect).toHaveAttribute('aria-hidden', 'true');
    await expect(sportsbook).toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).toHaveAttribute('aria-hidden', 'true');
    
    // Click More button
    await moreBtn.click();
    
    // Should expand
    await expect(secondary).toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(moreBtn).toHaveClass(/active/);
    
    // Fields should be accessible now
    await expect(typeSelect).not.toHaveAttribute('tabindex', '-1');
    await expect(typeSelect).not.toHaveAttribute('aria-hidden', 'true');
    await expect(sportsbook).not.toHaveAttribute('tabindex', '-1');
    await expect(sportsbook).not.toHaveAttribute('aria-hidden', 'true');
    
    // Click again to collapse
    await moreBtn.click();
    await expect(secondary).not.toHaveClass(/expanded/);
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('can change Type when More is expanded', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    const typeSelect = row.locator('.type-select');
    
    // Expand secondary fields
    await moreBtn.click();
    
    // Should be able to select Kalshi YES
    await typeSelect.selectOption('kalshi-yes');
    await expect(typeSelect).toHaveValue('kalshi-yes');
  });

  test('can enter Sportsbook when More is expanded', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    const sportsbook = row.locator('.sportsbook');
    
    // Expand secondary fields
    await moreBtn.click();
    
    // Should be able to fill sportsbook
    await sportsbook.fill('PX!');
    await expect(sportsbook).toHaveValue('PX!');
  });

  test('calculations work with expanded Type/Sportsbook', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    const moreBtn = row.locator('.more-toggle-btn');
    
    // Fill main fields
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+100');
    await row.locator('.stake').fill('100');
    
    // Check profit without fees
    await expect(row.locator('.profit')).toContainText('$100.00');
    
    // Expand and set PX! fee
    await moreBtn.click();
    await row.locator('.sportsbook').fill('PX!');
    
    // Wait for recalc
    await page.waitForTimeout(300);
    
    // Profit should be 99 (1% fee)
    await expect(row.locator('.profit')).toContainText('$99.00');
  });

  test('Helper text toggle works', async ({ page }) => {
    const helperToggle = page.locator('#helperToggle');
    const helperContent = page.locator('#helperContent');
    const helperIcon = page.locator('#helperToggleIcon');
    
    // Initially collapsed
    await expect(helperContent).not.toHaveClass(/expanded/);
    await expect(helperToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(helperContent).toHaveAttribute('aria-hidden', 'true');
    await expect(helperIcon).toContainText('▼');
    
    // Click to expand
    await helperToggle.click();
    
    await expect(helperContent).toHaveClass(/expanded/);
    await expect(helperToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(helperContent).toHaveAttribute('aria-hidden', 'false');
    await expect(helperIcon).toContainText('▲');
    
    // Should show help content
    await expect(helperContent).toContainText('Accept:');
    await expect(helperContent).toContainText('Parse:');
    await expect(helperContent).toContainText('Kalshi:');
  });

  test('visual snapshot at 430px', async ({ page }) => {
    // Fill in a complete wager
    const row = page.locator('[data-row]').first();
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+150');
    await row.locator('.stake').fill('100');
    
    // Take snapshot
    await expect(page).toHaveScreenshot('compact-430px.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('visual snapshot with More expanded', async ({ page }) => {
    // Fill in a complete wager
    const row = page.locator('[data-row]').first();
    await row.locator('.side').fill('1');
    await row.locator('.odds').fill('+150');
    await row.locator('.stake').fill('100');
    
    // Expand More
    await row.locator('.more-toggle-btn').click();
    
    // Fill secondary fields
    await row.locator('.sportsbook').fill('DraftKings');
    await row.locator('.type-select').selectOption('normal');
    
    // Take snapshot
    await expect(page).toHaveScreenshot('compact-430px-expanded.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('all fields have proper aria-labels', async ({ page }) => {
    const row = page.locator('[data-row]').first();
    
    // Check main fields
    await expect(row.locator('.side')).toHaveAttribute('aria-label', 'Side (1 or 2)');
    await expect(row.locator('.odds')).toHaveAttribute('aria-label', 'Odds');
    await expect(row.locator('.stake')).toHaveAttribute('aria-label', 'Stake amount');
    await expect(row.locator('.payout')).toHaveAttribute('aria-label', 'Payout amount');
    await expect(row.locator('.profit')).toHaveAttribute('aria-label', 'Profit');
    
    // Check buttons
    await expect(row.locator('.more-toggle-btn')).toHaveAttribute('aria-label');
    await expect(row.locator('.copy-row-btn')).toHaveAttribute('aria-label', 'Copy row');
    await expect(row.locator('.clear-btn')).toHaveAttribute('aria-label', 'Clear stake');
    await expect(row.locator('.delete-btn')).toHaveAttribute('aria-label', 'Delete row');
    await expect(row.locator('.sign-toggle')).toHaveAttribute('aria-label', 'Toggle odds sign');
    
    // Expand and check secondary fields
    await row.locator('.more-toggle-btn').click();
    await expect(row.locator('.type-select')).toHaveAttribute('aria-label', 'Row type');
    await expect(row.locator('.sportsbook')).toHaveAttribute('aria-label', 'Sportsbook');
  });
});
