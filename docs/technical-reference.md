# BaseballScorebook.org: Technical Reference

> This document explains how the entire system works so another developer (or AI) can review, debug, and extend it. It covers architecture, data flow, file responsibilities, key data structures, scoring rules, and known gaps.
>
> Scoring logic is grounded in official MLB rules and traditional hand-scoring conventions. Where a rule has a specific MLB rulebook citation, it is noted inline. Where the system makes a deliberate style choice that deviates from one valid convention in favour of another, that choice is explained.

---

## Architecture Overview

Vanilla JavaScript + Vite. No framework. ES modules throughout. The app renders MLB game data as traditional SVG scorecards inspired by the Bob Carpenter scorebook layout.

**Data source:** MLB Stats API (free, no auth, no CORS). The primary feed is the GUMBO live feed: `/v1.1/game/{gamePk}/feed/live`.

**Dev mode:** Add `?dev` to the URL. Loads data from `/fixtures/` instead of the live API.

**Rendering:** SVG elements built via DOM manipulation (not innerHTML). HTML tables for supplementary data (pitcher stats, linescore, etc.).

---

## File Map

| File | Purpose |
|------|---------|
| `index.html` | Game picker page: date nav, game grid |
| `game.html` | Scorecard view: SVG rendering, refresh controls |
| `js/api.js` | MLB API client, with dev mode fixture loading |
| `js/game-data.js` | GUMBO feed parser: transforms raw API into scorecard data structures |
| `js/svg-renderer.js` | SVG scorecard rendering: grid, cells, diamonds, pitch sequences, stats |
| `js/scorecard.js` | Page orchestrator: fetches data, calls renderers, manages refresh |
| `js/schedule.js` | Game picker page logic: date nav, game cards |
| `js/layout-config.js` | Mutable layout constants (cell sizes, margins, font sizes) |
| `js/theme.js` | Dark/light mode toggle; persists to localStorage |
| `js/refresh.js` | Auto-refresh controller for live games |
| `js/standings.js` | AL/NL standings overlay |
| `js/utils.js` | Date/time formatting utilities |
| `css/style.css` | All styles, CSS variables for light/dark themes |
| `vite.config.js` | Vite 6 config, with dev-only layout save plugin |
| `fixtures/index.json` | Maps gamePk → fixture filename for dev mode |
| `fixtures/2025-07-04-LAA-TOR.json` | Primary test fixture (LAA @ TOR, 10 innings, 4-3 walkoff) |

---

## Data Flow

```
User clicks game card (index.html)
  → navigates to game.html?gamePk=831628&date=2026-03-08

scorecard.js reads URL params
  → fetchLiveFeed(gamePk)          [js/api.js]
  → fetchStandings(season)          [js/api.js]
  → fetchAllTeamStats(season)       [js/api.js]

renderGame() orchestrates everything:
  → game-data.js parses GUMBO into lineup, grid, subs, stats
  → svg-renderer.js draws SVG scorecard for away & home
  → HTML tables for pitcher stats, linescore, header, bench, bullpen
```

---

## Key Data Structures

### Lineup

```js
// Array of 9 lineup slots, each with player(s) including substitutes
[
  { slot: 1, players: [
    { id: 12345, name: "Lindor", position: "SS", battingOrder: "100", isSubstitute: false, stats: {...} },
    { id: 67890, name: "Smith", position: "2B", battingOrder: "101", isSubstitute: true, stats: {...} }
  ]},
  { slot: 2, players: [...] },
  // ... slots 1-9
]
```

**Batting order parsing:** The API returns `battingOrder` as a STRING (e.g., "203"). Must `parseInt()`. Slot = `Math.floor(int / 100)`, sub-index = `int % 100` (0 = starter, 1+ = substitute).

### Grid (Scorecard Cells)

```js
// Map keyed by "slot-inning" → array of at-bats in that cell
Map {
  "1-1" → [atBatObject],       // slot 1, inning 1
  "3-2" → [atBatObject],       // slot 3, inning 2
  "5-4" → [ab1, ab2],          // slot 5, inning 4 (batted around)
}
```

### At-Bat Object

