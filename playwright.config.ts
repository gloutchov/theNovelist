import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/electron-workflows.spec.ts', '**/performance.spec.ts'],
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  webServer: {
    command: 'node scripts/serve-static.mjs out/renderer 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
});
