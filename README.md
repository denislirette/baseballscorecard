# BaseballScorecard.org

A free, open source site that turns live MLB game data into traditional baseball scorecards. Follow along in real time or learn how to keep score yourself.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.5.0-green.svg)
![Status](https://img.shields.io/badge/status-beta-orange.svg)
![JavaScript](https://img.shields.io/badge/vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

> **Beta.** The scorecard works for most games but baseball is weird and edge cases are everywhere. If something looks wrong, [open an issue](https://github.com/denislirette/baseballscorecard/issues).

## Why this exists

I love baseball and I love building things. I used to follow along with games on livebaseballscorecards.com and wanted to learn how to code by creating my own version of that experience. What started as a personal learning project turned into something I thought maybe other scorekeeping fans might enjoy too.

I'm not a professional developer. I've designed it and use Claude to help me build this, especially the back-end stuff, and if you've ever worked with ai on a project, you know it does funny things sometimes. Baseball is also weird. There are so many event types in the MLB API and edge cases I haven't even heard of yet...so things will break in hilarious ways but that's part of the fun. ;)

This is an open source project built for the community. I want scorekeeping fans, developers, and anyone who's curious to be able to use it, learn from it, contribute to it, and help **make it better.**

## What It Does

- **Traditional scorecard rendering.** SVG scorecards similar to paper scorebook conventions: base diamonds, pitch sequences, fielding notation, runner tracking, etc..
- **Pitch detail.** Pitch type and velocity (e.g., "FF 95") with colour-coded strike zone plot
- **Play notation.** Standard scoring notation (K, BB, G63, F8, DP643, etc.) parsed automatically from the MLB GUMBO feed, some use dashes like DP 6-4-3 and it's a preference thing
- **Runner tracking.** Cumulative runner journeys across at-bats within an inning, drawn on the diamond
- **Substitution indicators.** Dotted blue lines for pitcher changes, with their strieks/pitches and K's noted, and I use solid amber/yellow-ish lines for pinch hitters/runners
- **Advanced stats.** wOBA calculated from season stats using FanGraphs linear weights (see [Data Sources](#data-sources)
- **Auto-refresh.** Configurable polling for live games, stops automatically at final
- **Accessible date picker.** Constantly adding keyboard navigation (arrow keys, Home/End, Page Up/Down, Escape)
- **Guide page.** Scorecard legend, play cell anatomy, and batting/pitching formulas, eventually would love a on-boarding..
- **Light/dark theme.** WCAG AA colour contrast in both themes, a11y is really important to me and this is an ongoing and never ending process to reduce access barriers for people who use assitive tech to engage with this site

## Quick Start

```bash
git clone https://github.com/denislirette/baseballscorecard.git
cd baseballscorecard
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

The app fetches the MLB's "GUMBO" live feed, one JSON blob per game containing lineups, every pitch, every play, and every runner movement. A parser (`js/game-data.js`) transforms that into structured data, and the SVG renderer (`js/svg-renderer.js`) draws the scorecard cell by cell.

```
MLB Stats API --> game-data.js (parse) --> svg-renderer.js (draw SVG)
```

### Key Design Decisions

- **No framework.** Vanilla JS and direct SVG DOM manipulation. The app is a rendering engine, not an interactive UI.
- **No backend.** Game data is fetched directly from the browser.
- **Single API call per game.** The GUMBO live feed returns the complete game state in one response.
- **Fixture-driven development.** Saved API responses in `fixtures/` let you work offline with the `?dev` URL param.

### Project Structure

```
baseballscorecard/
├── index.html              # Game picker: date nav, game grid
├── game.html               # Scorecard view: SVG rendering
├── reference.html          # Guide: legend, formulas, play cell anatomy
├── standings.html          # Division standings
├── contact.html            # Contact form
├── accessibility.html      # Accessibility statement and known issues
├── analytics.html          # Analytics disclosure
├── js/
│   ├── game-data.js        # GUMBO feed parser: lineups, play notation, runners
│   ├── svg-renderer.js     # SVG scorecard + HTML tables (pitchers, game header)
│   ├── svg-thumbnail.js    # Simplified scorecard thumbnails for game cards
│   ├── scorecard.js        # Game page controller: fetches data, triggers renders
│   ├── layout-config.js    # Layout constants (COL_WIDTH, ROW_HEIGHT, etc.)
│   ├── api.js              # MLB Stats API client with dev mode fixture loading
│   ├── schedule.js         # Game picker page logic
│   ├── datepicker.js       # Accessible date picker with keyboard navigation
│   ├── standings.js        # Standings page rendering
│   ├── nav.js              # Global header, footer, skip link, progress bar
│   ├── theme.js            # Light/dark toggle
│   ├── refresh.js          # Auto-refresh controller for live games
│   └── utils.js            # Date formatting helpers
├── css/
│   └── style.css           # Design tokens, typography, responsive layout
├── fixtures/               # Saved API responses for offline development
├── docs/                   # Technical reference, contributing guide
├── netlify.toml            # Netlify build config
└── vite.config.js          # Vite config with dev-only layout editor plugins
```

## Scorecard Cell Anatomy

Each at-bat cell contains:

```
■■■■■■■■ 24/38 ■■■■■■■■■■■■■■  pitcher sub (if any): S/P/K
┌──────────────────────────────┐
│ ②        2-1         FF 95  │  out badge, count, pitch type+velo
│                       SL 84  │
│          ◇ diamond    CU 78  │  base paths by outcome
│                       SI 93  │  (black/green/red)
│                      ┌────┐  │
│ ◆◆  G63             │zone│  │  RBI diamonds, notation,
│                      └────┘  │  strike zone plot
└──────────────────────────────┘
```

- **Top left**: out number badge (filled circle with 1, 2, or 3)
- **Top center**: final count (e.g., 2-1)
- **Right column**: pitch sequence (type + velocity), strike zone plot below
- **Center**: diamond with base paths (black = advance, green = scored, red = out)
- **Bottom left**: RBI diamonds, then play notation (G63, K, BB, etc.)
- **Top edge**: pitcher substitution line with strike/pitch/K counts (only when a pitching change happened)
- **No diamond** is drawn when there are no runners. The notation fills the space at a larger font size.
- **K and backwards-K** render extra-large in the diamond area.

## Test Games

| Game | Date | Why |
|------|------|-----|
| LAA @ TOR | July 4, 2025 | Primary QA game, 10 innings, 4-3 walkoff |
| TOR @ COL | Aug 6, 2025 | Blowout edge case |
| TOR @ LAD | Oct 28, 2025 | World Series, 18 inning edge case |

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

## Data Sources

This project pulls from a few places. Here's where the data comes from and how it's used.

- **[MLB Stats API](https://statsapi.mlb.com)** (also called GUMBO). All game data: schedules, live play-by-play, lineups, pitch sequences, boxscores, standings, and player stats. Free, no API key, no CORS restrictions. This is the same feed that powers MLB's own apps.

- **[FanGraphs](https://www.fangraphs.com/guts.aspx?type=cn)** linear weights. The wOBA calculation uses FanGraphs' published run values for walks, singles, doubles, triples, and home runs. These weights change slightly each season based on the league-wide run environment. The weights in the code are from the 2024 season and should be updated annually.

- **[Weather Icons](https://erikflowers.github.io/weather-icons/)** by Erik Flowers. Used for weather condition icons in the game header. Loaded from a CDN.

- **[MathJax](https://www.mathjax.org/)** for rendering batting and pitching formulas on the Guide page. Loaded from a CDN.

## Deployment

Hosted on [Netlify](https://www.netlify.com/) at [baseballscorecard.org](https://baseballscorecard.org). Push to `master` and it builds and deploys automatically.

## Contributing

This project is built in the open and I welcome help from anyone, whether you're a seasoned developer or just getting started like me. Fix a rendering bug, improve the notation parser, add a feature, clean something up, or just tell me about a game where the scorecard looks wrong. All of it helps.

A few things to know:
- The codebase is vanilla JS on purpose. No React, no framework. That's a deliberate choice.
- I use AI (Claude) extensively to help build this. If you see something that looks odd, it might be AI-generated code that needs a human eye. Don't hesitate to improve it.
- The [technical reference](docs/technical-reference.md) covers data structures, scoring rules, and rendering logic in detail.
- Use the `?dev` URL param to work with fixture data instead of live API calls.
- See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full guide.

Baseball is complicated. Scorekeeping is an art. Software has bugs. The intersection of all three is this project. Come help make it better.

## License

[MIT](LICENSE)

<a href="https://www.buymeacoffee.com/baseballscorecard.org"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=baseballscorecard.org&button_colour=FFDD00&font_colour=000000&font_family=Inter&outline_colour=000000&coffee_colour=ffffff" /></a>