```js
{
  batterId: 12345,
  batterName: "Francisco Alvarez",
  pitcherId: 67890,
  pitcherName: "Freddy Peralta",
  inning: 2,

  pitchSequence: [
    { callCode: "B", typeCode: "FF", speed: 96.2, pX: -0.5, pZ: 3.1, szTop: 3.4, szBot: 1.6 },
    { callCode: "C", typeCode: "SI", speed: 93.1, pX: 0.2, pZ: 2.8, ... },
    // ...
  ],

  notation: "BB",          // scoring notation (see Scoring Notation section)

  runners: [               // ALL runners who moved during this play (from API)
    { start: null, end: "1B", isOut: false, playerId: 12345, playerName: "Alvarez" },
    { start: "1B", end: "2B", isOut: false, playerId: 11111, playerName: "Someone" },
  ],

  cumulativeRunners: [     // BATTER'S full journey (built in second pass)
    { playerId: 12345, segments: [{from:"HP",to:"1B"},{from:"1B",to:"2B"}],
      currentBase: "2B", scored: false, isOut: false,
      outBase: null,          // set to "2B", "3B", etc. if runner was retired on bases
      advanceType: "hit"      // "hit" | "sb" | "cs" | "wp" | "pb" | "bk" | "fc" | "error" | "out"
    }
  ],

  rbi: 0,
  spKNumber: null,         // if K from starting pitcher: K1, K2, K3...
  confidence: "high",      // "high" | "low"; set to "low" when notation was inferred, not certain
  confidenceNote: null,    // human-readable note explaining what was uncertain, e.g. "FC fielder positions inferred from description"
}
```

**On `confidence` and `confidenceNote`:** Any time `parsePlayNotation` falls back to description parsing, produces a generic fallback like bare `FC`, or encounters an `eventType` not in the known map, set `confidence: "low"` and populate `confidenceNote`. The renderer uses this to display a small indicator in the cell (see Confidence Indicators section).

### Cumulative Runner Journey

This is the critical data structure for diamond rendering. It tracks each player's full baserunning journey through the inning, accumulated across multiple at-bats.

**How it works (game-data.js, buildScorecardGrid):**

1. **First pass:** Process all plays sequentially. For each play, update a per-inning journey map tracking every runner's cumulative segments:
   ```js
   journeysByInning = Map<inning, Map<playerId, {
     segments: [{from: "HP", to: "1B"}, {from: "1B", to: "2B"}],
     currentBase: "2B",
     scored: false,
     isOut: false,
     outBase: null,       // base where the out occurred if isOut is true
     advanceType: "hit"   // how each segment was reached (see advanceType values above)
   }>>
   ```

2. **Second pass:** After all plays are processed, attach each player's completed journey to their OWN batting cell (not the cell where a subsequent play advanced them):
   ```js
   // Find the cell where this player batted
   const ab = cells.find(c => c.batterId === playerId);
   ab.cumulativeRunners = [{ playerId, segments, currentBase, scored, isOut, outBase }];
   ```

**Why two passes?** A runner's journey is not complete until the half-inning ends. Example:

- Batter A singles in the 3rd → HP to 1B
- Batter B singles → A advances to 2B
- Batter C flies out → nothing changes
- Batter D doubles → A scores

Batter A's completed diamond shows HP → 1B → 2B → HP (scored). None of those advances after the first are known until the subsequent plays are processed.

**Important edge case: a batter who reaches then is retired on the bases in the same play.** On a fielder's choice or force play, both the batter's movement to first AND the retiring of the lead runner happen within a single `runners` array. Process both in the first pass. The retired runner's journey should have `isOut: true` and `outBase` set to the base where the out was recorded.

---

## Diamond Rendering (svg-renderer.js)

The diamond is a rotated square with corners at HP (bottom), 1B (right), 2B (top), 3B (left). This orientation matches traditional hand scorebooks.

**Coordinates** are offsets from center (cx, cy), defined in `layout-config.js`:
```js
BASES: {
  HP:  { dx: 0, dy: DIAMOND_R },
  '1B': { dx: DIAMOND_R, dy: 0 },
  '2B': { dx: 0, dy: -DIAMOND_R },
  '3B': { dx: -DIAMOND_R, dy: 0 },
}
```

