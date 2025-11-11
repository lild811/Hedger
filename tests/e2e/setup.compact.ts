import { test as base, expect } from '@playwright/test';

// Extend the test to set compact mode via localStorage before navigation
export const test = base.extend({
  page: async ({ page }, use) => {
    // Add init script to set compact mode before page loads
    await page.addInitScript(() => {
      localStorage.setItem('uiMode', 'compact');
    });
    await use(page);
  },
});

export { expect };
