# BaseballScorecard.org

A web app that turns live MLB game data into traditional baseball scorecards — the kind you'd keep with a pencil at the ballpark, except it fills itself in automatically. Built with vanilla JavaScript and Vite, deployed on Netlify.

## Why this exists

I love baseball and I love building things. I used to follow along with games on livebaseballscorecards.com and wanted to learn how to code by creating my own version of that experience. What started as a personal learning project turned into something I thought other scorekeeping fans might enjoy too.

I'm not a professional developer. I'm using AI to help me build this, and if you've ever worked with AI on a project, you know it does funny things sometimes. Baseball is also weird — there are 80+ event types in the MLB API and edge cases I haven't even heard of yet. So things will break. That's part of the fun.

This is an open source project built for the community. I want scorekeeping fans, developers, and anyone who's curious to be able to use it, learn from it, contribute to it, and help make it better. It's not going to be perfect, and it doesn't need to be. If you find a bug, that's an opportunity. If you have an idea, open an issue. If you want to fix something yourself, even better.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.3.0-green.svg)

## What It Does

- **Traditional scorecard rendering:** SVG scorecards faithful to paper scorebook conventions — base diamonds, pitch sequences, fielding notation, runner tracking
- **Pitch detail:** Pitch type and velocity (e.g., "FF 95") with colour-coded strike zone plot
- **Play notation:** Standard scoring notation (K, BB, G63, F8, DP 643, etc.) parsed automatically from MLB's GUMBO feed
- **Runner tracking:** Cumulative runner journeys across at-bats within an inning, annotated outside the diamond
- **Substitution indicators:** Square blocks for pitcher changes, solid lines for pinch hitters/runners
- **Advanced stats:** wOBA calculated client-side from MLB API data using FanGraphs linear weights
- **Light/dark theme:** WCAG AA compliant colour schemes
- **Auto-refresh:** Configurable polling for live games, stops automatically at final
- **Accessible date picker:** Custom ARIA grid pattern with full keyboard navigation
- **Reference page:** Scorecard legend + batting/pitching formulas with LaTeX rendering

## Quick Start

```bash
git clone https://github.com/denislirette/baseballscorebook.git
cd baseballscorebook
npm install
npm run dev
```

Open `http://localhost:5173`, pick a date, pick a game.

### Dev Mode

Add `?dev` to any URL to load from saved fixture files instead of hitting the MLB API.

- Game picker: `http://localhost:5173/?dev`
- Scorecard: `http://localhost:5173/game.html?gamePk=777242&date=2025-07-04&dev`

### Build for Production

```bash
npm run build
npm run preview
```

## How It Works

The app fetches the MLB's "GUMBO" live feed — one JSON blob per game containing lineups, every pitch, every play, and every runner movement. A parser (`js/game-data.js`) transforms that into structured data, and the SVG renderer (`js/svg-renderer.js`) draws the scorecard cell by cell.

The MLB Stats API is free, requires no API key, and has no CORS restrictions.

```
MLB Stats API ──> game-data.js (parse) ──> svg-renderer.js (draw SVG)
```

### Key Design Decisions

- **No framework.** Vanilla JS + direct SVG DOM manipulation. The app is a rendering engine, not an interactive UI.
- **Client-side only.** No backend. Game data is fetched directly from the browser.
- **Single API call per game.** The GUMBO live feed returns the complete game state in one response.
- **Fixture-driven development.** Saved API responses in `fixtures/` allow offline iteration via the `?dev` URL param.

### Project Structure

```
baseballscorebook/
├── index.html              # Game picker: date nav, game grid
├── game.html               # Scorecard view: SVG rendering
├── reference.html          # Legend + advanced stats formulas
├── standings.html          # Division standings
├── releases.html           # Release history
├── contact.html            # Contact info
├── accessibility.html      # Accessibility policy
├── analytics.html          # Analytics disclosure
├── js/
│   ├── game-data.js        # GUMBO feed parser: lineups, play notation, runners
│   ├── svg-renderer.js     # SVG scorecard rendering: cells, grid, diamonds, pitches
│   ├── scorecard.js        # Page orchestrator: fetches data, triggers renders
│   ├── layout-config.js    # Mutable layout constants (COL_WIDTH, ROW_HEIGHT, etc.)
│   ├── api.js              # MLB Stats API client
│   ├── schedule.js         # Game picker logic
│   ├── datepicker.js       # Accessible date picker (ARIA grid pattern)
│   ├── nav.js              # Global navigation + footer
│   ├── theme.js            # Light/dark toggle
│   └── utils.js            # Date formatting, timezone helpers
├── css/
│   └── style.css           # Design system: CSS variables, typography, responsive
├── fixtures/               # Saved API responses for offline development
├── docs/                   # Technical reference, contributing guide
├── netlify.toml            # Netlify build config
└── vite.config.js          # Vite config with dev-only layout save plugin
```

## Scorecard Cell Anatomy

Each at-bat cell contains:

```
┌──────────────────────────────┐
│ FF 95    ┌────┐   RBI        │  ← pitch type + velocity
│ SL 84    │zone│              │     + strike zone plot
│ CU 78    │    │              │     + RBI indicator
│ SI 93    └────┘              │
│                              │
│          ◇ diamond           │  ← base paths coloured by outcome
│       (runners annotated     │     (black=advance, green=scored,
│        outside diamond)      │      red=out)
│                              │
│          G63                 │  ← play result notation
│                              │
│ ■■■■■■■■■■ P-SUB ■■■■■■■■■■ │  ← substitution indicator (if any)
└──────────────────────────────┘
```

- **No diamond** is drawn when there are no runners; notation fills the space at a larger font size
- **K and backwards-K** render extra-large in the diamond area

## Test Games

| Game | Date | Why |
|------|------|-----|
| LAA @ TOR | July 4, 2025 | Primary QA game — 10 innings, 4-3 walkoff |
| TOR @ COL | Aug 6, 2025 | Blowout edge case |
| TOR @ LAD | Oct 28, 2025 | World Series — 18 inning edge case |

Fixtures are saved in `fixtures/` for offline development.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JavaScript |
| Rendering | SVG via DOM manipulation |
| Game data | [MLB Stats API](https://statsapi.mlb.com) (free, no key, no CORS) |
| Build | Vite |
| Hosting | Netlify |
| Analytics | Simple Analytics (privacy-first, no cookies) |

## Deployment

Hosted on [Netlify](https://www.netlify.com/) at [baseballscorecard.org](https://baseballscorecard.org). Push to `master` and it builds and deploys automatically.

## Contributing

This project is built in the open and I welcome help from anyone — whether you're a seasoned developer or just getting started like me. Fix a rendering bug, improve the notation parser, add a feature, clean something up, or just tell me about a game where the scorecard looks wrong. All of it helps.

A few things to know:
- The codebase is vanilla JS on purpose. No React, no framework. That's a deliberate choice.
- I use AI (Claude) extensively to help build this. If you see something that looks odd, it might be AI-generated code that needs a human eye. Don't hesitate to improve it.
- The [technical reference](docs/technical-reference.md) covers data structures, scoring rules, and rendering logic in detail.
- Use the `?dev` URL param to work with fixture data instead of live API calls.
- See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full guide.

Baseball is complicated. Scorekeeping is an art. Software has bugs. The intersection of all three is this project. Come help make it better.

## License

[MIT](LICENSE)
