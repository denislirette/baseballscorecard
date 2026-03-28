# Design System

A strict set of visual rules that maintain consistency across every page and component. Any new element should look like it belongs. If something looks different from the rest of the site, it's a bug.

## Core principles

- **Apple-inspired minimalism**: clear, legible, utility-focused. No decoration that doesn't serve a purpose.
- **Consistency over novelty**: reuse existing patterns. Never introduce a new style when an existing one fits.
- **Accessibility first**: WCAG AA contrast ratios everywhere. Keyboard navigation. Screen reader support.

## Borders

- All structural borders: `1px solid var(--grid-line)`
- Square corners always, `border-radius: 0`
- No drop shadows anywhere
- The only exception: the linescore R/H/E separator uses `2.5px` to visually separate inning scores from totals

## Typography

- Never combine bold AND italic on the same element. Use one or the other.
- Team abbreviations (NYY, SF, etc.) are **never bold** in tables
- Only full team names in section headers are bold
- All table data is **left-aligned** (never centered, centered data is harder to scan)

## Tables

All data tables use the `pitcher-stats-table` class for consistent styling:
- `1px` cell borders using `var(--grid-line)`
- Left-aligned data
- Header row with `var(--surface)` background
- Section title rows (spanning headers) are `1.1em`, larger than column headers to create hierarchy

## Substitution lines

All substitution indicators use the same pattern everywhere:
- **5px squares** with **4px gaps**
- Same color token: `var(--sc-sub)`
- Used in: play cell PH/PR lines, lineup horizontal dividers, stats column dividers, pitcher change lines

## Indicator icons

All indicator icons share the same base size (`SUB_CIRCLE_R`) for visual consistency:
- Out badges (numbered circles)
- RBI diamonds (small filled diamonds)
- Sub letters (A, B, C in lineup area)

The HR diamond is intentionally larger. It's separate from indicator sizing.

## Team logos

Team logos are displayed for educational purposes to help users identify teams. They are the trademark and property of their respective owners.

- Light mode: cap logos optimized for light backgrounds
- Dark mode: cap logos optimized for dark backgrounds
- Swap is automatic via CSS class toggling
- `vertical-align: middle` ensures logos center with text at any size

## Loading bar

Rainbow gradient progress bar shown at the top of the page while data loads:
- Colors: red, orange, green, blue, purple gradient
- Appears after a 1-second delay (no flash for fast loads)
- Animates from 0% to 90%, then snaps to 100% and fades
- Height: 4px
- Present on all data-loading pages (game, schedule, standings)

## Color tokens

All colors are defined as CSS custom properties on `:root` and `[data-theme="dark"]`. Theme switching needs no JavaScript, just toggle the `data-theme` attribute on `<html>`.

Key tokens:
- `--sc-text`: primary text and diamond outlines
- `--sc-bg`: page background
- `--sc-cell-bg`: play cell background
- `--sc-cell-bg-empty`: empty cell background (slightly darker)
- `--sc-grid-line`: all structural borders
- `--sc-sub`: substitution indicator color
- `--sc-pitch-strike`: red for strikes
- `--sc-pitch-in-play`: green for balls in play
- `--sc-pitch-ball`: dark for balls
- `--sc-challenge`: purple for ABS challenge badges

## Responsive design

- Desktop: side-by-side layouts (W-L table 35%, linescore 65%)
- Tablet (< 900px): stacked layouts
- Mobile (< 480px): full-width everything, day name hidden from date picker
- `body { overflow-x: hidden }` prevents horizontal scroll at any viewport
- Wide tables (linescore, W-L comparison) scroll within their own containers
