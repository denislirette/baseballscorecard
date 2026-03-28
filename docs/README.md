# BaseballScorecard.org

Welcome to the system wiki for [BaseballScorecard.org](https://baseballscorecard.org) — a live digital scorecard that renders every pitch, at-bat, and substitution from MLB games into the visual language of traditional paper scorekeeping.

This wiki documents everything: how the system works, the design decisions behind it, the baseball rules that drive the rendering, and the story of how it was built.

## What is this project?

Baseball scorecards are a pencil-and-paper tradition. Every fan who's ever kept score at a game knows the feeling of translating the action on the field into symbols on a sheet of paper. BaseballScorecard.org does the same thing digitally, using live data from the MLB Stats API.

Every pitch thrown, every ground ball to short, every stolen base, every pitching change — it all gets rendered into an SVG scorecard that looks like something you'd fill out with a pencil in the stands.

## Who made this?

This project was created by [Denis Lirette](https://github.com/denislirette), a designer who has always been curious about data and storytelling. When he discovered scorekeeping, something clicked. The way a scorecard captures a game on a single sheet of paper, with symbols and numbers to help tell the story with data, felt like the perfect intersection of design and baseball.

The entire project was built collaboratively with Claude (Anthropic's AI), starting in March 2026. Every line of code, every design decision, every bug fix documented in this wiki was part of that collaboration.

## Quick links

- [How to Read a Scorecard](scoring-notation.md) — start here if you're new to scorekeeping
- [Design System](design-system.md) — colors, typography, borders, components
- [Release Notes](release-notes.md) — what's changed, version by version
- [Baseball Rules](baseball-rules.md) — the rules that drive the rendering
- [Technical Reference](technical-reference.md) — architecture, data flow, file map