**What gets drawn:**
- Diamond polygon outline (filled black for HR)
- Base path lines (5px stroke) for each segment in `cumulativeRunners`
- A stroke colour per segment based on `advanceType` (see colour table below)
- Dot (6px circle) on `currentBase` if runner is still on base at inning end
- An X marker at `outBase` if `isOut` is true
- Runner annotations outside diamond (e.g., "H1" = scored on hit by batter in slot 1)
- A small `?` badge in the top-right corner of the cell if `confidence === "low"`

**Segment stroke colours by advanceType:**

| advanceType | Colour | Meaning |
|-------------|-------|---------|
| `hit` | Black | Advanced on a hit |
| `sb` | Black | Stolen base (also draw "SB" annotation at the destination base) |
| `wp` | Black | Wild pitch |
| `pb` | Black | Passed ball |
| `bk` | Black | Balk |
| `fc` | Black | Reached on fielder's choice (batter's segment to 1B) |
| `error` | Black | Reached on error |
| `cs` | Red | Caught stealing (partial line to base where out occurred, then X) |
| `out` | Red | Runner retired on bases (line toward base of out, then X at `outBase`) |

**Decision to draw diamond:**
```js
const hasRunners = ab.runners && ab.runners.some(r => r.end && r.end !== r.start);
```
Only draws a diamond if there is baserunner movement in the play. Strikeouts and popouts with no runners moving get no diamond, just large notation text centered in the cell.

**Home run special case:** On a solo HR, `movement.originBase` is null and `movement.end` is `"score"`. There are no other runners. This still requires a diamond drawn and fully filled. Explicitly check for `eventType === "home_run"` before evaluating `hasRunners`, and force diamond rendering on any HR regardless of runner count.

---

## Scoring Notation (game-data.js)

The `parsePlayNotation(play)` function converts MLB API `eventType` to traditional scoring notation. The system follows the Bob Carpenter style, meaning trajectory prefixes (`G`, `F`, `L`, `P`) are used for all outs, and fielder numbers follow in sequence with hyphens for assists.

### Positional Numbering

Every fielder has a number. This is the foundation of all out notation.

| Number | Position |
|--------|----------|
| 1 | Pitcher |
| 2 | Catcher |
| 3 | First base |
| 4 | Second base |
| 5 | Third base |
| 6 | Shortstop |
| 7 | Left field |
| 8 | Center field |
| 9 | Right field |

### eventType to Notation Map

| eventType | Notation | Example | Notes |
|-----------|----------|---------|-------|
| `strikeout` | `K` or `ꓘ` | K, ꓘ | Determine swinging vs called from final pitch `callCode`: `S`/`T`/`W` = K, `C` = ꓘ |
| `walk` | `BB` | BB | |
| `intent_walk` | `IBB` | IBB | No pitches thrown; `playEvents` may be empty or contain intentional ball codes |
| `hit_by_pitch` | `HBP` | HBP | |
| `single` | `1B` | 1B | |
| `double` | `2B` | 2B | |
| `triple` | `3B` | 3B | |
| `home_run` | `HR` | HR | Fill diamond regardless of other runners |
| `field_out` | trajectory + positions | G6-3, F8, L7, P4 | See trajectory detection below |
| `grounded_into_double_play` | `G` + positions | G6-4-3 | See double play section below |
| `strikeout_double_play` | `K` + positions | K2-3 | Dropped third strike, batter thrown out; see dropped third strike |
| `sac_bunt` | `SH` + positions | SH1-3 | Does not count as official at-bat (MLB Rule 9.08) |
| `sac_fly` | `SF` + position | SF9 | Does not count as official at-bat (MLB Rule 9.08); runner must score |
| `fielders_choice` | `FC` + positions | FC4-6 | Batter reaches; another runner retired; parse positions from description |
| `force_out` | `FC` + positions | FC6-3 | Lead runner retired at next base; batter reaches first; parse positions from description |
| `field_error` | `E` + position | E6 | Batter not credited with a hit; run may be unearned |
| `catcher_interf` | `CI` | CI | Batter awarded first base (MLB Rule 6.01(g)) |
| `double_play` | trajectory + positions | F8-2 (rare) | Non-groundball DP; treat like field_out with two outs recorded |
| `triple_play` | trajectory + positions | G5-4-3 | Extremely rare; write full fielder sequence |
| `batter_interference` | `INT` | INT | Batter interferes with catcher; runner may be called out instead |
| `runner_double_play` | positions | 2-6 | Runner interference causing double play; no batter out |

