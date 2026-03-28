# Origin Story

## How it started

Denis Lirette is a designer whose interests overlap in a few specific areas: AI and automation, Figma, MCP, data visualization, and integrations. He's also a nerd for baseball scorekeeping, the pencil-and-paper kind where you translate a whole game into symbols on a single sheet.

Paper scorecards tell the story of a baseball game in a way no box score or highlight reel can. Every pitch, every ground ball, every stolen base, all captured in symbols and numbers. But keeping score by hand requires being at the game or watching live, and the learning curve is steep for newcomers.

BaseballScorecard.org started in March 2026 as an experiment: could he build a digital scorecard that renders automatically from live MLB data, so anyone could see what a scored game looks like and learn to read one?

The project sits right at the intersection of his interests: baseball, design, data visualization, and AI tooling.

## How it was built

Denis handled the design side, working in Figma and making decisions about layout, typography, and visual language. Claude Code handled the back-end development, setting up the dev environment, and keeping release notes and GitHub organized.

The collaboration was genuine. Claude wasn't just autocompleting code. Design decisions came from Denis. Technical implementation, data transforms, API integration, and project infrastructure came from Claude. Every bug fix, every edge case, every rendering rule was a conversation between the two.

The tech stack is intentionally simple: Vite for development, vanilla JavaScript with ES modules (no framework), Netlify for hosting. The data comes from the MLB Stats API (the GUMBO feed), which is free, requires no authentication, and has no CORS restrictions.

The toolchain: Claude Code for development, Figma for design, GitHub for version control, GitBook for this wiki.

## The design philosophy

The scorecard follows the Bob Carpenter scorebook layout, adapted for screens. A few rules govern everything:

- **Clarity over decoration**: no drop shadows, no rounded corners, no gradients. Square borders, left-aligned data, consistent spacing.
- **Accessibility**: WCAG AA contrast ratios, keyboard navigation, screen reader support, skip-to-content links.
- **Consistency**: every table, every border, every indicator icon follows the same rules everywhere. If something looks different from the rest of the site, it's a bug.
- **Educational purpose**: team logos help users identify teams while learning to read scorecards. All logos are the trademark and property of their respective owners.

## Timeline

| When | Version | What happened |
|------|---------|---------------|
| Week 1 | v0.1 | First render. Fixtures, grid, [pitch sequences](pitch-sequences.md) |
| Week 1 | v0.5 | [Diamond](diamond.md) with base paths and runner annotations |
| Week 1 | v0.7 | Pitcher stats, game header, standings, schedule |
| Week 2 | v0.8 | Team logos, [pitch arsenals](pitch-sequences.md#pitch-arsenal), SEO |
| Week 2 | v0.9 | [Substitution](substitutions.md) redesign, [DP fix](diamond.md#out-markers), [hatch lines](diamond.md#scored-runner-hatch-lines) |
| Week 2 | v0.9.1 | GitBook wiki, rainbow loading bar |

## What's next

Every game day brings new edge cases. See [Known Issues](known-issues.md) for what's on the radar.
