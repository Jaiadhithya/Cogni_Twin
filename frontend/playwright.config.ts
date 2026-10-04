import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

/**
 * End-to-end tests run against a production build in Demo mode, so they need no backend.
 * Locally: `npx playwright test`. Set E2E_BASE_URL to test an already-running server instead.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    reducedMotion: 'no-preference',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_DIST_DIR: '.next-e2e' },
      },
});
