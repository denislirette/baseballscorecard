# BaseballScorebook.org

## Project Overview

A personal web application that displays live MLB game data as traditional baseball scorecards, closely replicating the visual style and data rendering of [livebaseballscorecards.com](https://livebaseballscorecards.com). The app adds personalized sabermetric overlays (wRC+, wOBA for batters; pitch type arsenal for starting pitchers) on top of the traditional scorecard format.

Hosted on Netlify.

### Development and Testing Approach

All development and QA is done against **historical game data from the 2025 MLB season**, not live games. The primary test game is **Los Angeles Angels at Toronto Blue Jays, July 4, 2025**. The rendered output must be visually and data-compared against the same game on livebaseballscorecards.com to verify accuracy and design fidelity. See the "QA Reference Game and Testing Strategy" section for full details.

## Reference Implementation

The original site (livebaseballscorecards.com) is built by Benjamin Crom using the open source Python library at [github.com/benjamincrom/baseball](https://github.com/benjamincrom/baseball) (MIT License). That project renders scorecards as SVG files server-side using Python, pulling data from the MLB Stats API every 30 seconds.

Our version is a client-side JavaScript application that calls the MLB Stats API directly from the browser (no backend needed for game data). A serverless function for fetching advanced stats from FanGraphs (to handle CORS) is planned but not yet implemented.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Plain HTML, CSS, vanilla JavaScript (no framework) |
| Scorecard rendering | SVG generated client-side via JavaScript |
| Data source (game data) | MLB Stats API (statsapi.mlb.com, free, no API key, no CORS restrictions) |
| Data source (advanced stats) | FanGraphs leaderboard export CSV (free, public) |
| Hosting | Netlify |
| Build tool | Vite |

## Data Sources: Detailed

### 1. MLB Stats API (Primary)

Base URL: `https://statsapi.mlb.com/api/v1`

This API is free, requires no authentication, and has no CORS restrictions. It is the same source livebaseballscorecards.com uses.

**Key Endpoints:**

**Schedule (get today's games):**
```
GET /schedule?sportId=1&date=YYYY-MM-DD
```
Returns a list of games for the date, each with a `gamePk` (unique game ID), team names, game status, and start time. The `sportId=1` parameter filters to MLB.

**Live Game Feed (the main data source):**
```
GET /v1.1/game/{gamePk}/feed/live
```
This is the "GUMBO" feed. It returns the complete state of a game in one massive JSON response. This includes:

- `gameData`: teams, players, venue, weather, probablePitchers, datetime info
- `liveData.plays.allPlays[]`: every plate appearance, containing:
  - `result`: event description, rbi, awayScore, homeScore
  - `about`: inning, halfInning, atBatIndex, isComplete, outs
  - `matchup`: batter info, pitcher info, batSide, pitchHand
  - `playEvents[]`: every pitch within the at-bat, containing:
    - `details.type.code`: pitch type (FF, SL, CU, CH, etc.)
    - `details.type.description`: "Four-Seam Fastball", etc.
    - `details.call.code`: B (ball), C (called strike), S (swinging strike), F (foul), X (in play), etc.
    - `pitchData.startSpeed`: velocity
    - `pitchData.coordinates`: location data
  - `runners[]`: baserunner movement for each event
- `liveData.plays.currentPlay`: the active play during a live game
- `liveData.plays.scoringPlays`: indices of scoring plays
- `liveData.linescore`: inning-by-inning runs, current inning state
- `liveData.boxscore`: full boxscore data with player stats

**Play-by-Play (alternative, lighter):**
```
GET /game/{gamePk}/playByPlay
```

**Boxscore:**
```
GET /game/{gamePk}/boxscore
```

**Linescore:**
```
GET /game/{gamePk}/linescore
```

**Person (player details):**
```
GET /people/{playerId}?hydrate=stats(group=[hitting,pitching],type=season)
```

### 2. FanGraphs Leaderboard Export (Advanced Stats)

FanGraphs provides a public CSV export URL for leaderboard data. No API key needed, but it is server-to-server only (CORS blocked from browsers).

**Batting Leaders (wRC+, wOBA):**
```
https://www.fangraphs.com/leaders.aspx?pos=all&stats=bat&lg=all&qual=0&type=8&season=2026&month=0&season1=2026&ind=0&team=0&rost=0&age=0&filter=&players=0&page=1_10000
```
The `type=8` parameter returns the "Dashboard" view which includes wOBA, wRC+, and other key stats. The `page=1_10000` ensures all qualified players are returned.

Alternatively, FanGraphs has a newer API-style endpoint:
```
https://www.fangraphs.com/api/leaders/major-league/data?pos=all&stats=bat&lg=all&qual=0&type=8&season=2026&month=0&season1=2026&ind=0&team=0&rost=0&age=0&filter=&players=0&startdate=&enddate=
```
This returns JSON directly and may be easier to parse. Test both to see which works from a serverless function.

**Pitching Leaders (pitch types, usage rates):**
The MLB Stats API already provides pitch type data within the live game feed (each pitch event has a `type.code`). For pre-game pitcher arsenal data, we can use FanGraphs pitching data or Statcast data from Baseball Savant.

**Implementation (planned):** Create a serverless function at `/api/stats` that fetches and caches FanGraphs data. Cache the response for the duration of one day (the data is season-level and changes slowly).

```
/api/stats?type=batting&season=2026
/api/stats?type=pitching&season=2026
```

### 3. Team Logos and Visual Assets

Team logos can be sourced from MLB's CDN:
```
https://www.mlbstatic.com/team-logos/{teamId}.svg
```
Where `teamId` is the MLB team ID (e.g., 147 for Yankees, 121 for Mets).

Player headshots:
```
https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{playerId}/headshot/67/current
```

## Application Pages

### Page 1: Game Picker (index.html)

The landing page. Shows all MLB games for a selected date. Very similar to the livebaseballscorecards.com home page.

**Elements:**
- Date picker (defaults to today), with previous/next day arrows
- Grid of game cards, one per game scheduled for that date
- Each game card shows:
  - Away team logo and name
  - Home team logo and name
  - Game time (local to user's timezone) or current score if in progress
  - Game status: "Preview" / "In Progress (Top 5th)" / "Final" / "Postponed"
  - Probable starting pitchers (if available from the schedule endpoint)
- Clicking a game card navigates to the scorecard page for that game

**Data flow:**
1. On load, fetch `GET /schedule?sportId=1&date={today}`
2. Parse `response.dates[0].games[]`
3. Render each game as a card
4. Date picker triggers re-fetch on change

### Page 2: Scorecard View (game.html?gamePk={id})

The main scorecard page. This is where the SVG rendering happens.

**Layout (top to bottom):**

1. **Header bar:** Away Team @ Home Team, date, venue, game status
2. **Refresh controls:** Auto-refresh toggle, custom interval input (default 30 seconds), manual refresh button
3. **Away team scorecard** (the traditional scorecard grid for the visiting team's at-bats)
4. **Home team scorecard** (same for the home team)
5. **Linescore** (the traditional R H E line)
6. **Pitcher summary** (for each pitcher who appeared: IP, H, R, ER, BB, K)
7. **Advanced stats sidebar or overlay** (personalization features)

## Scorecard Visual Specification

This section describes the SVG scorecard layout to replicate livebaseballscorecards.com as closely as possible.

### Overall Structure (per team)

The scorecard is a grid/table rendered as SVG:

- **Rows:** One per batting order position (9 rows for the lineup, with sub-rows for substitutions)
- **Columns:** One per inning (typically 9, expandable for extras)
- **Left margin:** Player names, jersey numbers, fielding positions
- **Right margin:** Game totals (AB, R, H, RBI, BB, SO)

### Individual At-Bat Cell

Each cell in the grid represents one plate appearance. It contains:

**The diamond:** A small rotated square (diamond shape) in the center of the cell, with the four bases at its corners. Base paths are drawn as lines connecting the bases.

- A reached base is indicated by drawing/highlighting the base path segment from the origin base to the reached base
- Scoring runners show the complete path highlighted through home
- Runner advancement is shown by colouring the relevant path segments:
  - Black text/lines: successful advance
  - Red text/lines: runner thrown out
  - Green: runner scored

**Pitch sequence:** Displayed as a string of single-character codes above or below the diamond:
- B = ball
- C = called strike
- S = swinging strike
- F = foul
- X = ball put into play
- T = foul tip
- K = strike (unknown type)
- H = hit by pitch
- I = intentional ball
- L = foul bunt
- M = missed bunt attempt
- And others per the livebaseballscorecards abbreviation chart

**Pitch type annotations:** Below each pitch result character, a smaller text shows the pitch type code:
- FF = Four-seam fastball
- SL = Slider
- CU = Curveball
- CH = Changeup
- SI = Sinker
- FC = Cutter
- KC = Knuckle curve
- FS = Splitter
- ST = Sweeper
- SV = Slurve
- KN = Knuckleball

**Play result:** Text in or near the cell summarizing the outcome:
- Standard scoring notation: K, BB, 1B, 2B, 3B, HR, 6-3, 4-6-3, F8, L7, etc.
- Sacrifice: SAC, SF
- Errors: E6, etc.
- Hit location can be indicated

**Baserunner movement:** Text annotations showing runner advances:
- "1-2" (black) means runner went from 1st to 2nd successfully
- "1-2" (red) means runner was thrown out at 2nd
- "1-2f" (red) means forced out at 2nd
- "1-H" (green) means runner scored from 1st

**Substitution indicators:**
- Solid vertical blue line: batter substitution (pinch hitter)
- Dashed horizontal blue line: pitcher substitution

### Linescore

The traditional box score line below the scorecards:

```
         1  2  3  4  5  6  7  8  9    R  H  E
Away     0  1  0  0  2  0  0  0  0    3  7  1
Home     0  0  0  1  0  0  3  0  x    4  9  0
```

### Pitcher Summary Table

Below the linescore, a table for each team's pitchers:

| Pitcher | IP | H | R | ER | BB | K | HR | PC-ST |
|---------|----|----|---|----|----|---|----| ------|

Where PC-ST is pitch count / strikes.

## Personalization Features

### 1. Batter wRC+ and wOBA Display

For each batter in the lineup, display their current season wRC+ and wOBA next to their name in the left margin of the scorecard.

**Visual treatment:**
- Small text beneath the player name
- wRC+ colour-coded:
  - Below 80: red
  - 80 to 99: orange/yellow
  - 100 to 119: white/neutral
  - 120 to 139: light green
  - 140+: bright green / gold
- wOBA displayed as a plain number

**Data source:** FanGraphs leaderboard data, matched to players by name + team. The serverless function will cache this data daily.

**Matching players:** FanGraphs uses `playerid` (FanGraphs ID) while MLB uses `playerId` (MLBAM ID). We will need a crosswalk. Options:
- Use the `chadwick-bureau/register` dataset (available on GitHub) which maps between IDs
- Match by player name + team (simpler but less reliable with traded players or name collisions)
- Pre-build a mapping table at the start of each season

Recommended approach: Fetch the FanGraphs data which includes player names and team abbreviations. Match against the MLB lineup by full name. If ambiguous, fall back to team context. Build the mapping once per day and cache it.

### 2. Starting Pitcher Pitch Type Arsenal

For each starting pitcher, display their pitch type arsenal and usage rates.

**Visual treatment:** A small bar chart or pill-style breakdown next to the pitcher's name in the pitcher summary section showing:
- Each pitch type they throw (FF, SL, CH, CU, etc.)
- Usage percentage for each
- Color-coded by pitch type:
  - FF/SI = red
  - SL/SV/ST = orange
  - CU/KC = blue
  - CH/FS = green
  - FC = purple
  - KN = grey

**Data sources (two approaches, use both):**
1. **Pre-game:** Pull from FanGraphs or Baseball Savant season pitch mix data to show expected arsenal
2. **In-game:** Calculate live pitch type usage from the `playEvents[].details.type.code` data in the GUMBO feed. Update the display as the game progresses.

## Auto-Refresh System

The scorecard page should support configurable auto-refresh for live games.

**Behaviour:**
- Default interval: 30 seconds (matching livebaseballscorecards.com)
- User can adjust the interval via a number input (range: 10 to 300 seconds)
- Auto-refresh only runs when the game status is "In Progress" or "Pre-Game"
- When the game reaches "Final" status, auto-refresh stops automatically
- Manual refresh button always available
- Visual indicator showing last refresh timestamp and countdown to next refresh
- On each refresh, only the GUMBO live feed is re-fetched. The FanGraphs data does not need re-fetching.

**Implementation:**
```javascript
let refreshInterval = 30000;
let refreshTimer = null;

function startAutoRefresh() {
  refreshTimer = setInterval(fetchAndRender, refreshInterval);
}

function stopAutoRefresh() {
  clearInterval(refreshTimer);
}
```

## Project File Structure

```
baseball-scorebook/
  index.html              # Game picker page
  game.html               # Scorecard view page
  css/
    style.css             # All styles
  js/
    api.js                # MLB Stats API client functions
    schedule.js           # Game picker logic
    scorecard.js          # Main scorecard rendering engine
    svg-renderer.js       # SVG generation for scorecard cells
    linescore.js          # Linescore rendering
    pitcher-summary.js    # Pitcher stats table
    advanced-stats.js     # FanGraphs data fetching and display
    refresh.js            # Auto-refresh controller
    utils.js              # Date formatting, timezone helpers, etc.
  api/
    stats.js              # Serverless function stub for FanGraphs proxy
  assets/
    team-colors.json      # MLB team color hex codes
  fixtures/
    2025-07-04-LAA-TOR.json    # Primary test game GUMBO feed
    schedule-2025-07-04.json   # Schedule response for game picker testing
  netlify.toml            # Netlify build configuration
  package.json            # Project dependencies
```

## Deployment

Hosted on Netlify. Build config is in `netlify.toml`, which runs `npm run build` and publishes the `dist/` directory.

## Key API Response Structures

### Schedule Response (abbreviated)
```json
{
  "dates": [{
    "date": "2026-03-02",
    "games": [{
      "gamePk": 809508,
      "gameDate": "2026-03-02T18:05:00Z",
      "status": {
        "abstractGameState": "Live",
        "detailedState": "In Progress",
        "statusCode": "I"
      },
      "teams": {
        "away": {
          "team": { "id": 120, "name": "Washington Nationals" },
          "probablePitcher": { "id": 621111, "fullName": "..." }
        },
        "home": {
          "team": { "id": 117, "name": "Houston Astros" },
          "probablePitcher": { "id": 664285, "fullName": "..." }
        }
      }
    }]
  }]
}
```

### GUMBO Live Feed: Single Play (abbreviated)
```json
{
  "result": {
    "type": "atBat",
    "event": "Strikeout",
    "eventType": "strikeout",
    "description": "Juan Soto strikes out swinging.",
    "rbi": 0,
    "awayScore": 0,
    "homeScore": 1
  },
  "about": {
    "atBatIndex": 12,
    "halfInning": "top",
    "inning": 3,
    "isComplete": true,
    "outs": 2
  },
  "matchup": {
    "batter": { "id": 665742, "fullName": "Juan Soto" },
    "pitcher": { "id": 664285, "fullName": "Framber Valdez" },
    "batSide": { "code": "L" },
    "pitchHand": { "code": "L" }
  },
  "playEvents": [
    {
      "details": {
        "call": { "code": "C", "description": "Called Strike" },
        "type": { "code": "SI", "description": "Sinker" },
        "isStrike": true, "isBall": false
      },
      "pitchData": { "startSpeed": 93.2 },
      "count": { "balls": 0, "strikes": 1 },
      "index": 0
    },
    {
      "details": {
        "call": { "code": "S", "description": "Swinging Strike" },
        "type": { "code": "CU", "description": "Curveball" }
      },
      "pitchData": { "startSpeed": 81.4 },
      "count": { "balls": 0, "strikes": 2 },
      "index": 1
    },
    {
      "details": {
        "call": { "code": "S", "description": "Swinging Strike" },
        "type": { "code": "CH", "description": "Changeup" }
      },
      "pitchData": { "startSpeed": 87.1 },
      "count": { "balls": 0, "strikes": 3 },
      "index": 2
    }
  ],
  "runners": []
}
```

## Mapping Pitch Call Codes to Scorecard Abbreviations

From the MLB API `call.code` to the scorecard display character:

| API Code | Scorecard Character | Meaning |
|----------|-------------------|---------|
| B | B | Ball |
| C | C | Called Strike |
| S | S | Swinging Strike |
| F | F | Foul |
| X | X | In Play |
| T | T | Foul Tip |
| H | H | Hit By Pitch |
| I | I | Intentional Ball |
| L | L | Foul Bunt |
| M | M | Missed Bunt |
| D | D | Ball in Dirt |
| P | P | Pitchout |
| R | R | Foul on Pitchout |
| Q | Q | Swinging on Pitchout |
| *E | * | Automatic Ball (pitch clock) |
| *V | V | Called Ball (pitcher to mouth) |

## Mapping Play Results to Scoring Notation

The MLB API `result.event` and `result.eventType` need to be translated into traditional scorecard notation. Key mappings:

| API eventType | Scorecard Notation | Notes |
|--------------|-------------------|-------|
| strikeout | K | Backwards K for called third strike |
| walk | BB | |
| intentional_walk | IBB | |
| hit_by_pitch | HBP | |
| single | 1B | Append fielder position for location |
| double | 2B | |
| triple | 3B | |
| home_run | HR | |
| field_out | Position number(s) | e.g., F8, L7, 6-3 |
| grounded_into_double_play | DP notation | e.g., 6-4-3 DP |
| sac_fly | SF + position | e.g., SF9 |
| sac_bunt | SAC | |
| field_error | E + position | e.g., E6 |
| fielders_choice | FC + position | |

The `description` field from the API often contains the fielding details needed to construct the full notation.

## Scoring Notation Parser Strategy

The MLB API does not provide scoring notation directly (this is a known gap noted by users of the original livebaseballscorecards.com). The original Python library parses the `description` text to derive the notation.

Our approach:
1. Use the `result.eventType` for the base category
2. Parse `result.description` to extract fielder involvement
3. Use `runners[]` data to track baserunner movement
4. Build the notation string from these components

This is the most complex part of the project. Study the `benjamincrom/baseball` Python source code for the parsing logic, particularly how `scorecard_summary` is derived.

## QA Reference Game and Testing Strategy

Since we are building against historical data (not live games), all development and QA should use a specific reference game from the 2025 season. This gives us a fixed, completed dataset to build and test against, and a known-good scorecard on livebaseballscorecards.com to compare results.

### Primary Test Game

**Los Angeles Angels at Toronto Blue Jays, July 4, 2025**

This is a mid-season game that has:
- Full regular-season data availability
- Multiple pitchers used (bullpen activity means substitution rendering)
- Standard 9-inning structure
- Baserunner movement, scoring plays, various out types

**Livebaseballscorecards.com reference URL:**
```
https://livebaseballscorecards.com/2025-07-04-LAA-TOR-1.html
```

**MLB Stats API schedule URL (to get the gamePk):**
```
https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-07-04&teamId=141
```
(teamId 141 = Toronto Blue Jays)

**Once you have the gamePk, the live feed URL is:**
```
https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live
```

### Secondary Test Games (for edge case coverage)

Use these additional games to verify edge cases once the primary game renders correctly:

1. **A high-scoring game with many substitutions:** Toronto Blue Jays vs Colorado Rockies, August 6, 2025 (Jays scored 20 runs per Baseball Almanac)
   - URL: `https://livebaseballscorecards.com/2025-08-06-TOR-COL-1.html`
   - Tests: many at-bats per inning, position player pitching, deep lineup cycling

2. **A low-scoring pitchers' duel:** Pick any 1-0 or 2-1 game from mid-season 2025
   - Tests: mostly empty cells render cleanly, K-heavy pitch sequences

3. **World Series Game 3 (18 innings):** Dodgers vs Blue Jays, October 28, 2025
   - URL: `https://livebaseballscorecards.com/2025-10-28-TOR-LAD-1.html`
   - Tests: extra innings grid expansion, massive substitution chains, viewBox scaling

### QA Verification Process

For each development phase, Claude Code should follow this process:

**Step 1: Fetch the reference game data**
Call the MLB Stats API for the primary test game and save the raw JSON response locally as a fixture file (e.g., `fixtures/2025-07-04-LAA-TOR.json`). This avoids hammering the API during development and gives a stable dataset.

**Step 2: Build the renderer against that fixture**
Use the saved JSON to render the scorecard. This decouples rendering work from API work.

**Step 3: Compare against livebaseballscorecards.com**
Open the reference URL in a browser and compare your rendered output against the original. Check the following for each at-bat cell:

- **Pitch sequence**: Does the string of pitch result characters (B, C, S, F, X, etc.) match exactly?
- **Pitch types**: Do the pitch type codes (FF, SL, CU, etc.) beneath each pitch character match?
- **Play result notation**: Does the scoring notation (K, BB, 6-3, F8, etc.) match?
- **Baserunner movement**: Are the same runners shown advancing/scoring/being thrown out?
- **Substitution lines**: Do batter and pitcher substitutions appear in the same cells?
- **Linescore totals**: Do R, H, E match for each inning and the final totals?
- **Pitcher summary stats**: Do IP, H, R, ER, BB, K match for each pitcher?

**Step 4: Document discrepancies**
If there are differences, determine whether they are:
- (a) A bug in our parser (fix it)
- (b) A difference in interpretation (document it and decide which is correct)
- (c) Data that the original site has but we haven't implemented yet (add to backlog)

### Fixture File Strategy

Save a local copy of the API response for the reference game. This is critical for:
- Fast iteration during development (no network calls needed)
- Reproducible testing
- Diffing output across code changes

```
fixtures/
  2025-07-04-LAA-TOR.json          # Full GUMBO live feed for primary test game
  2025-08-06-TOR-COL.json          # High-scoring secondary test
  2025-10-28-TOR-LAD.json          # Extra innings test (World Series Game 3)
  schedule-2025-07-04.json          # Schedule response for game picker testing
```

During development, the app should have a "dev mode" flag or environment variable that loads from local fixture files instead of calling the API. This makes rendering iteration much faster.

### Finding the gamePk

The gamePk is the unique identifier for each MLB game. To find it for the primary test game:

1. Call `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-07-04`
2. In the response, find the game where `teams.away.team.name` or `teams.home.team.name` includes "Blue Jays"
3. The `gamePk` field on that game object is what you need
4. Then call `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live` to get the full game data

If July 4 does not have a Jays game (check the schedule response first), fall back to the nearest date that does. The URL pattern on livebaseballscorecards.com is always `YYYY-MM-DD-AWAY-HOME-GAMENUMBER.html`, so once you know the matchup from the schedule API, you can construct the reference URL.

## Development Phases

### Phase 1: Data Layer, Fixtures, and Game Picker
- Set up project structure
- Implement MLB Stats API client (schedule, live feed)
- Fetch and save the primary test game as a fixture file
- Build a dev mode that loads from fixtures
- Build the game picker page with date navigation
- Verify data fetching works for the July 4, 2025 schedule

### Phase 2: Basic Scorecard Rendering
- Build the SVG scorecard grid (rows for batters, columns for innings)
- Render player names and positions in the left margin
- Render the linescore
- Render at-bat result text in each cell (just the notation, no diamond yet)
- Render pitch sequence strings
- **QA checkpoint**: Compare pitch sequences and play results against livebaseballscorecards.com for the reference game

### Phase 3: Diamond and Baserunner Rendering
- Draw the base diamond in each at-bat cell
- Color base paths based on runner advancement
- Implement substitution line indicators
- Handle extra innings (expanding the grid)
- **QA checkpoint**: Compare runner movement and substitution indicators against the reference scorecard

### Phase 4: Pitcher Summary and Box Score
- Render pitcher statistics table
- Show pitch count data
- **QA checkpoint**: Compare pitcher stats line by line against the reference scorecard

### Phase 5: Advanced Stats Overlay
- Build a serverless function for FanGraphs data
- Implement player ID matching between MLB and FanGraphs
- Display wRC+ and wOBA next to batter names
- Display pitcher arsenal breakdown
- (No livebaseballscorecards.com comparison needed here since these are our custom additions)

### Phase 6: Auto-Refresh and Polish
- Implement configurable auto-refresh
- Add refresh status indicator
- Optimize re-rendering (only update changed cells on refresh)
- Add timezone handling for game times
- Error handling and loading states
- Mobile-responsive layout
- Test against secondary test games (high-scoring, extra innings) to verify robustness

## Colour Palette

Use a neutral, paper-like background to evoke the feel of a physical scorebook.

| Element | Colour |
|---------|-------|
| Background | #FDFCF8 (warm off-white, like old paper) |
| Grid lines | #C8C8C8 (light grey) |
| Text (default) | #1A1A1A (near-black) |
| Diamond outline | #888888 |
| Base path (reached) | #1A1A1A (bold black) |
| Runner scored | #2E8B57 (green) |
| Runner out | #CC3333 (red) |
| Forced out | #CC3333 (red, with "f" annotation) |
| Substitution line (batter) | #3366CC (blue, solid) |
| Substitution line (pitcher) | #3366CC (blue, dashed) |
| wRC+ colour scale | See batter wRC+ section above |

## Accessibility Considerations

- SVG elements should include appropriate `<title>` and `aria-label` attributes
- Colour coding should not be the sole indicator; always pair with text labels
- Pitch sequence text should be readable at reasonable zoom levels
- High contrast mode consideration for the colour-coded elements
- Keyboard navigation between games on the picker page

## Important Notes for Claude Code

1. **Start by fetching and saving the test fixture.** Before writing any rendering code, call the MLB Stats API for the July 4, 2025 schedule, find the LAA vs TOR gamePk (or whichever Jays game is on that date), fetch the full GUMBO live feed, and save it as `fixtures/2025-07-04-LAA-TOR.json`. All rendering development should work off this fixture file.

2. **Always verify against livebaseballscorecards.com.** At each QA checkpoint, open `https://livebaseballscorecards.com/2025-07-04-LAA-TOR-1.html` (adjust the URL if the away/home order or opponent differs) and compare your rendered output cell by cell. The pitch sequences, play results, runner movements, and linescore must match.

3. The MLB Stats API at statsapi.mlb.com is free and requires no API key. You can call it directly from client-side JavaScript. Do not use any paid sports data API.

4. The GUMBO live feed (`/v1.1/game/{gamePk}/feed/live`) is the primary data source for rendering scorecards. It contains everything needed in a single request.

5. FanGraphs data needs a server-side proxy because of CORS. Use a serverless function. Cache aggressively since this data changes at most daily.

6. The scoring notation parser is the hardest part. Start simple (just display the `result.event` text) and iterate toward traditional notation. Reference the `benjamincrom/baseball` Python source code for the parsing algorithm.

7. SVG rendering should be done via JavaScript DOM manipulation (creating SVG elements programmatically), not by building SVG strings. This makes updates cleaner.

8. For the player ID crosswalk between MLB and FanGraphs, start with name matching as the simplest approach. If collisions become a problem, integrate the Chadwick Bureau register.

9. The original livebaseballscorecards.com renders each team's scorecard separately (one above the other, away team on top). Follow this same layout.

10. Hosted on Netlify. Push to main to deploy.

11. When building the scorecard SVG, the viewBox should be dynamic based on the number of innings. Start with a 9-inning viewBox and expand if extras are detected.

12. **Build a dev mode toggle.** Use an environment variable or URL parameter (`?dev=true`) that switches the app to load from local fixture files instead of making API calls. This makes rendering iteration much faster and avoids rate limiting concerns.

13. The primary test game is LAA @ TOR on July 4, 2025 (gamePk 777242). The fixture is saved at `fixtures/2025-07-04-LAA-TOR.json`.
