# Design System

Every visual decision on BaseballScorecard.org follows these rules. If something looks different from the rest of the site, it's a bug.

## Brand Colors

<div class="live-preview">
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#377049"></div>
    <div class="live-preview-label">Primary Green<br><code>#377049</code></div>
  </div>
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#1c1918"></div>
    <div class="live-preview-label">Stone Dark<br><code>#1c1918</code></div>
  </div>
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#868278"></div>
    <div class="live-preview-label">Stone Mid<br><code>#868278</code></div>
  </div>
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#faf9f6;border:1px solid #868278"></div>
    <div class="live-preview-label">Stone Light<br><code>#faf9f6</code></div>
  </div>
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#a04a49"></div>
    <div class="live-preview-label">Out Red<br><code>#a04a49</code></div>
  </div>
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#2a6d8d"></div>
    <div class="live-preview-label">Pitcher Blue<br><code>#2a6d8d</code></div>
  </div>
  <div style="text-align:center">
    <div class="color-swatch-box color-swatch-large" style="background:#7B2D8E"></div>
    <div class="live-preview-label">Challenge Purple<br><code>#7B2D8E</code></div>
  </div>
</div>

## Light Mode Palette

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| <div class="color-swatch-box" style="background:#1c1918"></div> | `--sc-text` | `#1c1918` | Primary text, diamond outlines |
| <div class="color-swatch-box" style="background:#6b6462"></div> | `--sc-text-light` | `#6b6462` | Secondary text, stats |
| <div class="color-swatch-box" style="background:#faf9f6;border:1px solid #868278"></div> | `--sc-bg` | `#faf9f6` | Page background |
| <div class="color-swatch-box" style="background:#e8e6e1"></div> | `--sc-cell-bg-empty` | `#e8e6e1` | Empty cells, headers |
| <div class="color-swatch-box" style="background:#f2f0ec"></div> | `--sc-cell-bg-future` | `#f2f0ec` | Future inning cells |
| <div class="color-swatch-box" style="background:#868278"></div> | `--grid-line` | `#868278` | All borders and dividers |
| <div class="color-swatch-box" style="background:#377049"></div> | `--sc-scored` | `#377049` | Scored runners, active states |
| <div class="color-swatch-box" style="background:#a04a49"></div> | `--sc-out` | `#a04a49` | Out paths, strikes |
| <div class="color-swatch-box" style="background:#44403a"></div> | `--sc-sub` | `#44403a` | Substitution indicators |
| <div class="color-swatch-box" style="background:#2a6d8d"></div> | `--sc-pitcher-line` | `#2a6d8d` | Pitcher change lines |
| <div class="color-swatch-box" style="background:#7B2D8E"></div> | `--sc-challenge` | `#7B2D8E` | ABS challenge badges |
| <div class="color-swatch-box" style="background:#e0f0e4"></div> | `--sc-active-cell` | `#e0f0e4` | Live batter highlight |

## Dark Mode Palette

| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| <div class="color-swatch-box" style="background:#f5f2e9"></div> | `--sc-text` | `#f5f2e9` | Primary text |
| <div class="color-swatch-box" style="background:#1c1918"></div> | `--sc-bg` | `#1c1918` | Page background |
| <div class="color-swatch-box" style="background:#292524"></div> | `--sc-cell-bg` | `#292524` | Play cell background |
| <div class="color-swatch-box" style="background:#7e7a76"></div> | `--grid-line` | `#7e7a76` | Borders |
| <div class="color-swatch-box" style="background:#d4d0c8"></div> | `--sc-sub` | `#d4d0c8` | Substitution indicators |

All colors are CSS custom properties. Theme switching toggles `data-theme` on `<html>`. No JavaScript needed for the swap.

## Diamond Rendering

