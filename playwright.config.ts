import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Optional local overrides (see .env.example). Node >= 20.12 provides loadEnvFile.
if (existsSync('.env')) process.loadEnvFile('.env');

const isCI = Boolean(process.env.CI);
const port = Number(process.env.PORT ?? 3100);
// Point BASE_URL at an already-running deployment to skip the local web server.
const externalBaseUrl = process.env.BASE_URL;
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${port}`;

const e2e = { testDir: './tests/e2e', dependencies: ['setup'] };

// Forward the demo-account overrides explicitly so the server seeds the same
// credentials the tests use, whether or not Playwright merges process.env.
const serverEnv: Record<string, string> = { PORT: String(port) };
for (const key of ['DEMO_USER_EMAIL', 'DEMO_USER_PASSWORD']) {
  const value = process.env[key];
  if (value) serverEnv[key] = value;
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  expect: { timeout: 7_000 },

  projects: [
    // Fast, browser-free layers.
    { name: 'unit', testDir: './tests/unit' },
    { name: 'api', testDir: './tests/api' },

    // Signs in once through the API and saves the session for read-only account tests.
    { name: 'setup', testDir: './tests/setup', testMatch: /.*\.setup\.ts/ },

    // Full end-to-end coverage on every desktop engine.
    { name: 'chromium', ...e2e, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', ...e2e, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', ...e2e, use: { ...devices['Desktop Safari'] } },

    // Critical journeys (tagged @smoke) on mobile viewports.
    { name: 'mobile-chrome', ...e2e, grep: /@smoke/, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', ...e2e, grep: /@smoke/, use: { ...devices['iPhone 15'] } },

    // Automated WCAG checks with axe-core.
    { name: 'accessibility', testDir: './tests/a11y', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'node app/server.mjs',
        url: `${baseURL}/api/health`,
        env: serverEnv,
        reuseExistingServer: !isCI,
        timeout: 30_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
