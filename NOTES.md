# Baseball Scorebook — Development Notes

## Session: March 7, 2026

### Cell Editor (WYSIWYG)
- Built `cell-editor.html` — standalone visual editor for individual play cells
- Draggable handles for pitch column divider, diamond center/radius, strike zone, count text, cell resize
- Scroll-to-zoom, scenario picker (K, BB, 1B, HR, DP, overflow, etc.)
- "Save to System" button writes config back to `layout-config.js` via Vite plugin POST endpoint
- All rendering logic mirrors `svg-renderer.js`

### Pitch Column Overhaul
- 3-column layout: call code (C/B/F/X), pitch type (FF/SL/CU), speed (95/84/78)
- Pitch type centered in column to prevent overlap with 100+ mph speeds
- Comfortable fit for 10 pitches; strike zone hidden on overflow (>10 pitches)
- Strike zone enlarged to bottom 1/3 of pitch column, portrait aspect ratio (1:1.4)

### Strike Zone Calibration
- Widened coordinate mapping ranges (PX_RANGE 3.0->4.0, PZ 0.5-4.5->0.0-5.0)
- Zone box now ~41% of plot width, ~36% of plot height (was 55%/45%)
- Dots cluster tighter around zone, matching real broadcast strike zone overlay feel
- Uses actual szTop/szBot from pitch data via averageZoneEdge()

### Diamond & Runner System
- Cumulative runner journeys: tracks full path across multiple at-bats within an inning
- Runner annotations always OUTSIDE diamond, no dashes (H1, 23H, H123H)
- Diamond only drawn when there are actual runners; notation larger when no diamond
- Base path width bumped to 7px for visibility
- Annotation font scales down for longer labels (14->12->10), clamped to cell boundaries

### Play Notation
- Double play: DP + fielders (DP643, DP64) — was G643
- Strikeout double play: KDP23 or backwards-K DP23
- Triple play: TP + fielders
- K notation extra-large filling diamond area
- Starting pitcher K subscript counter (K1, K2, K3...) — stops counting after pitching substitution
- All no-diamond notations use same large font as K, with overflow capping via maxFitSize()
- With-diamond notations smaller (24/20/16/14) to not overpower base paths

### RBI Indicator
- Shows "RBI" or "2RBI" etc. in green at top-right corner of play cell
- Data sourced from play.result.rbi in GUMBO feed

### Substitution Labels
- Abbreviated text at bottom of play cell: P-SUB, PH, PR, D-SUB
- Dashed top line (pitcher), solid left line (PH), solid right line (PR/defensive)
- Circled sub numbers on edges

### Text Overflow Prevention
- maxFitSize() caps all notation font sizes based on available main area width
- Runner annotations clamped to cell boundaries (left, right, top, bottom)
- Annotation font scales by text length
- Applied consistently across svg-renderer.js, cell-editor.html, cell-reference.html

### Legend Page
- Accessible via header button on game page (Legend, Standings, Dark — consistent styling)
- Sections: Pitch Call Codes, Pitch Types, Play Notation, Fielding Positions, Batter Stats, Summary Rows, Pitch Colors, Cell Indicators, Runner Annotations, Count & Strike Zone

### Layout Config
- COL_WIDTH: 243, ROW_HEIGHT: 243, DIAMOND_R: 65, PITCH_COL_W: 66
- Vite plugin at POST /api/save-layout for cell editor persistence

### Other
- cell-reference.html updated with all new cell states (DP643, KDP23, etc.)
- All three rendering files (svg-renderer, cell-editor, cell-reference) kept in sync

---

## To Do (Next)

### Typography Pass
- Review and adjust font sizes, weights, and spacing across the entire scorecard
- Ensure hierarchy: player names > notation > annotations > metadata
- Consider condensed fonts for tight spaces

### Advanced Batting Stats (ABS)
- Investigate if GUMBO feed provides advanced stats (exit velocity, launch angle, xBA, barrel%)
- If available, add as optional overlay or tooltip on hit cells
- Check statcast endpoint availability

### Expand/Collapse UX
- Add collapsible sections for easier navigation on the game page
- Candidates: pitcher stats tables, bench/bullpen lists, legend overlay sections
- Consider accordion-style or toggle visibility per section
- Mobile-friendly — important for smaller viewports