<div class="live-preview">
  <div style="text-align:center">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <polygon points="50,85 85,50 50,15 15,50" fill="none" stroke="var(--sc-text)" stroke-width="2.5"/>
      <line x1="50" y1="85" x2="85" y2="50" stroke="var(--sc-text)" stroke-width="3"/>
      <line x1="72" y1="73" x2="63" y2="62" stroke="var(--sc-text)" stroke-width="2.5"/>
    </svg>
    <div class="live-preview-label">Single (1B)</div>
  </div>
  <div style="text-align:center">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <polygon points="50,85 85,50 50,15 15,50" fill="none" stroke="var(--sc-text)" stroke-width="2.5"/>
      <polyline points="50,85 85,50 50,15" fill="none" stroke="var(--sc-text)" stroke-width="3"/>
      <line x1="72" y1="73" x2="63" y2="62" stroke="var(--sc-text)" stroke-width="2.5"/>
      <line x1="68" y1="69" x2="59" y2="58" stroke="var(--sc-text)" stroke-width="2.5"/>
    </svg>
    <div class="live-preview-label">Double (2B)</div>
  </div>
  <div style="text-align:center">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <polygon points="50,85 85,50 50,15 15,50" fill="none" stroke="var(--sc-text)" stroke-width="2.5"/>
      <polyline points="50,85 85,50 50,15 15,50" fill="none" stroke="var(--sc-text)" stroke-width="3"/>
      <line x1="72" y1="73" x2="63" y2="62" stroke="var(--sc-text)" stroke-width="2.5"/>
      <line x1="68" y1="69" x2="59" y2="58" stroke="var(--sc-text)" stroke-width="2.5"/>
      <line x1="64" y1="65" x2="55" y2="54" stroke="var(--sc-text)" stroke-width="2.5"/>
    </svg>
    <div class="live-preview-label">Triple (3B)</div>
  </div>
  <div style="text-align:center">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <polygon points="50,85 85,50 50,15 15,50" fill="var(--sc-text)" stroke="var(--sc-text)" stroke-width="2.5"/>
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="var(--sc-bg)" font-size="18" font-weight="700" font-family="monospace">HR</text>
    </svg>
    <div class="live-preview-label">Home Run</div>
  </div>
  <div style="text-align:center">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <defs><clipPath id="ds-hatch"><polygon points="50,85 85,50 50,15 15,50"/></clipPath></defs>
      <polygon points="50,85 85,50 50,15 15,50" fill="none" stroke="var(--sc-text)" stroke-width="2.5"/>
      <g clip-path="url(#ds-hatch)">
        <line x1="10" y1="68" x2="90" y2="-12" stroke="var(--sc-text)" stroke-width="2.5"/>
        <line x1="10" y1="85" x2="90" y2="5" stroke="var(--sc-text)" stroke-width="2.5"/>
        <line x1="10" y1="102" x2="90" y2="22" stroke="var(--sc-text)" stroke-width="2.5"/>
      </g>
    </svg>
    <div class="live-preview-label">Scored (not HR)</div>
  </div>
</div>

These SVGs use `var(--sc-text)` and `var(--sc-bg)`, so they automatically switch between light and dark mode.

## Pitch Call Colors

<div class="live-preview">
  <div style="text-align:center">
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="20" fill="var(--sc-pitch-ball)"/>
    </svg>
    <div class="live-preview-label">Ball<br><code>B</code></div>
  </div>
  <div style="text-align:center">
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="20" fill="var(--sc-pitch-strike)"/>
    </svg>
    <div class="live-preview-label">Strike<br><code>C S F T</code></div>
  </div>
  <div style="text-align:center">
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="20" fill="var(--sc-pitch-in-play)"/>
    </svg>
    <div class="live-preview-label">In Play<br><code>X D E</code></div>
  </div>
  <div style="text-align:center">
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="20" fill="#7B2D8E"/>
    </svg>
    <div class="live-preview-label">ABS Challenge<br><code>W / L</code></div>
  </div>
</div>

## Substitution Line Pattern

All sub indicators use the same dotted square pattern.

<div class="live-preview">
  <div style="text-align:center">
    <svg width="200" height="40" viewBox="0 0 200 40">
      <rect x="0" y="0" width="200" height="40" fill="var(--sc-cell-bg-empty)" rx="4"/>
      <rect x="8" y="4" width="5" height="5" fill="var(--sc-sub)"/>
      <rect x="8" y="13" width="5" height="5" fill="var(--sc-sub)"/>
      <rect x="8" y="22" width="5" height="5" fill="var(--sc-sub)"/>
      <rect x="8" y="31" width="5" height="5" fill="var(--sc-sub)"/>
      <text x="100" y="22" text-anchor="middle" dominant-baseline="central" fill="var(--sc-text)" font-size="11">PH (left side)</text>
    </svg>
    <div class="live-preview-label">Pinch Hitter: before the at-bat</div>
  </div>
  <div style="text-align:center">
    <svg width="200" height="40" viewBox="0 0 200 40">
      <rect x="0" y="0" width="200" height="40" fill="var(--sc-cell-bg-empty)" rx="4"/>
      <rect x="187" y="4" width="5" height="5" fill="var(--sc-sub)"/>
      <rect x="187" y="13" width="5" height="5" fill="var(--sc-sub)"/>
      <rect x="187" y="22" width="5" height="5" fill="var(--sc-sub)"/>
      <rect x="187" y="31" width="5" height="5" fill="var(--sc-sub)"/>
      <text x="100" y="22" text-anchor="middle" dominant-baseline="central" fill="var(--sc-text)" font-size="11">PR (right side)</text>
    </svg>
    <div class="live-preview-label">Pinch Runner: after the at-bat</div>
  </div>
</div>

