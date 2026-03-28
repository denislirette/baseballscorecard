# Known Issues

Active bugs and limitations.

## Rendering

- **Bat-around innings**: when a batter comes up twice in the same inning, extra columns are added. The layout handles this, but pitch sequences and sub indicators can get crowded in the expanded cells.
- **Runner interference double plays (RIDP)**: parser attempts to extract fielder numbers but may fall back to generic `OUT` notation.
- **Very long games (18+ innings)**: the linescore table scrolls horizontally, which works but isn't ideal on mobile. The SVG scorecard handles extra innings correctly.

## Data

- **Season arsenal at start of year**: pitch arsenal data falls back to the previous season until enough current-season data is available from the MLB API. The first few games of the season may show last year's repertoire.
- **Spring Training rosters**: roster sizes are much larger during Spring Training. The system uses collapsible accordions for bench and bullpen sections to manage the list length.
- **Minor league call-ups**: players called up from the minors may not have season stats until they've accumulated plate appearances at the MLB level.

## Design

- **Thumbnail strike zones**: not rendered in thumbnails due to space constraints. Only the full scorecard shows mini strike zones.

## Reporting bugs

If you find a bug or something that doesn't look right, open an issue on [GitHub](https://github.com/denislirette/baseballscorecard/issues) or use the [contact form](https://baseballscorecard.org/contact.html).
