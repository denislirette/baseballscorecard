# QA Pipeline

Automated quality checks that run on every pull request to `master`. All checks must pass before merge.

## Quick Start

```bash
# Run the full QA suite locally
npm run qa

# Or run individual checks
npm run lint            # ESLint — code quality + browser compat
npm run spellcheck      # cspell — spelling in HTML/JS/CSS/MD files
npm run test:a11y       # Accessibility — WCAG 2.2 AA via axe-core
npm run test:visual     # Visual regression — screenshot comparison
```

## Available Scripts

| Script | What it does |
|---|---|
| `npm run lint` | ESLint with browser compat checking (eslint-plugin-compat) |
| `npm run spellcheck` | Spell check all content files against baseball + project dictionary |
| `npm run test:a11y` | WCAG 2.2 AA accessibility scan on every page (Chromium, Firefox, WebKit) |
| `npm run test:visual` | Screenshot comparison at 1440/768/375px across all browsers |
| `npm run test:visual:update` | Regenerate golden baseline screenshots after intentional changes |
| `npm run qa` | Run all checks in sequence (lint, spellcheck, a11y, visual) |
| `npm test` | Alias for `npm run qa` |

## Updating Visual Baselines

When you make an intentional visual change (layout, colors, fonts):

```bash
npm run test:visual:update
```

This regenerates the golden screenshots in `tests/screenshots/`. Review the changes in your diff, then commit them alongside your code changes.

## Adding Baseball Terms

If the spellchecker flags a legitimate baseball term, add it to `cspell-baseball.txt` (one word per line).

## CI Workflow

The GitHub Actions workflow (`.github/workflows/qa.yml`) runs on every PR to `master`:

1. ESLint
2. Spellcheck
3. Accessibility tests (3 browsers)
4. Visual regression (3 browsers × 3 viewports × 10 pages)

On failure, Playwright reports and visual diff images are uploaded as artifacts — download them from the Actions tab to inspect.

## File Structure

```
tests/
  a11y/all-pages.spec.js        # Accessibility tests
  visual/all-pages.spec.js       # Visual regression tests
  screenshots/                   # Golden baselines (committed)
    chromium/                    #   Per-browser directories
    firefox/
    webkit/
playwright.config.js             # Playwright + webServer config
eslint.config.js                 # ESLint flat config
cspell.json                      # Spell checker config
cspell-baseball.txt              # Custom baseball dictionary
.github/workflows/qa.yml         # CI workflow
```