If `eventType` is not in this table, set `confidence: "low"` and log it as UNKNOWN. Use `result.event` (the human-readable string) as a fallback label in the cell.

### Trajectory Detection for `field_out`

The trajectory prefix is determined from `hitData.trajectory` in the final pitch's `playEvents` entry, or from `result.description` parsing as a fallback:

| `hitData.trajectory` | Prefix | Meaning |
|----------------------|--------|---------|
| `ground_ball` | `G` | Groundout |
| `fly_ball` | `F` | Fly out |
| `line_drive` | `L` | Line drive out |
| `popup` | `P` | Popup (infield fly) |
| `bunt_grounder` | `G` | Bunt groundout (prefix same; add context if needed) |
| `bunt_popup` | `P` | Bunt popup |

If `hitData` is missing, parse `result.description` for keywords: "grounds out" → `G`, "flies out" → `F`, "lines out" → `L`, "pops out" → `P`. If neither source is conclusive, use `F` as the default and set `confidence: "low"`.

### Fielder Position Extraction

For all outs requiring fielder numbers, extract them from the `credits` array in `play.runners[]`:

```js
// credits example for a G6-3:
credits: [
  { player: {...}, position: { code: "6" }, credit: "f_assist" },
  { player: {...}, position: { code: "3" }, credit: "f_putout" }
]
```

Build the fielder chain by ordering credits: assists first (in the order they appear), putout last. The result is the hyphen-separated string: `6-3`.

If the `credits` array is empty or missing, fall back to parsing `result.description` for position names ("shortstop", "first baseman", etc.) using the position name-to-number map. Set `confidence: "low"` when using this fallback.

### Double Play Notation

The system currently uses `DP6-4-3` as a prefix. The Bob Carpenter convention, which this system is modeled on, uses a trajectory prefix instead: `G6-4-3`. The fielder chain length (three fielders) already implies a double play to any scorer. Using `G` is preferred for consistency with all other ground ball outs.

For a strikeout double play (dropped third strike), write `K` then the fielder sequence: `K2-3` means the catcher threw to first after a dropped third strike.

For a lined-into double play, write `L` then the fielder sequence: `L6-3` means the shortstop caught the line drive and threw to first to double off the runner.

### Sacrifice Bunt (SH) Rules

