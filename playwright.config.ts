import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const channel = process.env.PLAYWRIGHT_CHANNEL as 'chrome' | 'msedge' | 'chromium' | undefined;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:3100',
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Locally we usually run against the already-running server (PLAYWRIGHT_BASE_URL).
  // In CI the config starts its own instance on 3100.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm start -- -p 3100',
        url: 'http://127.0.0.1:3100/login',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