<div class="live-preview">
  <div style="text-align:center">
    <svg width="300" height="20" viewBox="0 0 300 20">
      <rect x="0" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <rect x="9" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <rect x="18" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <rect x="27" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <text x="150" y="13" text-anchor="middle" dominant-baseline="central" fill="var(--sc-pitcher-line)" font-size="11" font-weight="700" font-family="monospace">42 / 68 / 5K</text>
      <rect x="268" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <rect x="277" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <rect x="286" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
      <rect x="295" y="7" width="5" height="5" fill="var(--sc-pitcher-line)"/>
    </svg>
    <div class="live-preview-label">Pitcher change line with stats (strikes / pitches / Ks)</div>
  </div>
</div>

5px squares, 4px gaps, consistent everywhere.

## Indicator Icons

<div class="live-preview">
  <div style="text-align:center">
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="#666"/>
      <text x="20" y="20" text-anchor="middle" dominant-baseline="central" fill="white" font-size="14" font-weight="700">2</text>
    </svg>
    <div class="live-preview-label">Out Badge</div>
  </div>
  <div style="text-align:center">
    <svg width="40" height="40" viewBox="0 0 40 40">
      <polygon points="20,10 28,20 20,30 12,20" fill="var(--sc-text)"/>
    </svg>
    <div class="live-preview-label">RBI Diamond</div>
  </div>
  <div style="text-align:center">
    <svg width="40" height="40" viewBox="0 0 40 40">
      <text x="20" y="22" text-anchor="middle" dominant-baseline="central" fill="var(--sc-sub)" font-size="14" font-weight="600">A</text>
    </svg>
    <div class="live-preview-label">Sub Letter</div>
  </div>
</div>

All indicators share the same base size for visual consistency. The HR diamond is intentionally larger.

## Loading Bar

<div class="live-preview">
  <div style="width:100%;max-width:500px">
    <div style="height:4px;border-radius:2px;background:linear-gradient(90deg,#e74c3c,#f39c12,#2ecc71,#3498db,#9b59b6);animation:loading-demo 2s ease-in-out infinite;"></div>
    <style>@keyframes loading-demo { 0% { width: 0% } 50% { width: 90% } 100% { width: 0% } }</style>
    <div class="live-preview-label">Rainbow gradient, 4px height, appears after 1s delay</div>
  </div>
</div>

## Typography

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Team name header | `2.25em` | 700 | Scales to `1.25em` on mobile |
| Lineup player name | `clamp(1.1rem, 0.8vw + 1rem, 1.5rem)` | 800/600 | 800 starter, 600 sub |
| Table data | `1em` | 400 | All tables |
| Table header | `1em` | 700 | Column headers |
| Section title | `1.1em` | 700 | Spanning headers |
| Walk notation | `largeSize * 1.0` | 900 | BB, IBB, HBP, CI |
| Out notation | `largeSize * 0.6` | 400 | G6-3, F8, L7 |
| K notation | `largeSize * 0.7` | 400 | K, backwards K |

### Rules

- Never combine bold AND italic
- Team abbreviations never bold in tables
- All table data left-aligned (never centered)
- Only full team names in section headers are bold

## Borders

| Use | Style | Exception |
|-----|-------|-----------|
| All structural borders | `1px solid var(--grid-line)` | |
| Square corners | `border-radius: 0` | No exceptions |
| Drop shadows | Never | |
| Linescore RHE separator | `2.5px solid var(--text)` | Only thick border |
| Scorecard grid bold | `2.5px` | Row/inning boundaries |

## Grid and Layout

| Layout | Desktop | Mobile |
|--------|---------|--------|
| W-L + Linescore | 35% / 65% side by side | Stacked |
| Game Info / Weather / Umpires | 3 equal columns | Stacked |
| Standings | 2-column grid | 1 column |

`body { overflow-x: hidden }` prevents horizontal page scroll. Wide tables scroll within containers.

## Team Logos

Displayed for educational purposes. All logos are the trademark and property of their respective owners.

<div class="live-preview">
  <div style="text-align:center">
    <img src="https://www.mlbstatic.com/team-logos/team-cap-on-light/147.svg" width="48" height="48" alt="NYY"/>
    <div class="live-preview-label">Light mode</div>
  </div>
  <div style="text-align:center">
    <img src="https://www.mlbstatic.com/team-logos/team-cap-on-dark/147.svg" width="48" height="48" alt="NYY" style="background:#1c1918;border-radius:4px;padding:4px;"/>
    <div class="live-preview-label">Dark mode</div>
  </div>
</div>

- 30 teams, SVG format, stored locally at `/img/logos/light/` and `/img/logos/dark/`
- Auto-swap via CSS class toggling
- `vertical-align: middle` for alignment with text

## Accessibility

- WCAG AA contrast on all text and UI
- Skip-to-content link (first focusable element)
- `aria-label` on all interactive elements
- `aria-live="polite"` on auto-refresh status
- Keyboard navigation for all controls
- See [Accessibility](ACCESSIBILITY.md) for the full statement
