import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file before tests run.
dotenv.config();

/**
 * Playwright configuration for the Guru99 Banking automation portfolio.
 * See https://playwright.dev/docs/test-configuration
 */
const isCI = !!(globalThis as any).process?.env?.CI;

export default defineConfig({
  testDir: './tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in source. */
  forbidOnly: isCI,

  /* Retry once on CI, never locally (failures should be investigated, not hidden). */
  retries: isCI ? 1 : 0,

  /* One worker on CI for predictable runs; unlimited locally for speed. */
  workers: isCI ? 1 : undefined,

  /* HTML report opens automatically after a run. */
  reporter: [['html', { open: 'never' }]],

  /* Shared settings applied to every test. */
  use: {
    /* Base URL: tests can use page.goto('/') instead of the full URL. */
    baseURL: (globalThis as any).process?.env?.GURU99_BASE_URL,

    /* Capture a screenshot on every test step (for portfolio demo storytelling). */
    screenshot: 'on',

    /* Record a full trace on every test (for the portfolio's depth of evidence). */
    trace: 'on',

    /* Record video on first retry only — keeps storage reasonable. */
    video: 'retain-on-failure',
  },

  /* Run only on Chromium and Firefox. WebKit dropped:
     - Guru99 is an old site with rendering quirks on WebKit.
     - Triples test time without adding real client value. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
