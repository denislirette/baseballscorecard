# The Play Cell

The play cell is the fundamental unit of the scorecard. Each cell represents one batter's plate appearance in one inning.

## Zones

A play cell is divided into distinct zones:

- **Top-left**: Out badge — a numbered circle (1, 2, or 3) showing which out of the inning
- **Top-right**: Count (balls-strikes) and the pitch sequence column
- **Center**: Diamond showing base runner paths, or large notation text when no runners are involved
- **Below diamond**: Scoring notation (e.g., G6-3, DP543)
- **Bottom-left**: RBI indicator diamonds (one per run batted in)
- **Bottom-right**: Mini strike zone showing pitch locations (when 10 or fewer pitches)
- **Left edge**: PH (pinch hitter) sub line — dotted, indicates sub before the at-bat
- **Right edge**: PR (pinch runner) sub line — dotted, indicates sub after the at-bat
- **Bottom edge**: Pitcher change line with stats (strikes / pitches / strikeouts)

## Count

The count displays as `B-S` (balls-strikes). It shows the count at the moment the at-bat ended.

**Calculation rules:**
- Balls: count `B` and `*` pitch codes
- Strikes: count `C`, `S`, `F`, `W`, `T` — but cap at 2
- Foul balls after 2 strikes do not increment the strike count

## Out badge

A numbered circle in the top-left corner. The number (1, 2, or 3) indicates which out of the half-inning this at-bat produced. Only appears when the batter (or a runner during the at-bat) made an out.

## Third-out notch

A diagonal line in the bottom-right corner of the cell where the third out occurs. This marks the end of the half-inning — a traditional scorekeeping convention that tells you at a glance where each inning ended.

## RBI diamonds

Small filled diamonds in the bottom-left area. One diamond per run batted in. All indicator icons (out badges, RBI diamonds, sub letters) share the same base size for visual consistency.
