// Thumbnail scorecard renderer for game picker cards
// Simplified rendition: diamonds, notation text, out dots, sub lines
// Uses CSS classes (th-*) for colors so dark/light theme changes apply instantly.

import { buildTeamLineup, buildScorecardGrid, getInningCount, buildSubstitutionMap } from './game-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Thumbnail cell dimensions (viewBox units)
const CS = 41;     // cell size (20% larger for readability)
const DR = 11;     // diamond radius
const PSW = 2;     // base path stroke width
const GSW = 0.5;   // grid line stroke width
const FS = 16;     // notation font size (no diamond)
const FS_SM = 11;  // smaller font when diamond is also shown
const DOTR = 2.5;  // out dot radius
const GAP = 12;    // gap between away/home grids
const PAD = 3;     // inner cell padding

// Notations that split across two lines: prefix on top, positions below
// Only split DP and TP across two lines; everything else stays on one line
const SPLIT_RE = /^(DP|TP|KDP|K\+)([\d-]+)$/;

function el(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function tx(str, x, y, attrs = {}) {
  const t = el('text', { x, y, ...attrs });
  t.textContent = str;
  return t;
}

function dPt(cx, cy, R, base) {
  switch (base) {
    case '1B': return { x: cx + R, y: cy };
    case '2B': return { x: cx, y: cy - R };
    case '3B': return { x: cx - R, y: cy };
    default:   return { x: cx, y: cy + R };
  }
}

function dPts(cx, cy, R) {
  return `${cx},${cy + R} ${cx + R},${cy} ${cx},${cy - R} ${cx - R},${cy}`;
}

// ─── Public API ──────────────────────────────────────────────────

export function renderThumbnail(data) {
  const innings = getInningCount(data.liveData.linescore);
  const w = innings * CS;
  const h = 9 * CS * 2 + GAP;

  const svg = el('svg', {
    viewBox: `0 0 ${w} ${h}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Scorecard thumbnail',
  });
  svg.style.display = 'block';

  renderTeam(svg, data, 'away', 0, 0, innings);
  renderTeam(svg, data, 'home', 0, 9 * CS + GAP, innings);

  return svg;
}

export function renderEmptyGrid(innings = 9) {
  const w = innings * CS;
  const h = 9 * CS * 2 + GAP;

  const svg = el('svg', {
    viewBox: `0 0 ${w} ${h}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Empty scorecard grid',
  });
  svg.style.display = 'block';

  drawGrid(svg, 0, 0, innings, null);
  drawGrid(svg, 0, 9 * CS + GAP, innings, null);

  return svg;
}

// ─── Grid lines ─────────────────────────────────────────────────

function drawGrid(svg, ox, oy, cols, grid) {
  // Cell backgrounds: gray for cells without at-bats
  if (grid) {
    for (let slot = 1; slot <= 9; slot++) {
      for (let inn = 1; inn <= cols; inn++) {
        const key = `${slot}-${inn}`;
        const hasData = grid.has(key) && grid.get(key).length > 0;
        if (!hasData) {
          svg.appendChild(el('rect', {
            class: 'th-empty',
            x: ox + (inn - 1) * CS, y: oy + (slot - 1) * CS,
            width: CS, height: CS,
          }));
        }
      }
    }
  }

  // Grid lines
  for (let c = 0; c <= cols; c++) {
    svg.appendChild(el('line', {
      class: 'th-g',
      x1: ox + c * CS, y1: oy,
      x2: ox + c * CS, y2: oy + 9 * CS,
      'stroke-width': GSW,
    }));
  }
  for (let r = 0; r <= 9; r++) {
    svg.appendChild(el('line', {
      class: 'th-g',
      x1: ox, y1: oy + r * CS,
      x2: ox + cols * CS, y2: oy + r * CS,
      'stroke-width': GSW,
    }));
  }
}

// ─── Team rendering ─────────────────────────────────────────────

function renderTeam(svg, data, side, ox, oy, cols) {
  const boxscore = data.liveData.boxscore;
  const allPlays = data.liveData.plays.allPlays;
  const halfInning = side === 'away' ? 'top' : 'bottom';
  const lineup = buildTeamLineup(boxscore, side);
  const grid = buildScorecardGrid(allPlays, halfInning, lineup, boxscore, side);
  const subMap = buildSubstitutionMap(allPlays, halfInning, lineup);

  // Detect active batter cell for live games
  const currentPlay = data.liveData.plays.currentPlay;
  let activeCellKey = null;
  if (currentPlay && !currentPlay.about.isComplete && currentPlay.about.halfInning === halfInning) {
    const batterId = currentPlay.matchup?.batter?.id;
    if (batterId) {
      const playerSlot = lineup.find(s => s.players.some(p => p.id === batterId));
      if (playerSlot) activeCellKey = `${playerSlot.slot}-${currentPlay.about.inning}`;
    }
  }

  drawGrid(svg, ox, oy, cols, grid);

  for (let slot = 1; slot <= 9; slot++) {
    for (let inn = 1; inn <= cols; inn++) {
      const key = `${slot}-${inn}`;
      const cellX = ox + (inn - 1) * CS;
      const cellY = oy + (slot - 1) * CS;

      // Active cell highlight
      if (key === activeCellKey) {
        svg.appendChild(el('rect', {
          class: 'th-active',
          x: cellX, y: cellY, width: CS, height: CS,
        }));
      }

      // Pitcher sub: blue dashed line replaces grid line
      const subs = subMap.get(key);
      if (subs && subs.some(s => s.type === 'pitcher')) {
        svg.appendChild(el('line', {
          class: 'th-bg-line',
          x1: cellX, y1: cellY,
          x2: cellX + CS, y2: cellY,
          'stroke-width': 2,
        }));
        svg.appendChild(el('line', {
          class: 'th-psub',
          x1: cellX, y1: cellY,
          x2: cellX + CS, y2: cellY,
          'stroke-width': 2, 'stroke-dasharray': '4,2',
        }));
      }

      const abs = grid.get(key);
      if (!abs || abs.length === 0) continue;
      drawCell(svg, cellX, cellY, abs[0]);
    }
  }
}

// ─── Cell rendering ─────────────────────────────────────────────

function drawCell(svg, cellX, cellY, ab) {
  const cx = cellX + CS / 2;
  const cy = cellY + CS / 2;
  const notation = ab.notation || '';
  const isHR = notation === 'HR';

  const runners = ab.cumulativeRunners || [];
  const hasSegs = runners.some(r => r.segments?.length > 0);
  const batterScored = runners.some(r => r.scored);
  const showDiamond = isHR || batterScored || hasSegs;

  const dcy = showDiamond ? cy - 4 : cy;

  // ── Out dots (top-right) ──
  const outs = (ab.runners || []).filter(r => r.isOut).length;
  if (outs > 0) {
    const dotY = cellY + PAD + DOTR;
    const dotSpacing = 6;
    const startX = cellX + CS - PAD - DOTR - (outs - 1) * dotSpacing;
    for (let i = 0; i < Math.min(outs, 3); i++) {
      svg.appendChild(el('circle', {
        class: 'th-out',
        cx: startX + i * dotSpacing, cy: dotY, r: DOTR,
      }));
    }
  }

  // ── Home run: solid diamond ──
  if (isHR) {
    svg.appendChild(el('polygon', {
      class: 'th-t',
      points: dPts(cx, dcy, DR),
    }));
    svg.appendChild(tx('HR', cx, dcy + 3.5, {
      class: 'th-bg',
      'font-size': '9', 'font-weight': '700',
      'text-anchor': 'middle',
      'font-family': 'sans-serif',
    }));
    return;
  }

  // ── Run scored: solid diamond ──
  if (batterScored) {
    svg.appendChild(el('polygon', {
      class: 'th-t',
      points: dPts(cx, dcy, DR),
    }));
  } else if (hasSegs) {
    // ── Base paths reached: draw line segments ──
    for (const runner of runners) {
      for (const seg of runner.segments || []) {
        const from = dPt(cx, dcy, DR, seg.from);
        const to = dPt(cx, dcy, DR, seg.to);
        if (seg.isOutSegment) {
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          svg.appendChild(el('line', {
            class: 'th-s',
            x1: from.x, y1: from.y, x2: mx, y2: my,
            'stroke-width': PSW,
          }));
        } else {
          svg.appendChild(el('line', {
            class: 'th-s',
            x1: from.x, y1: from.y, x2: to.x, y2: to.y,
            'stroke-width': PSW,
          }));
        }
      }
    }
  }

  // ── Notation text ──
  if (notation) {
    const splitMatch = notation.match(SPLIT_RE);
    if (splitMatch) {
      // Two-line notation: prefix (DP, FC, etc.) on top, positions below
      const prefix = splitMatch[1];
      const positions = splitMatch[2];
      const fontSize = showDiamond ? FS_SM - 1 : FS_SM + 1;
      const baseY = showDiamond ? cellY + CS - PAD : cy;
      svg.appendChild(tx(prefix, cx, baseY - 3, {
        class: 'th-t',
        'font-size': String(fontSize), 'font-weight': '700',
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
      }));
      svg.appendChild(tx(positions, cx, baseY + fontSize - 2, {
        class: 'th-t',
        'font-size': String(fontSize), 'font-weight': '700',
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
      }));
    } else {
      const display = notation.length > 7 ? notation.substring(0, 7) : notation;
      const fontSize = showDiamond ? FS_SM : FS;
      const textY = showDiamond ? cellY + CS - PAD : cy + Math.round(fontSize / 3);
      svg.appendChild(tx(display, cx, textY, {
        class: 'th-t',
        'font-size': String(fontSize), 'font-weight': '700',
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
      }));
    }
  }
}
