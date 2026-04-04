import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for BaseballScorecard.org QA pipeline.
 *
 * Runs accessibility (axe-core WCAG 2.2 AA) and visual regression tests
 * across Chromium, Firefox, and WebKit at three viewport widths.
 *
 * The Vite dev server starts automatically before tests and shuts down after.
 */
export default defineConfig({
  // Test file locations
  testDir: './tests',

  // Fail the build on any test.only left in source
  forbidOnly: !!process.env.CI,

  // Retry once in CI to handle flaky browser startup
  retries: process.env.CI ? 1 : 0,

  // Run tests in parallel — one worker per CPU core
  workers: process.env.CI ? 2 : undefined,

  // HTML reporter for CI artifact upload, plus console output
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }], ['list']],

  // Shared settings for all projects
  use: {
    // Base URL — Vite dev server started below
    baseURL: 'http://localhost:5173',

    // Capture screenshot/trace on failure for debugging
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  // Golden screenshot storage: tests/screenshots/{browser}/{name}.png
  snapshotPathTemplate: '{testDir}/screenshots/{projectName}/{arg}{ext}',

  // Visual regression screenshot comparison settings
  expect: {
    toHaveScreenshot: {
      // 1.5% pixel diff threshold — accounts for antialiasing and WebKit font rendering variance
      maxDiffPixelRatio: 0.015,
    },
  },

  // Three browser engines × three viewports = full cross-browser coverage
  projects: [
    // ── Chromium (Chrome/Edge) ──
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Firefox ──
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // ── WebKit (Safari) ──
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Start Vite dev server before tests, shut down after
  webServer: {
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    // Give the server up to 30s to start
    timeout: 30000,
  },
});
