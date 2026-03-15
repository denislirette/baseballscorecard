# Contributing

Thanks for wanting to help out. This project started as a personal thing and I'm still figuring out the open source side, so bear with me.

## Getting set up

### 1. Fork the repository

Click the "Fork" button on the [GitHub repo page](https://github.com/denislirette/baseballscorebook). This creates your own copy under your GitHub account.

### 2. Clone your fork locally

```bash
git clone https://github.com/YOUR_USERNAME/baseballscorebook.git
cd baseballscorebook
npm install
```

You need [Node.js](https://nodejs.org/) (v18 or later) installed.

### 3. Start the dev server

```bash
npm run dev
```

Open `http://localhost:5173`. Add `?dev` to any page URL to load from saved fixture files instead of hitting the live MLB API. This is how most development happens.

### 4. Create a branch

Always work on a branch, never directly on `master`. Name it after what you're doing:

```bash
git checkout -b fix/strikeout-notation
git checkout -b feature/pitcher-arsenal-overlay
```

### 5. Make your changes

The dev server auto-reloads when you save files. Test against the reference game fixture (`fixtures/2025-07-04-LAA-TOR.json` with `?dev`) to make sure nothing breaks.

### 6. Commit your work

Write commit messages that describe what changed and why:

```
Fix double play notation rendering for 6-4-3
Add wRC+ badge to batter name cells
Handle postponed game status in schedule fetch
```

Small, focused commits are easier to review than one giant commit.

### 7. Push and open a pull request

```bash
git push origin fix/strikeout-notation
```

Go to the original repo on GitHub. You'll see a prompt to open a pull request from your branch. Write a short description of what your changes do, and submit.

## How to contribute

### Found a bug?

Open an issue. Include:
- What you expected to happen
- What actually happened
- The game/date you were looking at (if relevant)
- Browser and OS

Screenshots are really helpful, especially for rendering issues. Game-specific bugs are common because the MLB API returns slightly different data structures depending on the play type, so including the specific game helps reproduce the issue.

### Want to fix something?

1. Check the [issues](https://github.com/denislirette/baseballscorebook/issues) to see if someone's already on it
2. If there's no issue yet, open one first so we can discuss the approach
3. Follow the setup steps above, make your fix, and open a PR

### Want to add a feature?

Open an issue first so we can talk about it. This keeps the project focused and saves you from building something that might not fit.

## What would actually help right now

- **Parser improvements.** The scoring notation parser (`js/game-data.js`) handles most cases but there are edge cases in baseball that are genuinely weird. If you find a game where the notation is wrong, that's a great issue to file.
- **Mobile layout.** The scorecards are wide. Making them work better on phones would be great.
- **Accessibility.** The SVG scorecards could use better aria labels and keyboard navigation.
- **More test fixtures.** Saving interesting game fixtures (extra innings, no-hitters, position players pitching) helps catch rendering bugs.

## Code guidelines

**No dependencies without discussion.** The project intentionally avoids frameworks. If you think a library is necessary, open an issue to discuss it first.

**SVG rendering uses DOM manipulation.** Not string concatenation. All scorecard cells are built programmatically in `js/svg-renderer.js`.

**Keep functions focused.** Each function should do one thing. If it's getting long, it probably needs to be split up.

**Name things clearly.** `parseAtBatResult()` is better than `processData()`. `renderRunnerPath()` is better than `drawLine()`.

There's no linter or formatter set up yet. Just try to match what's already there.

## Testing

There's no automated test suite yet (it's on the list). For now testing means:
1. Load the dev server with `?dev`
2. Compare your rendered output against [livebaseballscorecards.com](https://livebaseballscorecards.com) for the same game
3. Check pitch sequences, play notation, runner paths, and substitution indicators

The [TECHNICAL-REFERENCE.md](TECHNICAL-REFERENCE.md) has detailed docs on the data structures, scoring rules, and rendering logic. The [NOTES.md](NOTES.md) has development history and the current to-do list.

## Pull request guidelines

- Keep PRs focused: one thing per PR, not five things bundled together
- A clear title that says what changed, and a description that explains why
- If it's a visual change, include before/after screenshots
- Don't worry about being perfect. If the direction is right, we can iterate

## Questions

Open an issue tagged `question` or start a [discussion](https://github.com/denislirette/baseballscorebook/discussions). No contribution is too small, and asking before building saves everyone time.

## Be decent

This project has a [Code of Conduct](CODE_OF_CONDUCT.md). The short version: be kind, be patient, assume good intentions.
