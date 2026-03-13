# BaseballScorebook.org

A web app that turns live MLB game data into traditional baseball scorecards, the kind you'd keep with a pencil at the ballpark, except it fills itself in automatically. Built with vanilla JavaScript and Vite, deployed on Netlify.

I love baseball and I love building things. I'm not a professional developer. I'm learning as I go, and this project is how I'm doing it. The idea started because I wanted a digital version of the scorecards I keep by hand, with some modern stats layered on top. It's inspired by [livebaseballscorecards.com](https://livebaseballscorecards.com) (Benjamin Crom's [baseball](https://github.com/benjamincrom/baseball) library), reimplemented from scratch as a client-side JavaScript app.

If you're into baseball, scorekeeping, data viz, or just want to tinker, contributions are welcome. I'd love help making this better. Just know that the codebase reflects someone learning in public, and that's kind of the point.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## What It Does

- **Traditional scorecard rendering:** SVG scorecards faithful to paper scorebook conventions: base diamonds, pitch sequences, fielding notation, runner tracking
- **Pitch detail:** 3-column pitch log (call code, pitch type, velocity) with colour-coded strike zone plot
- **Play notation:** Standard scoring notation (K, BB, 6-3, F8, DP643, etc.) parsed automatically from MLB's GUMBO feed
- **Runner tracking:** Cumulative runner journeys across at-bats within an inning, annotated outside the diamond
- **Substitution indicators:** Dashed lines for pitcher changes, solid lines for pinch hitters/runners, with circled sub numbers
- **Sabermetric overlays:** wRC+ and wOBA for batters, pitcher arsenal breakdowns (via FanGraphs data)
- **Light/dark theme:** WCAG AA compliant colour schemes
- **Auto-refresh:** Configurable polling (10–300s) for live games, stops automatically at final
- **WYSIWYG cell editor:** Visual tool for tuning cell layout constants with live preview

## Screenshot

<!-- TODO: Add a screenshot of a rendered scorecard here -->

## Quick Start

```bash
git clone https://github.com/denislirette/baseball-scorebook.git
cd baseball-scorebook
npm install
npm run dev
```

That's it. Open `http://localhost:5173`, pick a date, pick a game.

### Dev Mode

Add `?dev` to any URL to load from saved fixture files instead of hitting the MLB API. This is how most development and testing happens.

- Game picker: `http://localhost:5173/?dev`
- Scorecard: `http://localhost:5173/game.html?gamePk=777242&date=2025-07-04&dev`

### Build for Production

```bash
npm run build
npm run preview    # check the build locally
```

### Design Token Sync

```bash
npm run sync-tokens  # Sync design-tokens.json → CSS variables + layout config
npm run export-figma # Export tokens for Figma import
```

## How It Works

The app fetches the MLB's "GUMBO" live feed, one big JSON blob per game that has everything: lineups, every pitch, every play, every runner movement. A parser (`js/game-data.js`) chews through that and hands structured data to the SVG renderer (`js/svg-renderer.js`), which draws the scorecard cell by cell.

The MLB Stats API is free, requires no API key, and has no CORS restrictions, so game data is fetched directly from the browser.

```
MLB Stats API ──> game-data.js (parse) ──> svg-renderer.js (draw SVG)
```

### Key Design Decisions

- **No framework.** Vanilla JS + direct SVG DOM manipulation. The app is a rendering engine, not an interactive UI. Zero build complexity and full control over SVG output.
- **Client-side rendering.** The MLB Stats API has no CORS restrictions and requires no API key, so game data is fetched directly from the browser.
- **Single API call per game.** The GUMBO live feed returns the complete game state in one response.
- **Fixture-driven development.** Saved API responses in `fixtures/` allow offline iteration. Dev mode (`?dev` URL param) loads from fixtures instead of live endpoints.
- **Mutable layout config.** `layout-config.js` exposes a shared config object that the cell editor can update at runtime via a Vite dev plugin. Changes persist to disk.

### Project Structure

```
baseball-scorebook/
├── index.html              # Game picker: date nav, game grid
├── game.html               # Scorecard view: SVG rendering
├── cell-editor.html        # WYSIWYG cell layout editor
├── cell-reference.html     # Visual reference of all cell states
├── export-cells.html       # Export cell states as SVG for Figma
├── js/
│   ├── game-data.js        # GUMBO feed parser: lineups, play notation, runners
│   ├── svg-renderer.js     # SVG scorecard rendering: cells, grid, diamonds, pitches
│   ├── scorecard.js        # Page orchestrator: fetches data, triggers renders
│   ├── layout-config.js    # Mutable layout constants (COL_WIDTH, ROW_HEIGHT, etc.)
│   ├── api.js              # MLB Stats API client
│   ├── schedule.js         # Game picker logic
│   ├── refresh.js          # Auto-refresh controller
│   ├── theme.js            # Light/dark toggle
│   └── utils.js            # Date formatting, timezone helpers
├── css/
│   ├── style.css           # Main styles: CSS variables, responsive grid, dark mode
│   └── styles-editor.css   # Styles editor page styles
├── fixtures/               # Saved API responses for offline development
├── design-tokens.json      # Design tokens for Figma sync
├── netlify.toml            # Netlify build config
└── vite.config.js          # Vite config with dev-only layout/token save plugins
```

## Scorecard Cell Anatomy

Each at-bat cell contains:

```
┌──────────────────────────────┐
│ C FF 95  ┌────┐   RBI       │  ← pitch log (call, type, speed)
│ S SL 84  │zone│              │     + strike zone plot
│ F CU 78  │    │              │     + RBI indicator (green)
│ X SI 93  └────┘              │
│                              │
│          ◇ diamond           │  ← base paths coloured by outcome
│       (runners annotated     │     (black=advance, green=scored,
│        outside diamond)      │      red=out)
│                              │
│         6-3                  │  ← play result notation
│                              │
│ ┄┄┄┄┄┄┄┄┄┄ P-SUB ┄┄┄┄┄┄┄┄┄ │  ← substitution indicator (if any)
└──────────────────────────────┘
```

- **No diamond** is drawn when there are no runners; notation fills the space at a larger font size
- **K and backwards-K** render extra-large in the diamond area
- **Strikeout counter** (K1, K2, K3...) tracks starting pitcher Ks as subscripts

## Test Game

The primary QA reference game is **Los Angeles Angels at Toronto Blue Jays, July 4, 2025**, a 10-inning walkoff (4-3). The fixture is saved at `fixtures/2025-07-04-LAA-TOR.json`. Rendered output is compared cell-by-cell against [livebaseballscorecards.com](https://livebaseballscorecards.com) for the same game to verify accuracy.

## Deployment

Hosted on [Netlify](https://www.netlify.com/). Push to `main` and it builds and deploys automatically.

The build is configured in `netlify.toml`: just `npm run build` with the `dist/` directory published.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JavaScript |
| Rendering | SVG via DOM manipulation |
| Game data | [MLB Stats API](https://statsapi.mlb.com) (free, no key, no CORS) |
| Advanced stats | FanGraphs leaderboard data |
| Build | Vite |
| Hosting | Netlify |

No React, no Vue, no build-time magic. The app is basically a rendering engine: it takes data and draws pictures. A framework would just be in the way.

## Contributing

This is a passion project and I'm learning a lot, both about baseball scoring and web development. If you want to help, that's awesome. Whether it's fixing a rendering bug, improving the notation parser, adding a feature, or just cleaning something up, I appreciate it.

A few things to know:
- The codebase is vanilla JS on purpose. No React, no framework. That's a deliberate choice.
- The [TECHNICAL-REFERENCE.md](TECHNICAL-REFERENCE.md) has deep documentation on the data structures, scoring rules, and rendering logic.
- The [NOTES.md](NOTES.md) has development history and the current to-do list.
- Use the `?dev` URL param to work with fixture data instead of live API calls.

## License

[MIT](LICENSE)
