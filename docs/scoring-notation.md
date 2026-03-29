# How to Read a Scorecard

For detailed explanations of common plays with field context, see [Common Plays Explained](common-plays.md).

Every play on a baseball scorecard is captured as a short code that tells you exactly what happened.

## Position numbers

Every fielder has a number. All scoring notation builds on these.

| # | Position | # | Position |
|---|----------|---|----------|
| 1 | Pitcher (P) | 6 | Shortstop (SS) |
| 2 | Catcher (C) | 7 | Left Field (LF) |
| 3 | First Base (1B) | 8 | Center Field (CF) |
| 4 | Second Base (2B) | 9 | Right Field (RF) |
| 5 | Third Base (3B) | | |

When you see `G6-3`, it means: ground ball fielded by the shortstop (6), thrown to the first baseman (3) for the out. The numbers trace the ball's path through the fielders' hands.

## Outs and contact

| Notation | Meaning | Example |
|----------|---------|---------|
| `K` | Strikeout swinging | Batter swung and missed on strike 3 |
| `ꓘ` | Strikeout looking | Umpire called strike 3 without a swing (backwards K) |
| `F8` | Fly out to CF | Fly ball caught by center fielder |
| `L7` | Line out to LF | Line drive caught by left fielder |
| `P4` | Pop out to 2B | Pop fly caught by second baseman |
| `G6-3` | Ground out SS to 1B | Grounder to shortstop, thrown to first |
| `G4-3` | Ground out 2B to 1B | Grounder to second baseman, thrown to first |

**Prefixes**: `F` = fly ball, `L` = line drive, `P` = pop up, `G` = ground ball. The prefix describes the trajectory of the ball off the bat.

## Hits

| Notation | Meaning | On the diamond |
|----------|---------|----------------|
| `1B` | Single | Path drawn HP to 1B, 1 hash mark |
| `2B` | Double | Path drawn HP to 2B, 2 hash marks |
| `3B` | Triple | Path drawn HP to 3B, 3 hash marks |
| `HR` | Home Run | Solid filled black diamond |

Hash marks are short perpendicular lines drawn across the home-to-first segment. The count matches the base reached.

## Walks and hit by pitch

| Notation | Meaning |
|----------|---------|
| `BB` | Base on balls (walk), 4 balls, batter takes first |
| `IBB` | Intentional walk, pitcher deliberately walks the batter |
| `HBP` | Hit by pitch, pitch hits the batter, takes first |
| `CI` | Catcher's interference, batter awarded first |

These render in heavy weight (900) because reaching base without contact is significant.

## Double plays and triple plays

| Notation | Meaning |
|----------|---------|
| `DP6-4-3` | Double play: SS to 2B to 1B |
| `DP5-4-3` | Double play: 3B to 2B to 1B |
| `DP4-6-3` | Double play: 2B to SS to 1B |
| `TP5-4-3` | Triple play: 3B to 2B to 1B |
| `KDP` | Strikeout double play (K + runner caught) |

In a double play, the batter's cell shows only the batter's out number. The other runner's out appears in their own cell. The same out number never appears twice in the same inning.

## Sacrifice plays

| Notation | Meaning |
|----------|---------|
| `SH5-4` | Sacrifice bunt: 3B to 2B. Batter is out but advances a runner. |
| `SF8` | Sacrifice fly to CF. Fly out that scores a runner from third. |
| `FC6-3` | Fielder's choice. Batter reaches base; fielder chose to retire a different runner. |

## Runner events

These happen to runners already on base during another batter's plate appearance.

| Notation | Meaning |
|----------|---------|
| `SB` | Stolen base |
| `CS` | Caught stealing |
| `PO` | Pickoff |
| `WP` | Wild pitch, runner advances on an errant pitch |
| `PB` | Passed ball, runner advances on a missed catch by the catcher |
| `BK` | Balk, illegal pitching motion, all runners advance one base |
| `OBS` | Obstruction |

## Errors

| Notation | Meaning |
|----------|---------|
| `E6` | Error by shortstop, batter reaches base on a fielding mistake |
| `E9` | Error by right fielder |
| `E2` | Error by catcher |

## Special cases

| Case | Notation | What happened |
|------|----------|---------------|
| Called third strike | `ꓘ` | Backwards K, umpire called strike 3 without a swing |
| Dropped third strike | `K WP` | Strikeout but batter reaches 1B (catcher didn't hold the ball) |
| Infield fly rule | `F9(IFF)` | Fly out with infield fly rule in effect |
| Fielder's choice | `FC6-3` | Batter reaches; fielder retired a different runner |
| Designated runner | `DR` | Extra innings automatic runner placed on 2B by MLB rule |
