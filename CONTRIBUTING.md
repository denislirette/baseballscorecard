# Contributing

Thanks for wanting to help out. This project started as a personal thing and I'm still figuring out the open source side, so bear with me.

## Getting set up

1. Fork the repo
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Start the dev server: `npm run dev`
5. Open `http://localhost:5173`

Use `?dev=true` on any page URL to load from fixture files instead of hitting the MLB API.

## How to contribute

### Found a bug?

Open an issue. Include:
- What you expected to happen
- What actually happened
- The game/date you were looking at (if relevant)
- Browser and OS

Screenshots are really helpful, especially for rendering issues.

### Want to fix something?

1. Check the [issues](https://github.com/denislirette/baseball-scorebook/issues) to see if someone's already on it
2. Create a branch off `master` (`git checkout -b fix/your-fix-name`)
3. Make your changes
4. Test against the reference game fixture (`fixtures/2025-07-04-LAA-TOR.json` with `?dev=true`)
5. Open a pull request

### Want to add a feature?

Open an issue first so we can talk about it. This keeps the project focused and saves you from building something that might not fit.

## What would actually help right now

- **Parser improvements** — The scoring notation parser (`js/game-data.js`) handles most cases but there are edge cases in baseball that are genuinely weird. If you find a game where the notation is wrong, that's a great issue to file.
- **Mobile layout** — The scorecards are wide. Making them work better on phones would be great.
- **Accessibility** — The SVG scorecards could use better aria labels and keyboard navigation.
- **More test fixtures** — Saving interesting game fixtures (extra innings, no-hitters, position players pitching) helps catch rendering bugs.

## Code style

There's no linter or formatter set up yet. Just try to match what's already there:
- Vanilla JavaScript, no framework
- SVG elements created via DOM manipulation (not string concatenation)
- Keep functions focused — the codebase is already pretty readable, let's keep it that way

## Testing

There's no automated test suite yet (it's on the list). For now, testing means:
1. Load the dev server with `?dev=true`
2. Compare your rendered output against [livebaseballscorecards.com](https://livebaseballscorecards.com) for the same game
3. Check pitch sequences, play notation, runner paths, and substitution indicators

## Pull request guidelines

- Keep PRs focused — one thing per PR
- Describe what you changed and why
- If it's a visual change, include before/after screenshots
- Don't worry about being perfect. If the direction is right, we can iterate

## Be decent

This project has a [Code of Conduct](CODE_OF_CONDUCT.md). The short version: be kind, be patient, assume good intentions.
