# Origin Story

## How it started

BaseballScorecard.org began in March 2026 as an experiment: could a designer who loves baseball build a digital scorecard that feels like the real thing?

The idea came from a simple observation. Paper scorecards tell the story of a baseball game in a way that no box score or highlight reel can. Every pitch, every ground ball, every stolen base — it's all there, captured in symbols and numbers on a single sheet. But keeping score by hand requires being at the game (or watching live), and the learning curve can be steep for newcomers.

What if there was a way to render a traditional scorecard automatically, using live MLB data, so anyone could see what a scored game looks like — and learn to read one in the process?

## How it was built

The entire project was built collaboratively between Denis Lirette (designer) and Claude (Anthropic's AI assistant). Every line of code, every design decision, every bug fix was a conversation.

The stack is intentionally simple: vanilla JavaScript, no framework, ES modules, Vite for development, and Netlify for hosting. The data comes from the MLB Stats API (the GUMBO feed), which is free, requires no authentication, and has no CORS restrictions.

## The design philosophy

The scorecard follows the Bob Carpenter scorebook layout, adapted for screens. The design system prioritizes:

- **Clarity over decoration**: no drop shadows, no rounded corners, no gradients. Square borders, left-aligned data, and consistent spacing.
- **Accessibility**: WCAG AA contrast ratios, keyboard navigation, screen reader support, skip-to-content links.
- **Consistency**: every table, every border, every indicator icon follows the same rules everywhere. If something looks different from the rest of the site, it's a bug.
- **Educational purpose**: team logos are displayed to help users identify teams while learning to read scorecards. All logos are the trademark and property of their respective owners.

## Timeline

| Date | Version | Milestone |
|------|---------|-----------|
| March 2026 | v0.1 | First scorecard render — fixtures, grid, basic pitch sequences |
| March 2026 | v0.5 | Diamond rendering with base paths, runner annotations |
| March 2026 | v0.7 | Pitcher stats, game header, standings, schedule page |
| March 2026 | v0.8 | Team logos, pitch arsenals, auto-refresh redesign, SEO |
| March 2026 | v0.9 | Substitution line redesign, DP fix, scored diamond hatching |

## What's next

The project is ongoing. Every game day brings new edge cases, new plays to handle, and new opportunities to improve the rendering. This wiki will continue to grow as the system evolves.
