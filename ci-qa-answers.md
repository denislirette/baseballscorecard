# CI/QA Setup — Answers

## Technical Setup

**Are you using GitHub for the repo, and do you already have GitHub Actions set up, or would this be the first workflow?**

Yes, using GitHub (denislirette/baseballscorecard). One workflow already exists: `.github/workflows/deploy-docs.yml` which deploys VitePress docs to GitHub Pages on push to master. A CI/QA workflow would be a new addition alongside it.

**What's your current build process? Is it vanilla JS/HTML/CSS served statically, or is there a build step (bundler, static site generator)?**

Vanilla JS/HTML/CSS with Vite as the dev server and build tool. `vite build` produces static output with multiple HTML entry points (index, game, guide, standings, contact, about, disclaimer, releases). Deployed to Netlify via `netlify.toml`. Only devDependencies are Vite 6.0.0 and VitePress 1.6.4 — no framework, no transpilation.

**For the SVG scorecards, are they generated client-side in the browser, or is there a build/render step that produces them as files?**

Entirely client-side. `svg-renderer.js` builds the SVG scorecard DOM in the browser from live MLB API data (or dev fixtures). There is no server-side or build-time rendering step — the SVGs exist only in the browser DOM.

## Testing Baseline

**Do you have any tests at all right now (unit tests, linting, anything), or are we starting from zero on the automated testing front?**

Starting from zero. No test files, no ESLint config, no linting, no CI checks. The only automated process is the docs deploy workflow.

**For visual regression, you'd need baseline screenshots to compare against. Are you comfortable with the idea of approving an initial set of "golden" screenshots that future changes get compared to?**

Yes — a fixture-based approach is already in place. Dev mode (`?dev` URL param) loads from `/fixtures/` with a known test game (LAA @ TOR, July 4 2025, gamePk 777242, 10 innings, 4-3 walkoff). This deterministic data makes golden screenshots reproducible.

## Practical Constraints

**Are you open to adding dev dependencies to the project (like Playwright for browser testing, axe-core for accessibility scanning, ESLint for code quality), or do you want to keep the dependency footprint minimal?**

Currently minimal (just Vite + VitePress). Adding Playwright, axe-core, and ESLint as devDependencies is reasonable — they don't affect the production bundle and the project already uses npm.

**Budget-wise, are you okay with free/open-source tooling only, or would you consider paid services for things like cross-browser cloud testing (BrowserStack, etc.)?**

Free/open-source is the baseline. GitHub Actions free tier (2,000 min/month) covers CI. Playwright handles Chromium/Firefox/WebKit locally. Paid services like BrowserStack would only be worth considering later for real-device mobile testing if the free tooling proves insufficient.
