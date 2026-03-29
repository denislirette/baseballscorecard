# Substitutions

A manager can replace any player at any time. The scorecard captures exactly when and how each substitution happened using dotted lines in the play cells.

All substitution indicators use the same visual pattern: **5px squares with 4px gaps**. The position of the line tells you the type of sub and when it happened.

## The rule

The dotted line is a boundary marker. It separates what happened before from what happened after. Where the line sits in the play cell tells you when the substitution occurred relative to the play.

- **Left side** = the sub happened BEFORE the play in that cell
- **Right side** = the sub happened AFTER the play in that cell

The left edge of a cell is also the right edge of the previous inning's cell. So a line "between innings" sits at that shared boundary.

## Pinch hitter (PH)

A pinch hitter replaces the scheduled batter before the at-bat begins.

**Line position**: LEFT side of the play cell.

The line is on the left because it's the entry door. The pinch hitter walks in, then everything to the right of the line (pitch sequence, notation, diamond) is what they did.

**In the lineup**: the PH appears below the player they replaced, separated by a horizontal dotted line. The label "PH" appears before their name.

## Pinch runner (PR)

A pinch runner replaces a batter who already reached base.

**Line position**: depends on when the sub happened.

- If the PR entered **during the inning** (after the original batter reached base): RIGHT side of the play cell. The play in the cell is what the original batter did. The PR takes over from there.
- If the PR entered **before the inning started** (replacing a designated runner): LEFT side. The sub happened before any play, so the line sits at the inning boundary.

**In the lineup**: the PR appears below the player they replaced, separated by a horizontal dotted line. The label "PR" appears before their name.

## Designated runner (DR)

In extra innings (10th inning and beyond), MLB rules place a runner on second base automatically. The runner is the batter in the lineup immediately before that half-inning's leadoff hitter.

**How it renders**:

- The designated runner gets their own cell in their lineup slot for that inning
- The diamond shows HP to 1B to 2B already drawn (they're on second by rule)
- "DR" appears below the diamond as the notation
- No count, no pitch sequence (they never batted)
- A PH-type sub line appears on the left side of the cell (the sub happened before the inning)

**When a PR replaces the DR**: teams often substitute a faster pinch runner for the designated runner before the first pitch. When this happens:

- The PR gets the DR cell, not the original designated runner
- The PR's diamond shows the HP to 1B to 2B path
- The sub line is on the LEFT (the replacement happened before any play)
- The original designated runner gets no cell (they were never actually on the field)
- Only one sub line appears, not two

Example from ATH @ TOR, March 28 2026, inning 11 bottom:
1. MLB rule places Okamoto on 2B (he's before the leadoff hitter in the order)
2. Blue Jays immediately send Lukes as PR for Okamoto
3. Lukes' cell shows: DR diamond with HP-1B-2B path, sub line on left
4. Okamoto has no cell for inning 11

## Pitcher changes

When a new pitcher enters the game, a horizontal dotted line appears at the **bottom** of the cell where the departing pitcher threw their last pitch.

The line includes accumulated stats: `strikes / total pitches / strikeouts`

Example: `42 / 68 / 5K` means 42 strikes out of 68 pitches, with 5 strikeouts.

## Defensive switches

When a player moves to a new defensive position (left fielder moves to center field, etc.), no line appears in the play cells. The change is reflected in the lineup display only.

A defensive switch can never create a sub line in a play cell. This prevents false double lines.

## Rules summary

1. **PH = LEFT** side. Sub happened before the at-bat.
2. **PR = RIGHT** side when replacing a batter who just reached base during a play.
3. **PR = LEFT** side when replacing a designated runner before the inning starts.
4. **DR = LEFT** side. Placed on 2B by rule before the inning.
5. **One player = one line.** A single player cannot show two sub lines in the same cell.
6. **Two lines on one cell** only happen when two different players substitute in the same at-bat (rare).
7. **Pitcher lines** are horizontal at the bottom of the cell.
8. **Defensive switches** never create play cell lines.
9. All sub lines use the same 5px dotted square pattern and color token (`var(--sc-sub)`).
10. **PR replacing DR**: the PR gets the DR cell. The original designated runner gets no cell. One line total.
