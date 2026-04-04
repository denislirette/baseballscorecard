import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility tests — WCAG 2.2 AA compliance via axe-core.
 *
 * Visits every HTML entry point and runs a full axe scan.
 * The game page uses ?dev to load fixture data (no live API calls).
 * Zero tolerance: any AA violation fails the test.
 */

// All pages to test. Game page uses ?dev for deterministic fixture data.
const PAGES = [
  { name: 'Home (Schedule)', path: '/' },
  { name: 'Game (fixture)',  path: '/game.html?dev&gamePk=777242' },
  { name: 'Guide',           path: '/guide.html' },
  { name: 'Standings',       path: '/standings.html' },
  { name: 'Contact',         path: '/contact.html' },
  { name: 'Contact Success', path: '/contact-success.html' },
  { name: 'About',           path: '/about.html' },
  { name: 'Accessibility',   path: '/accessibility.html' },
  { name: 'Disclaimer',      path: '/disclaimer.html' },
  { name: 'Examples',        path: '/examples.html' },
];

for (const page of PAGES) {
  test(`${page.name} — WCAG 2.2 AA`, async ({ page: p }) => {
    await p.goto(page.path);

    // For the game page, wait for the SVG scorecard to render
    if (page.path.includes('game.html')) {
      await p.waitForSelector('.scorecard-section svg', { timeout: 30000 });
      // Give dynamic rendering a moment to settle
      await p.waitForTimeout(1000);
    }

    // Wait for page to be fully loaded and idle
    await p.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    // Build a readable failure message listing each violation
    const violations = results.violations.map(v => {
      const nodes = v.nodes.map(n => `    - ${n.html.substring(0, 120)}`).join('\n');
      return `[${v.impact}] ${v.id}: ${v.description}\n${nodes}`;
    }).join('\n\n');

    expect(
      results.violations.length,
      `Accessibility violations on "${page.name}":\n\n${violations}`
    ).toBe(0);
  });
}
