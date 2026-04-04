import { test, expect } from '@playwright/test';

/**
 * Visual regression tests — screenshot comparison at three viewports.
 *
 * Captures full-page screenshots for every entry point at desktop (1440px),
 * tablet (768px), and mobile (375px). Compares against committed golden
 * baselines in /tests/screenshots/{browser}/.
 *
 * To update goldens after intentional changes:
 *   npm run test:visual:update
 */

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

// Pages to screenshot. Game page uses ?dev for deterministic fixture data.
const PAGES = [
  { name: 'home',            path: '/' },
  { name: 'game',            path: '/game.html?dev&gamePk=777242' },
  { name: 'guide',           path: '/guide.html' },
  { name: 'standings',       path: '/standings.html' },
  { name: 'contact',         path: '/contact.html' },
  { name: 'contact-success', path: '/contact-success.html' },
  { name: 'about',           path: '/about.html' },
  { name: 'accessibility',   path: '/accessibility.html' },
  { name: 'disclaimer',      path: '/disclaimer.html' },
  { name: 'examples',        path: '/examples.html' },
];

for (const pg of PAGES) {
  for (const vp of VIEWPORTS) {
    test(`${pg.name} — ${vp.name} (${vp.width}px)`, async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto(pg.path);

      // For the game page, wait for SVG scorecard to fully render
      if (pg.path.includes('game.html')) {
        await page.waitForSelector('.scorecard-section svg', { timeout: 30000 });
        // Let dynamic rendering settle
        await page.waitForTimeout(1000);
      }

      // Wait for network idle (images, fonts, API calls)
      await page.waitForLoadState('networkidle');

      // Full-page screenshot comparison against golden baseline
      await expect(page).toHaveScreenshot(`${pg.name}-${vp.name}.png`, {
        fullPage: true,
      });
    });
  }
}
