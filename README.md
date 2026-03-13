# Baseball Scorebook

A personal MLB scorecard web app that renders live game data as traditional SVG scorecards with sabermetric overlays. Built with vanilla JavaScript, Vite, and deployed on Vercel.

Inspired by [livebaseballscorecards.com](https://livebaseballscorecards.com) (Benjamin Crom's [baseball](https://github.com/benjamincrom/baseball) library), reimplemented as a client-side JavaScript application with additional analytics features.

## Features

- **Traditional scorecard rendering** — SVG-based scorecards faithful to paper scorebook conventions: base diamonds, pitch sequences, fielding notation, runner tracking
- **Pitch detail** — 3-column pitch log (call code, pitch type, velocity) with color-coded strike zone plot
- **Play notation** — Standard scoring notation (K, BB, 6-3, F8, DP643, etc.) with automatic parsing from MLB's GUMBO feed
- **Runner tracking** — Cumulative runner journeys across at-bats within an inning, annotated outside the diamond (H1, 23H, H123H)
- **Substitution indicators** — Dashed lines for pitcher changes, solid lines for pinch hitters/runners, with circled sub numbers
- **Sabermetric overlays** — wRC+ and wOBA for batters, pitcher arsenal breakdowns (via FanGraphs data)
- **Light/dark theme** — WCAG AA compliant color schemes with CSS custom properties
- **Auto-refresh** — Configurable polling interval (10–300s) for live games, stops automatically at final
- **WYSIWYG cell editor** — Visual tool for tuning cell layout constants (diamond size, pitch column width, font sizes) with live preview

## Architecture

```
baseball-scorebook/
├── index.html              # Game picker — date navigation, game grid
├── game.html               # Scorecard view — SVG rendering, refresh controls
├── styles.html             # Styles editor page
├── cell-editor.html        # WYSIWYG cell layout editor
├── cell-reference.html     # Visual reference of all cell states
├── export-cells.html       # Export cell states as SVG for Figma
├── js/
│   ├── game-data.js        # GUMBO feed parser — lineups, play notation, runners (783 lines)
│   ├── svg-renderer.js     # SVG scorecard rendering — cells, grid, diamonds, pitches (1089 lines)
│   ├── scorecard.js        # Page orchestrator — fetches data, triggers renders
│   ├── layout-config.js    # Mutable layout constants (COL_WIDTH, ROW_HEIGHT, etc.)
│   ├── api.js              # MLB Stats API client
│   ├── schedule.js         # Game picker logic
│   ├── refresh.js          # Auto-refresh controller
│   ├── standings.js        # Standings display
│   ├── theme.js            # Light/dark toggle
│   └── utils.js            # Date formatting, timezone helpers
├── api/
│   └── stats.js            # Vercel serverless function — FanGraphs proxy with daily cache
├── css/
│   ├── style.css           # Main styles — CSS variables, responsive grid, dark mode
│   └── styles-editor.css   # Styles editor page styles
├── fixtures/               # Saved API responses for offline development
├── design-tokens.json      # Design tokens for Figma sync
└── vite.config.js          # Vite config with dev-only layout/token save plugins
```

## Data Flow

```
MLB Stats API (statsapi.mlb.com)
        │
        ├── /schedule?sportId=1&date=...     → Game picker grid
        │
        └── /v1.1/game/{gamePk}/feed/live    → GUMBO feed (single massive JSON)
                │
                ├── gameData          → Teams, players, venue, weather
                ├── liveData.plays    → Every plate appearance + pitch events
                ├── liveData.linescore → Inning-by-inning R/H/E
                └── liveData.boxscore  → Player stats, batting order
                        │
                        ▼
                game-data.js (parse)
                        │
                        ▼
                svg-renderer.js (render SVG)

FanGraphs (via /api/stats serverless function)
        │
        └── Batting/pitching leaderboards → wRC+, wOBA, arsenal data
```

### Key Design Decisions

- **No framework** — Vanilla JS + direct SVG DOM manipulation. The app is a rendering engine, not an interactive UI. Keeping it framework-free means zero build complexity and full control over SVG output.
- **Client-side rendering** — The MLB Stats API has no CORS restrictions and requires no API key, so game data is fetched directly from the browser. Only FanGraphs data needs a server-side proxy (CORS blocked).
- **Single API call per game** — The GUMBO live feed returns the complete game state in one response. No need to stitch together multiple endpoints.
- **Fixture-driven development** — Saved API responses in `fixtures/` allow offline iteration without hitting the API. Dev mode loads from fixtures instead of live endpoints.
- **Mutable layout config** — `layout-config.js` exposes a shared config object that the cell editor can update at runtime via a Vite dev plugin POST endpoint. Changes persist to disk.

## Scorecard Cell Anatomy

Each at-bat cell contains:

```
┌──────────────────────────────┐
│ C FF 95  ┌────┐   RBI       │  ← pitch log (call, type, speed)
│ S SL 84  │zone│              │     + strike zone plot
│ F CU 78  │    │              │     + RBI indicator (green)
│ X SI 93  └────┘              │
│                              │
│          ◇ diamond           │  ← base paths colored by outcome
│       (runners annotated     │     (black=advance, green=scored,
│        outside diamond)      │      red=out)
│                              │
│         6-3                  │  ← play result notation
│                              │
│ ┄┄┄┄┄┄┄┄┄┄ P-SUB ┄┄┄┄┄┄┄┄┄ │  ← substitution indicator (if any)
└──────────────────────────────┘
```

- **No diamond** is drawn when there are no runners — notation fills the space at a larger font size
- **K and backwards-K** render extra-large in the diamond area
- **Strikeout counter** (K1, K2, K3...) tracks starting pitcher Ks as subscripts

## Development

```bash
npm install
npm run dev          # Vite dev server with layout/token save plugins
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

### Design Token Sync

```bash
npm run sync-tokens  # Sync design-tokens.json → CSS variables + layout config
npm run export-figma # Export tokens for Figma import
```

### Test Game

Primary QA reference: **Toronto Blue Jays at New York Yankees, July 4, 2025**

The fixture is saved at `fixtures/2025-07-04-LAA-TOR.json`. Rendered output is compared cell-by-cell against [livebaseballscorecards.com](https://livebaseballscorecards.com) for the same game to verify accuracy.

## Deployment

Hosted on Vercel free tier. Static site + one serverless function (`/api/stats`) for FanGraphs data proxy with daily cache headers.

```bash
vercel          # Deploy
vercel --prod   # Production deploy
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JavaScript |
| Rendering | SVG via DOM manipulation |
| Game data | MLB Stats API (free, no key, no CORS) |
| Advanced stats | FanGraphs leaderboard CSV (via serverless proxy) |
| Build | Vite |
| Hosting | Vercel (free tier) |

## License

Personal project — not open source.
