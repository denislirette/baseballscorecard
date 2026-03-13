# Baseball Scorebook

A web app that turns live MLB game data into traditional baseball scorecards — the kind you'd keep with a pencil at the ballpark, except it fills itself in automatically.

Built because I wanted to follow games the old-school way without actually having good handwriting.

**[Live site](https://baseball-scorebook.vercel.app)** (hosted free on Vercel)

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## What it does

- Pulls live game data from the MLB Stats API and renders it as SVG scorecards
- Traditional scoring notation (K, BB, 6-3, F8, DP643 — the whole thing)
- Pitch-by-pitch detail: call, pitch type, velocity, plus a strike zone plot
- Runner tracking across at-bats within an inning
- Substitution indicators (pitcher changes, pinch hitters, defensive swaps)
- Sabermetric overlays — wRC+ and wOBA for batters, pitcher arsenal breakdowns (via FanGraphs)
- Auto-refresh for live games (configurable interval, stops at final)
- Light/dark theme
- A WYSIWYG cell editor for tweaking the scorecard layout

## Screenshot

<!-- TODO: Add a screenshot of a rendered scorecard here -->

## Quick start

```bash
git clone https://github.com/denislirette/baseball-scoreboard.git
cd baseball-scoreboard
npm install
npm run dev
```

That's it. Open `http://localhost:5173`, pick a date, pick a game.

### Dev mode

Add `?dev=true` to any URL to load from saved fixture files instead of hitting the MLB API. Useful for working on rendering without needing a live connection.

### Build for production

```bash
npm run build
npm run preview    # check the build locally
```

### Deploy

The app runs on Vercel's free tier. One serverless function (`/api/stats`) proxies FanGraphs data to get around CORS.

```bash
vercel --prod
```

## How it works

The app fetches the MLB's "GUMBO" live feed — one big JSON blob per game that has everything: lineups, every pitch, every play, every runner movement. A parser (`js/game-data.js`) chews through that and hands structured data to the SVG renderer (`js/svg-renderer.js`), which draws the scorecard cell by cell.

The MLB Stats API is free, requires no API key, and has no CORS restrictions, so game data is fetched directly from the browser. Only the FanGraphs advanced stats need a server-side proxy.

```
MLB Stats API ──> game-data.js (parse) ──> svg-renderer.js (draw SVG)
FanGraphs ──> /api/stats (proxy) ──> overlay on scorecard
```

### Project structure

```
baseball-scorebook/
├── index.html              # Game picker — date nav, game grid
├── game.html               # Scorecard view — SVG rendering
├── cell-editor.html        # WYSIWYG cell layout editor
├── cell-reference.html     # Visual reference of all cell states
├── js/
│   ├── game-data.js        # GUMBO feed parser
│   ├── svg-renderer.js     # SVG scorecard renderer
│   ├── scorecard.js        # Page orchestrator
│   ├── layout-config.js    # Layout constants (column width, row height, etc.)
│   ├── api.js              # MLB Stats API client
│   ├── schedule.js         # Game picker logic
│   ├── refresh.js          # Auto-refresh controller
│   ├── theme.js            # Light/dark toggle
│   └── utils.js            # Date/timezone helpers
├── api/
│   └── stats.js            # Vercel serverless function — FanGraphs proxy
├── css/
│   ├── style.css           # Main styles
│   └── styles-editor.css   # Styles editor page
├── fixtures/               # Saved API responses for offline dev
└── vite.config.js          # Vite config
```

## Tech stack

| What | How |
|------|-----|
| Frontend | Vanilla HTML/CSS/JavaScript — no framework |
| Rendering | SVG via DOM manipulation |
| Game data | [MLB Stats API](https://statsapi.mlb.com) (free, no key) |
| Advanced stats | FanGraphs CSV export (via serverless proxy) |
| Build | Vite |
| Hosting | Vercel free tier |

No React, no Vue, no build-time magic. The app is basically a rendering engine — it takes data and draws pictures. A framework would just be in the way.

## Inspired by

This project is heavily inspired by [livebaseballscorecards.com](https://livebaseballscorecards.com) and Benjamin Crom's [baseball](https://github.com/benjamincrom/baseball) Python library (MIT License). That project renders scorecards server-side with Python. This one does it client-side with JavaScript and adds the sabermetric overlays.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

Whether it's fixing a bug, improving the parser, or making the scorecards look better — all help is appreciated.

## License

[MIT](LICENSE) — do whatever you want with it.
