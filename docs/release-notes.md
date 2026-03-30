# Release Notes

Every version of BaseballScorecard.org, from the first render to the latest update.

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
