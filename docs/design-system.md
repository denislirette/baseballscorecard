# Design System

Every visual decision on BaseballScorecard.org follows these rules. If something looks different from the rest of the site, it's a bug.

## Color Palette

### Light Mode

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![text-dark](assets/swatches/text-dark.svg) | `--sc-text` | `#1c1918` | Primary text, diamond outlines |
| ![text-light](assets/swatches/text-light.svg) | `--sc-text-light` | `#6b6462` | Secondary text, stats |
| ![bg-light](assets/swatches/bg-light.svg) | `--sc-bg` | `#faf9f6` | Page background |
| ![surface](assets/swatches/surface.svg) | `--sc-cell-bg-empty` | `#e8e6e1` | Empty cells, header backgrounds |
| ![future](assets/swatches/future.svg) | `--sc-cell-bg-future` | `#f2f0ec` | Future inning cells |
| ![grid-line](assets/swatches/grid-line.svg) | `--grid-line` | `#868278` | All borders and dividers |
| ![green](assets/swatches/green.svg) | `--sc-scored` | `#377049` | Scored runners, active states, in-play pitches |
| ![red](assets/swatches/red.svg) | `--sc-out` | `#a04a49` | Out paths, strike pitch color |
| ![sub-light](assets/swatches/sub-light.svg) | `--sc-sub` | `#44403a` | Substitution indicators (light mode) |
| ![pitcher-line](assets/swatches/pitcher-line.svg) | `--sc-pitcher-line` | `#2a6d8d` | Pitcher change lines |
| ![challenge](assets/swatches/challenge.svg) | `--sc-challenge` | `#7B2D8E` | ABS challenge badges |
| ![active-cell](assets/swatches/active-cell.svg) | `--sc-active-cell` | `#e0f0e4` | Live batter cell highlight |

### Dark Mode

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| ![text-dark-mode](assets/swatches/text-dark-mode.svg) | `--sc-text` | `#f5f2e9` | Primary text |
| ![text-dark](assets/swatches/text-dark.svg) | `--sc-bg` | `#1c1918` | Page background |
| ![cell-dark](assets/swatches/cell-dark.svg) | `--sc-cell-bg` | `#292524` | Play cell background |
| ![grid-dark](assets/swatches/grid-dark.svg) | `--grid-line` | `#7e7a76` | Borders |
| ![sub-dark](assets/swatches/sub-dark.svg) | `--sc-sub` | `#d4d0c8` | Substitution indicators (dark mode) |

All colors are CSS custom properties on `:root` and `[data-theme="dark"]`. Theme switching toggles the `data-theme` attribute on `<html>`. No JavaScript needed for the swap itself.

## Brand Colors

| Swatch | Name | Hex | Where |
|--------|------|-----|-------|
| ![green](assets/swatches/green.svg) | Primary Green | `#377049` | Scored runners, active states, refresh bar |
| ![text-dark](assets/swatches/text-dark.svg) | Stone Dark | `#1c1918` | Text, nav bar, diamond outlines |
| ![grid-line](assets/swatches/grid-line.svg) | Stone Mid | `#868278` | Grid lines, structure |
| ![bg-light](assets/swatches/bg-light.svg) | Stone Light | `#faf9f6` | Backgrounds |

## Typography

