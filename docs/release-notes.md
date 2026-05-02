# Release Notes

Every version of BaseballScorecard.org, from the first render to the latest update.

## v1.3.1 (May 2, 2026)

- **Bat-around out marker fix**: when the same batter came up twice in one inning (e.g., Toronto's 8th vs. Minnesota), the out indicator was rendering on both PA cells. The first PA's journey was being mutated by the second PA's out info. Each PA's journey is now snapshotted before the next PA starts, so the marker only shows on the cell where the out actually happened.

## v1.3.0 (May 2, 2026)

- **True pitch-by-pitch trickle**: each pitch glyph now appears individually as its real timestamp crosses the delayed cutoff, instead of an at-bat's pitches all flashing in together. The active cell fills up one pitch at a time, broadcast-style.
- **Hide the result until the play ends**: while an at-bat is in progress in the delayed view, the diamond, scoring notation, RBI digit, and runner advances stay hidden. They appear only when the play's `endTime` crosses the cutoff — no spoilers between pitches.
- **No more 30-second snap renders**: the API fetch and the on-screen render are now decoupled. The 30s background fetch silently tops up the cache; the 1s trickle ticker is the only thing that paints. Plays no longer batch up between fetches.
- **Surgical DOM morph**: replaced the wholesale subtree swap with an in-place morph that only mutates changed text/attributes/nodes. No flash on auto-refresh, scroll position and `<details>` open state preserved natively.
- **Active-cell highlight follows Live mode**: green fill + 3px border when Live is on (it pops during a watch-along); no fill, 5px inner border when Live is off (subtle, doesn't disturb pitch glyphs in the surrounding cells).
- **Stream delay reduced to 45s** from 60s — closer to a typical broadcast lag while still keeping the page behind the TV.

## v1.2.0 (May 2, 2026)

- **Live toggle in header**: red "● Live" button next to the dark mode toggle, persistent across the home and game pages, persists via localStorage
- **Opt-in auto-refresh**: pages no longer poll the MLB API by default — turn the Live toggle on to refresh every 15 seconds, off to freeze the view
- **60-second stream delay**: when Live is on, the scorecard renders 60 seconds behind the broadcast so the page doesn't out-pace the TV; only filters live in-progress games, not finals
- **Reading order in games grid**: schedule cards now flow left-to-right, top-to-bottom (CSS Grid) instead of column-first, matching how readers scan a page
- Auto-refresh polling on the schedule page only runs while viewing today's date — no more pointless re-fetches of past schedules

## v1.1.2 (April 28, 2026)

- **Empty thumbnails** for unstarted games so every card has a scorecard frame, not just the started ones
- **Responsive list view**: compact rows reflow at narrow widths

## v1.1.1 (April 28, 2026)

- **Stream delay removed** pending re-design — auto-delay logic had bugs that needed to be reworked before re-shipping

## v1.1.0 (April 28, 2026)

- **Schedule view toggle**: switch the homepage between thumbnails and a compact list, persists via localStorage
- **List view**: single-column rows with team logos, status pill, and score, left-aligned with a 720px cap so rows stay readable on wide monitors
- **Material Symbols icons** for the toggle, sized to match the date navigation buttons
- Removed Buy Me a Coffee link from the footer nav
- **Play cell blanking fix**: filter by startTime instead of endTime so live cells don't briefly clear
- **Live-only delay**: skip no-op re-renders and only apply the delay on live games
- **Standings layout**: always stack East/Central/West with AL first, NL second, in DOM order
- Updated golden screenshots for the standings single-column layout

## v1.0.1 (March 30, 2026)

- **Stream delay moved to global nav**: stopwatch icon with popup picker, available on every page
- **Auto-refresh bar removed** from game page (redundant with nav delay controls)
- **Delay bar removed** from schedule page date row (consolidated into nav)

## v1.0.0 (March 29, 2026)

- **Stream delay**: filter plays by timestamp to sync scorecard with delayed live streams, persists via localStorage
- **Auto-refresh presets**: Off/5s/10s/30s/1m/5m buttons with countdown timer and green active bar
- **Designated runner**: MLB automatic runner on 2B with DR notation, PR-replacing-DR logic
- **Substitution line fixes**: defensive switches never create play cell lines, strict PH/PR placement
- **VitePress docs site**: live at docs.baseballscorecard.org with custom theme, LivePlayCell previews, full substitution docs

## v0.9.1 (March 27, 2026)

- Rainbow gradient loading bar on all data-loading pages
- Player name shortening now handles suffixes (Jr., Sr., II, III)
- Athletics abbreviation updated to ATH
- System wiki added

## v0.9.0 (March 27, 2026)

- **Substitution line redesign**: PH/PR indicators use dotted square pattern matching pitcher sub lines
- **PH line on LEFT** (sub before at-bat), **PR line on RIGHT** (sub after at-bat)
- Fixed: defensive switch events no longer overwrite PH/PR sub type
- **Double play fix**: each out number appears exactly once per inning
- **Scored diamond hatching**: 3 diagonal lines replace grey fill for scored runners (non-HR)
- Thumbnails also use hatch lines

## v0.8.2 (March 27, 2026)

- Skip-to-content accessibility fix
- Consistent border colors across all pages (footer, sections)
- Design consistency: team abbreviations never bold in tables

## v0.8.1 (March 27, 2026)

- Standings page converted to proper HTML tables with borders and headers
- All player links now point to Baseball Savant statcast pages
- Pitching coach detection handles title variations across teams
- Date picker shows day of week (e.g., "Thursday, March 26, 2026")
- Footer disclaimer updated

## v0.8.0 (March 26, 2026)

- **Team logos** (educational use): all 30 MLB cap logos with light/dark variants
- **Pitch arsenals**: season repertoire from MLB API for all pitchers (starters and bullpen)
- **Auto-refresh redesign**: native checkbox replaces custom toggle switch
- Linescore and W-L comparison side by side on desktop
- Game Info, Weather, Umpires spread across full width
- SEO: sitemap.xml, robots.txt, JSON-LD structured data
- Accessible page titles (comma separator, no symbols)

## v0.7.4 (March 26, 2026)

- Regular season layout: bench and bullpen tables always visible (no accordion)
- Spring Training keeps collapsible accordions for larger rosters

## v0.7.3 (March 26, 2026)

- Left-align all tables per design system rule
- Coaching staff table unified styling

## Earlier versions

Versions prior to v0.7.3 covered the foundational build:
- Phase 1: Fixtures, project structure, game picker, API client
- Phase 2: SVG scorecard grid, pitch sequences, scoring notation parser, linescore
- Phase 3: Diamond rendering with base paths (black/green/red), runner annotations
- Phase 4: Pitcher stats table, game metadata header, per-inning summary rows
