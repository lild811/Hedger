import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/tests/e2e/**']
  }
});
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],  // only unit tests
    exclude: ['tests/e2e/**']              // keep Playwright files out of Vitest
  }
})