**Font stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif`

**Body size**: `clamp(1rem, 1.5vw + 0.75rem, 1.375rem)` (responsive, scales with viewport)

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Team name (section header) | `2.25em` | 700 | Logo + name, scales to `1.25em` on mobile |
| Lineup player name | `clamp(1.1rem, 0.8vw + 1rem, 1.5rem)` | 800 (starter), 600 (sub) | Responsive |
| Table data | `1em` | 400 | All `pitcher-stats-table` content |
| Table header | `1em` | 700 | Column headers |
| Section title header | `1.1em` | 700 | Spanning headers like "Tigers BULLPEN (12)" |
| Pitch sequence | Monospace | 400/700 | 700 for in-play pitches |
| Scoring notation (large) | `largeSize * 0.6` | 400 | G6-3, F8, L7 |
| Scoring notation (walks) | `largeSize * 1.0` | 900 | BB, IBB, HBP |
| Footer fine print | `0.85em` | 400 | Copyright text |

### Rules

- Never combine bold AND italic on the same element
- Team abbreviations (NYY, SF) are never bold in tables
- Only full team names in section headers are bold
- All table data is left-aligned, never centered

## Links

All links use underline styling with these tokens:

| State | Color | Decoration |
|-------|-------|------------|
| Default | `var(--link)` | Underline, 2px offset |
| Hover | `var(--link-hover)` | Thicker underline |
| Visited | `var(--visited)` | Purple tint |

External links (player names) include a small external icon SVG indicating the link opens in a new tab. Player links go to [Baseball Savant](https://baseballsavant.mlb.com) statcast pages.

## Borders

| Use | Style | Notes |
|-----|-------|-------|
| All structural borders | `1px solid var(--grid-line)` | Tables, cards, sections |
| Square corners | `border-radius: 0` | Everywhere, no exceptions |
| Drop shadows | None | Never used |
| Linescore RHE separator | `2.5px solid var(--text)` | Only exception to 1px rule |
| Scorecard grid bold lines | `2.5px` | Row/inning boundaries |
| Scorecard grid thin lines | `0.75px` | Bat-around sub-columns |

## Grid System

The main site uses flexbox for layout, not CSS grid (except the standings page and game cards).

| Layout | Desktop | Mobile |
|--------|---------|--------|
| W-L table + Linescore | Side by side (35% / 65%) | Stacked |
| Game Info / Weather / Umpires | 3 columns, `flex: 1` each | Stacked |
| Team stats (AVG, ERA, etc.) | Horizontal flex row | Stacked, full width |
| Standings | 2-column CSS grid | 1 column |
| Game cards | Wrapping flex | Full width |

`body { overflow-x: hidden }` prevents horizontal page scroll. Wide tables scroll inside their own containers.

## Tables

All data tables use `pitcher-stats-table` for consistent styling:

- `1px` cell borders using `var(--grid-line)`
- Left-aligned data
- Header row with `var(--surface)` background
- Header font weight: 700
- Section title rows are `1.1em`, larger than column headers
- Data font: tabular-nums for number alignment

## Substitution Lines

All sub indicators use the same pattern:

- **5px squares** with **4px gaps**
- Color: `var(--sc-sub)` (dark on light, bright on dark)
- WCAG AA contrast: 9:1+ ratio in both themes

Used in:
- Play cell PH/PR vertical lines
- Lineup horizontal dividers between players
- Stats column horizontal dividers
- Pitcher change horizontal lines (with stats label in center)

See [Substitutions](substitutions.md) for placement rules.

## Indicator Icons

All indicators share the same base size (`SUB_CIRCLE_R`):

| Icon | Shape | Where | Size |
|------|-------|-------|------|
| Out badge | Numbered circle (1/2/3) | Top-left of play cell | `SUB_CIRCLE_R * 1.45` |
| RBI diamond | Small filled diamond | Bottom-left of play cell | `SUB_CIRCLE_R` |
| Sub letter | Letter (A, B, C) | Lineup area only | `SUB_CIRCLE_R` |
| HR diamond | Large filled diamond | Center of play cell | `DIAMOND_R` (larger, separate) |

## Play Cell Anatomy

See [The Play Cell](play-cell.md) for the full breakdown. Key zones:

- **Top-left**: Out badge
- **Top-right**: Count + pitch column
- **Center**: Diamond or notation
- **Bottom-left**: RBI diamonds
- **Bottom-right**: Mini strike zone
- **Left edge**: PH sub line
- **Right edge**: PR sub line
- **Bottom edge**: Pitcher change line

## Loading Bar

Rainbow gradient progress bar at the top of the page during data loading.

- **Gradient**: red → orange → green → blue → purple
- **Height**: 4px
- **Delay**: appears after 1 second (no flash for fast loads)
- **Animation**: 0% to 90% width over 2 seconds, then snaps to 100% and fades
- **Pages**: game, schedule, standings

## Team Logos

Displayed for educational purposes. All logos are the trademark and property of their respective owners.

- 30 teams, SVG format
- Light mode variants: `/img/logos/light/{teamId}.svg`
- Dark mode variants: `/img/logos/dark/{teamId}.svg`
- Auto-swap via CSS: `.team-logo-light` visible in light mode, `.team-logo-dark` in dark mode
- `vertical-align: middle` for alignment with text at any size
- Source: MLB Static (`mlbstatic.com/team-logos/team-cap-on-light/` and `team-cap-on-dark/`)

## Responsive Breakpoints

| Breakpoint | What changes |
|------------|-------------|
| Desktop (> 900px) | Side-by-side layouts, full subnav sidebar |
| Tablet (< 900px) | Stacked layouts, subnav hidden |
| Mobile (< 480px) | Full-width everything, day name hidden in date picker, team stats tables 100% width |

## Accessibility

- WCAG AA contrast ratios on all text and UI components
- Skip-to-content link (first focusable element)
- `tabindex="-1"` on `<main>` for skip link focus
- `aria-label` on all interactive elements
- `aria-live="polite"` on auto-refresh status
- `role="switch"` / native checkbox for auto-refresh toggle
- Keyboard navigation: all interactive elements reachable via Tab
- See [Accessibility](ACCESSIBILITY.md) for the full statement