A sacrifice bunt (SH) is only scored when: the batter bunts, is put out, AND at least one runner advances. If the batter reaches safely on the bunt (error or fielder's choice), it is not scored as SH. If no runner advances, it is not scored as SH. Official at-bat is not charged either way (MLB Rule 9.08(a)).

Write `SH` followed by the fielder sequence. `SH1-3` means the pitcher fielded and threw to first.

### Sacrifice Fly (SF) Rules

A sacrifice fly is only scored when: the batter hits a fly ball (including a line drive caught in the outfield), the batter is out, AND a runner scores on the play (MLB Rule 9.08(d)). An outfielder error that allows a runner to score does NOT produce a sacrifice fly. The key test is: would the run have scored with ordinary effort? If yes, score SF.

Write `SF` followed by the fielder who caught the ball. `SF9` means the right fielder caught it and a run scored.

### Fielder's Choice (FC) and Force Out

Both `fielders_choice` and `force_out` result in the batter reaching base while another runner is retired. The distinction is subtle: a force out is when the lead runner is forced to advance and is retired at that next base. A fielder's choice is the broader category where the fielder chose to retire a different runner.

Both are written `FC` followed by the positions involved in the out. `FC4-6` means the second baseman fielded and threw to the shortstop covering second to retire the lead runner. The batter reaches first.

In both cases, draw the batter's diamond path to first base. On the retired runner's diamond (in their own batting cell), draw the path up to the base they were put out at, and mark an X at that base corner. This is the correct way to show forced-out runners visually.

### Dropped Third Strike

When a catcher fails to catch strike three cleanly AND first base is unoccupied (or there are two outs), the batter is entitled to run to first (MLB Rule 5.05(a)(2)). The pitch callCode will be `S` or `T` (foul tip dropped).

Score it as `K` with the fielder sequence appended if the batter is thrown out: `K2-3` (catcher to first). If the batter reaches safely, write `K` with a small circle around it (in SVG, a circle border on the notation text), or append `+` to indicate the uncaught third strike: `K+`. Set `confidence: "low"` and note that this is a dropped third strike reach, as it is not a conventional hit and needs visual distinction.

### Infield Fly Rule

When the umpire declares an infield fly (MLB Rule 5.09(a)(12)), the batter is automatically out regardless of whether the ball is caught. The call must be made before the ball lands, with runners on first and second (or bases loaded) and fewer than two outs.

Notate as the trajectory and fielder who caught (or would have caught) the ball, and append `(IFF)`: `F5(IFF)` or `P4(IFF)`. This is important because the out was rule-based, not an ordinary catch, and runners may advance at their own risk after the ball drops.

### Obstruction and Interference

**Obstruction (OBS):** A fielder without the ball impedes a runner (MLB Rule 6.01(h)). The umpire awards the runner at least the base they were headed to. Notate the runner's movement as awarded and add `OBS` with the fielder number in the cell: `OBS5` means the third baseman obstructed. Set `confidence: "low"` as these plays are rare and description parsing may be unreliable.

**Batter interference (INT):** The batter interferes with the catcher's throw. The runner the catcher was throwing at may be called out. Notate `INT` in the batter's cell.

**Runner interference:** A runner intentionally interferes with a fielder or a batted ball. Both the runner and the batter (on a double play attempt) may be called out. Notate with the position number of the fielder interfered with.

### Reached on Error (E)

The batter reaches base because a fielder misplayed a ball that should have resulted in an out (scorer's judgment). Notate `E` followed by the fielder's position number. `E6` means the shortstop made an error.

The batter gets no hit credit. Any run that scores as a result of the error is potentially unearned (see Earned Run Determination).

An error does NOT require the ball to be dropped. A fielder who throws wildly pulling the first baseman off the bag is charged with an error. So is a fielder who bobbles a grounder long enough for the batter to reach safely when the out would have been made with ordinary effort.

---

## Pitch Sequence Rendering (svg-renderer.js)

Each at-bat cell has a pitch column on the left (width = `PITCH_COL_W`, default 66px).

**Per pitch, three columns of text:**
1. Call code (left), coloured by type (see table below)
2. Pitch type (center): FF, SI, CH, SL, CU, FC, etc.
3. Speed (right), rounded integer MPH

### Call Code Colour Table

| Code | Colour | Meaning |
|------|-------|---------|
| `B` | Black | Ball |
| `H` | Black | Hit by pitch |
| `*` | Black | Pitchout |
| `C` | Red | Called strike |
| `S` | Red | Swinging strike |
| `F` | Red | Foul ball |
| `T` | Red | Foul tip (catcher catches it cleanly; counts as a strike; can retire batter on K) |
| `W` | Red | Swinging strike on a blocked ball (catcher blocks but does not catch; batter can run on strike three) |
| `X` | Blue | In play, out recorded |
| `D` | Blue | In play, no out (hit or error on a play where batter reaches) |
| `E` | Blue | In play, error |
| `I` | Black | Intentional ball (part of IBB sequence) |
| `N` | Black | No pitch (balk, illegal pitch, or other non-pitch event) |
| `P` | Black | Pitchout |

**On `W` vs `S`:** Both are swinging strikes. The difference is whether the catcher catches the pitch. A `W` means the catcher blocked it but it hit the dirt first. On a third strike, a `W` code means the batter is entitled to run to first if first base is unoccupied or there are two outs (same rule as dropped third strike). The scoring notation for the at-bat outcome still begins with `K`, but the fielder sequence matters.

**On `T` (foul tip):** A foul tip is NOT the same as a foul ball. A foul tip goes directly off the bat into the catcher's glove and is caught. It counts as a strike in all counts, including strike three (which retires the batter). A foul ball caught in flight is a routine out; a foul tip caught on strike three is a strikeout. Both use `K` notation but the pitch sequence distinguishes them.

**Mini strike zone:** Drawn only if the at-bat has 10 or fewer pitches. Shows a rectangle representing the strike zone with dots for each pitch location, coloured by call code. The zone boundaries come from `szTop` and `szBot` in `pitchSequence` (batter-specific, from the API's `pitchData.strikeZoneTop` and `pitchData.strikeZoneBottom`).

**Count display:** Top-left of main cell area (e.g., "3-2", "0-1"). This is the count at the END of the at-bat, read from `play.count`.

---

## Baserunning Events in Diamonds

Stolen bases, caught stealing, wild pitches, passed balls, and balks are mid-inning baserunning events that occur between at-bats (or during an at-bat on a pitch that is not put in play). They do not appear as the `result.eventType` of any at-bat. In the GUMBO feed they appear as `play.result.type === "action"` events within `allPlays`.

These must be captured during the first pass of `buildScorecardGrid` and incorporated into the affected runner's journey segments.

### Action Event Types and Their Scoring

| `result.eventType` (action) | `advanceType` for segment | Diamond annotation |
|-----------------------------|---------------------------|-------------------|
| `stolen_base_2b` | `sb` | "SB" at 2B corner |
| `stolen_base_3b` | `sb` | "SB" at 3B corner |
| `stolen_base_home` | `sb` | "SB" at HP; fill diamond |
| `caught_stealing_2b` | `cs` | Red line to 2B, X at 2B |
| `caught_stealing_3b` | `cs` | Red line to 3B, X at 3B |
| `caught_stealing_home` | `cs` | Red line to HP, X at HP |
| `pickoff_1b` | `out` | X at 1B |
| `pickoff_2b` | `out` | X at 2B |
| `pickoff_3b` | `out` | X at 3B |
| `pickoff_caught_stealing_2b` | `cs` | Red line to 2B, X at 2B |
| `wild_pitch` | `wp` | "WP" annotation |
| `passed_ball` | `pb` | "PB" annotation |
| `balk` | `bk` | "BK" annotation |
| `defensive_indiff` | `hit` | No special annotation (treat as ordinary advance) |
| `runner_out` | `out` | X at `outBase` |

For all caught stealing and pickoff outs, set `isOut: true` and `outBase` to the base where the runner was retired. Draw the segment from the runner's current base to `outBase` in red, then draw an X at `outBase`.

---

## Earned Run Determination

The system currently pulls `ER` directly from the GUMBO boxscore, which reflects the official scorer's ruling. This is sufficient for display.

If you ever need to compute earned runs locally (for verification or override), the method is: reconstruct the half-inning removing all errors and passed balls. Any out that would not have occurred without the error is also removed. Recount the runs that score in the reconstructed inning. Runs that would not have scored without the error or passed ball are unearned (MLB Rule 9.16).

Three specific cases that trip up scorers:

1. A runner who reaches on an error scores two batters later. Even if subsequent hits were legitimate, that run is unearned because the runner should not have been on base.
2. The third out of an inning is "used up" by an error. If an error extends the inning and runs score after what would have been the third out, those runs are unearned even if no further errors occur.
3. An error on a foul fly ball. If a catcher drops a foul fly that would have been the third out and the batter subsequently scores, that run is unearned.

---

## Substitution System

### Building substitution data (game-data.js)

- `buildSubstitutionMap(allPlays, halfInning, lineup)`: scans action events for PH, PR, pitcher subs, defensive subs
- `buildSubNumberMap(boxscore, lineup, side)`: assigns circled numbers (①②③...) to each substitute

### Rendering substitution indicators (svg-renderer.js)

| Sub Type | Visual |
|----------|--------|
| Pitcher sub | Dashed blue line across top of cell |
| Pinch hitter (PH) | Solid blue line on left edge + circled number at bottom-left |
| Pinch runner (PR) | Solid blue line on right edge + circled number at bottom-right |
| Defensive sub | Solid blue line on right edge + circled number |

Label text appears at bottom of sub indicator area (P-SUB, PH, PR, D-SUB).

**Scoring rule for pinch hitters:** The pinch hitter takes the batting order slot of the player they replace. If the pinch hitter stays in the game defensively, they are now in the lineup permanently at that slot. If they are replaced immediately by a pinch runner, both the PH and the PR are recorded in the same slot, each with their own circled sub number.

**Scoring rule for double switches:** In a double switch, two players enter the game simultaneously, and the manager selects which batting order slots each takes. The incoming pitcher does not necessarily take the departing pitcher's slot. Record both players' new slots as assigned by the manager (available from the action event in the GUMBO feed).

---

## Lineup Rendering (svg-renderer.js)

Left margin (300px default) shows for each slot:
- Slot number (1-9)
- Player name in format: `LASTNAME-POSNUM` (e.g., "NETO-6")
- Bat side in parentheses: `(R)`, `(L)`, `(S)`
- Season stats: `AVG/OBP` (e.g., ".250/.400")
- Substitutes stacked below with blue separator line and circled sub number

---

## Per-Inning Summary Rows

Below the 9 lineup rows, summary rows show per-inning totals:
- R (runs), H (hits), E (errors), LOB (left on base)
- Data sourced from `linescore.innings[i]`

**On LOB:** A runner is left on base if the inning ends while they are still on base. A runner who is put out on the bases during the inning is NOT left on base. LOB counts only runners who were on base when the third out was recorded. The API provides this directly; no local computation needed.

---

## Confidence Indicators

Any time the system cannot determine the correct scoring notation with certainty, it sets `confidence: "low"` on the at-bat object and populates `confidenceNote` with a plain-language description of what was uncertain.

In the SVG renderer, a low-confidence at-bat gets a small `?` badge rendered in the top-right corner of the cell. The badge should be visually small (8px, lighter colour) so it does not compete with the notation, but present enough to catch a reviewer's eye.

Conditions that trigger `confidence: "low"`:

- `eventType` is not in the known map (UNKNOWN play type)
- FC or force_out notation was produced without fielder numbers (description parse also failed)
- Trajectory prefix defaulted to `F` because neither `hitData` nor description keywords were conclusive
- Dropped third strike reach (K+ notation) where the exact reason the batter reached could not be determined
- Any action event type not in the baserunning table above
- `result.description` was the sole source for fielder positions (credits array was empty)

The `confidenceNote` text is available as a tooltip or expandable detail in the UI if needed in a future iteration.

---

## HTML Components (svg-renderer.js exports)

These render as HTML (not SVG) and are inserted into the page by `scorecard.js`:

| Function | Output |
|----------|--------|
| `renderPitcherStatsHTML()` | Table: PITCHERS, IP, H, R, ER, BB, K, S, P with WP/LP/SV notes |
| `renderStartingPitcherHTML()` | SP info block: name, hand, record, ERA, WHIP, repertoire |
| `renderGameHeaderHTML()` | Team logos, records, R/H/E/LOB box, WP/LP/SV, venue/date/weather |
| `renderLinescoreHTML()` | Inning-by-inning R/H/E table |
| `renderBenchHTML()` | Bench players: POS, AVG, OBP, SLG, HR, RBI |
| `renderBullpenHTML()` | Bullpen: ERA, W-L, SV, HLD, IP, K, WHIP |
| `renderUmpiresHTML()` | HP, 1B, 2B, 3B umpire names |

---

## Theme System

CSS variables in `css/style.css` define all colours for light and dark modes. The SVG renderer reads these at render time via `getColors()`:

```js
function getColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    text: s.getPropertyValue('--sc-text').trim(),
    grid: s.getPropertyValue('--sc-grid').trim(),
    hit: s.getPropertyValue('--sc-hit').trim(),
    // ... etc
  };
}
```

Toggle via `js/theme.js`, which sets `data-theme="dark"` on `<html>`, persists to localStorage, and triggers rerender.

---

## Dev Mode & Fixtures

- URL param `?dev` activates dev mode (`js/api.js → isDevMode()`)
- `fixtures/index.json` maps gamePk → filename
- Primary test game: gamePk `777242` = LAA @ TOR, July 4 2025, 10 innings, 4-3 walkoff
- Dev mode schedule defaults to 2025-07-04

---

## API Reference

### MLB Stats API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/schedule?date=YYYY-MM-DD&sportId=1&hydrate=probablePitcher,linescore` | Daily schedule |
| `/api/v1.1/game/{gamePk}/feed/live` | Full GUMBO feed (plays, boxscore, linescore, gameData) |
| `/api/v1/standings?leagueId=103,104&season=YYYY&standingsTypes=regularSeason` | Standings |
| `/api/v1/teams/stats?season=YYYY&sportId=1&group=pitching,fielding&stats=season` | Team stats for rankings |
| `/api/v1/teams/{teamId}/coaches?season=YYYY` | Coaches roster |

**On endpoint versions:** The GUMBO feed (`/v1.1/`) is the authoritative source for all play and game data. Do not mix calls to `/v1/game/{gamePk}/playByPlay` with GUMBO data; that endpoint uses slightly different field names for runner movement (`movement.start` vs `movement.originBase`). All runner movement logic in this system assumes GUMBO field names.

### GUMBO Feed Structure (key paths)

```
data.gameData          - game metadata, teams, players, venue, weather, datetime
data.gameData.players  - all player info (keyed by "ID{number}")
data.liveData.plays.allPlays[]     - every play in game order
data.liveData.plays.currentPlay    - live game current play
data.liveData.boxscore.teams.{away|home}  - box score per team
data.liveData.linescore            - inning-by-inning scores
data.liveData.decisions            - winner/loser/save pitcher IDs
```

### Play Object Structure (allPlays[])

```
play.result.type        - "atBat" | "action"
play.result.event       - "Single", "Strikeout", "Groundout", etc.
play.result.eventType   - "single", "strikeout", "field_out", etc.
play.result.description - full text description
play.result.rbi         - RBI count
play.about.inning       - inning number
play.about.halfInning   - "top" | "bottom"
play.about.isTopInning  - boolean
play.matchup.batter.id  - batter player ID
play.matchup.pitcher.id - pitcher player ID
play.playEvents[]       - pitch-by-pitch events
play.runners[]          - all runner movements for this play
  .movement.originBase  - null (batter) | "1B" | "2B" | "3B"
  .movement.end         - "1B" | "2B" | "3B" | "score"
  .movement.isOut       - boolean
  .details.runner.id    - runner player ID
  .details.event        - event description
  .credits[]            - fielders who recorded outs or assists on this runner's movement
    .position.code      - fielder position number as a string ("6", "3", etc.)
    .credit             - "f_assist" | "f_putout"
```

**On `play.result.type === "action"`:** Action events include stolen bases, caught stealing, pickoffs, wild pitches, passed balls, balks, pitching changes, pinch hitters, and pinch runners. They share the same object structure as at-bat plays but have no `pitchSequence` for the play itself (though they occur at a specific point in the pitch sequence of the surrounding at-bat, indicated by their position in `allPlays`). Always process action events in sequence with at-bat events during the first pass of `buildScorecardGrid`.

---

## Known Gaps and Remaining Work

All 8 original gaps have been addressed. Summary of fixes:

1. **FC/Force Out fielder numbers:** ✅ Fixed. `parseFieldersChoice()` extracts fielder chain from `play.runners[].credits` array. Falls back to description parsing.
2. **Runner-out indicators on diamonds:** ✅ Fixed. Out segments render in red (`CLR.out`), X marker drawn at `outBase` coordinates. Segments carry `isOutSegment` flag.
3. **Stolen base / caught stealing on diamonds:** ✅ Fixed. Runner event field is parsed for advance type (`sb`, `cs`, `wp`, `pb`, `bk`). Segments carry `advanceType`. Annotations show "SB", "WP", etc. instead of base letters for non-hit advances.
4. **DP notation prefix:** ✅ Fixed. `parseDoublePlay()` detects trajectory from description (ground/line/fly/pop) and uses appropriate prefix with hyphenated fielders (e.g., `G6-4-3`).
5. **Solo HR diamond not rendering:** ✅ Fixed. `alwaysDiamond` flag forces diamond rendering for HR, HBP, and CI events regardless of `hasRunners`.
6. **Dropped third strike (W pitch code):** ✅ Fixed. `parseStrikeout()` checks if batter reached 1B on a strikeout and appends `WP`, `PB`, or `E2` to the K notation.
7. **Infield fly rule:** ✅ Fixed. `parseFieldOut()` appends `(IFF)` when description contains "infield fly".
8. **Runner annotation logic:** ✅ Fixed. Annotations now show the advance event type (SB, WP, CS, PB, BK) for non-hit advances instead of generic base path labels.

---

## How to Run

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
                     # Add ?dev for fixture data

npm run build        # Production build to dist/
npm run preview      # Preview production build
```

**Test URLs:**
- Game picker: `http://localhost:5173/?dev`
- Scorecard: `http://localhost:5173/game.html?gamePk=777242&date=2025-07-04&dev`
