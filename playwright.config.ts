import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { 
    headless: true,
    baseURL: 'http://localhost:5173'
  },
  projects: [
    {
      name: 'compact',
      use: {
        viewport: { width: 390, height: 844 }
      }
    }
  ],
  webServer: {
    command: 'npx http-server . -p 5173 -c-1',
    url: 'http://localhost:5173/index.html',
    reuseExistingServer: !process.env.CI
  }
});
