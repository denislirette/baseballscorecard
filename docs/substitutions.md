# Substitutions

Substitutions are a core part of baseball strategy. A manager can replace any player at any time, and the scorecard needs to capture exactly when and how each substitution happened.

All substitution indicators on BaseballScorecard.org use the same visual pattern: **small dotted squares** (5px squares with 4px gaps). The position of the line tells you what type of sub occurred and when it happened relative to the at-bat.

## Pinch hitter (PH)

A pinch hitter replaces the scheduled batter before the at-bat begins. The manager sends a different player to bat in their place.

**Visual**: Dotted line on the **LEFT side** of the play cell.

The line is on the left because it represents the "entry door" — the sub walks in before the play happens. Everything to the right of the line (the at-bat result, pitch sequence, diamond) is what the pinch hitter did.

## Pinch runner (PR)

A pinch runner replaces a batter who has already reached base. The original batter stays in the dugout and a faster runner takes their place on the bases.

**Visual**: Dotted line on the **RIGHT side** of the play cell.

The line is on the right because it represents the "exit door" — the sub enters after the at-bat result. The play in the cell is what the original batter did; the pinch runner takes over from there.

## Pitcher changes

When a new pitcher enters the game, a horizontal dotted line appears at the **bottom** of the cell where the departing pitcher threw their last pitch.

The line includes accumulated stats for the departing pitcher:
`strikes / total pitches / strikeouts`

For example, `42 / 68 / 5K` means the pitcher threw 42 strikes out of 68 total pitches, with 5 strikeouts.

## Defensive switches

When a player moves to a new defensive position (e.g., left fielder moves to center field), no line is drawn in the play cells. The change is reflected in the lineup display only.

A defensive switch event can never overwrite a PH or PR substitution type. This prevents a bug where a pinch hitter's line would disappear when they take the field in the next half-inning.

## Rules summary

1. **PH = LEFT** side of the cell. Sub happens before the at-bat.
2. **PR = RIGHT** side of the cell. Sub happens after the at-bat.
3. **One player = one line.** A single player cannot be both PH and PR.
4. **Two lines on one cell** are only possible when two different players substitute (rare).
5. **PH/PR types are never overwritten** by defensive switch events.
6. **Pitcher sub lines** appear at the bottom of cells, with stats when available.
7. **All sub lines** use the same 5px dotted square pattern and color.
8. **In bat-around situations** (batter comes up twice in the same inning), PH/PR lines are suppressed to avoid visual clutter.
