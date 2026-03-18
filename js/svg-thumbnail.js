// Thumbnail scorecard renderer for game picker cards
// Simplified rendition: diamonds, notation text, out dots, sub lines
// Uses CSS classes (th-*) for colors so dark/light theme changes apply instantly.

import { buildTeamLineup, buildScorecardGrid, getInningCount, buildSubstitutionMap } from './game-data.js';
import { getThumbnailConfig } from './layout-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  const { TH_CELL_SIZE: CS, TH_GAP: GAP } = getThumbnailConfig();
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

  // Thin border around each team's grid
  const gridH = 9 * CS;
  const homeTop = gridH + GAP;
  svg.appendChild(el('rect', {
    x: 0, y: 0, width: w, height: gridH,
    fill: 'none', 'stroke-width': 0.75, class: 'th-border',
  }));
  svg.appendChild(el('rect', {
    x: 0, y: homeTop, width: w, height: gridH,
    fill: 'none', 'stroke-width': 0.75, class: 'th-border',
  }));

  return svg;
}

export function renderEmptyGrid(innings = 9) {
  const { TH_CELL_SIZE: CS, TH_GAP: GAP } = getThumbnailConfig();
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

function drawGrid(svg, ox, oy, cols, grid, lastPlayedInning) {
  const { TH_CELL_SIZE: CS, TH_GRID_STROKE_W: GSW } = getThumbnailConfig();

  // Cell backgrounds: gray for played empty cells, lighter for future innings
  for (let slot = 1; slot <= 9; slot++) {
    for (let inn = 1; inn <= cols; inn++) {
      const hasData = grid && grid.has(`${slot}-${inn}`) && grid.get(`${slot}-${inn}`).length > 0;
      if (!hasData) {
        const isFuture = lastPlayedInning > 0 && inn > lastPlayedInning;
        svg.appendChild(el('rect', {
          class: isFuture ? 'th-future' : 'th-empty',
          x: ox + (inn - 1) * CS, y: oy + (slot - 1) * CS,
          width: CS, height: CS,
        }));
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
  const { TH_CELL_SIZE: CS, TH_GAP: GAP } = getThumbnailConfig();
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

  // Determine last played inning for this team's half
  const linescore = data.liveData.linescore;
  const linescoreInnings = linescore.innings || [];
  const halfKey = side === 'away' ? 'away' : 'home';
  let lastPlayedInning = 0;
  for (let i = 0; i < linescoreInnings.length; i++) {
    if (linescoreInnings[i]?.[halfKey]) lastPlayedInning = i + 1;
  }

  drawGrid(svg, ox, oy, cols, grid, lastPlayedInning);

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
        svg.appendChild(el('rect', {
          class: 'th-active-border',
          x: cellX + 1, y: cellY + 1, width: CS - 2, height: CS - 2,
          fill: 'none', stroke: 'var(--sc-active-border, #377049)', 'stroke-width': 2,
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
          'stroke-width': 3, 'stroke-dasharray': '5,3',
        }));
      }

      const abs = grid.get(key);
      if (!abs || abs.length === 0) continue;
      drawCell(svg, cellX, cellY, abs[0]);
    }
  }
}

// ─── Cell rendering ─────────────────────────────────────────────

export function drawCell(svg, cellX, cellY, ab) {
  const {
    TH_CELL_SIZE: CS, TH_DIAMOND_R: DR, TH_PATH_STROKE_W: PSW,
    TH_FONT_SIZE: FS, TH_FONT_SIZE_SM: FS_SM, TH_DOT_R: DOTR, TH_PAD: PAD,
  } = getThumbnailConfig();

  const cx = cellX + CS / 2;
  const cy = cellY + CS / 2;
  const notation = ab.notation || '';
  const isHR = notation === 'HR';

  const runners = ab.cumulativeRunners || [];
  const hasSegs = runners.some(r => r.segments?.length > 0);
  const batterRunner = runners.find(r => r.playerId === ab.batterId);
  const batterScored = batterRunner?.scored || false;
  const showDiamond = isHR || batterScored || hasSegs;

  const isBaseHit = /^[1-3]B$/.test(notation);
  // Only shift diamond up when notation text will appear below it
  const dcy = (showDiamond && !isBaseHit && !isHR) ? cy - 4 : cy;

  // ── Out dots (top-left, stacked vertically) ──
  const outs = (ab.runners || []).filter(r => r.isOut).length;
  if (outs > 0) {
    const dotX = cellX + PAD + DOTR;
    const dotSpacing = DOTR * 2 + 2;
    const startY = cellY + PAD + DOTR;
    for (let i = 0; i < Math.min(outs, 3); i++) {
      svg.appendChild(el('circle', {
        class: 'th-out',
        cx: dotX, cy: startY + i * dotSpacing, r: DOTR,
      }));
    }
  }

  // ── Home run: solid diamond (centered in cell) ──
  if (isHR) {
    const hrDR = Math.round(DR * 1.5);
    svg.appendChild(el('polygon', {
      class: 'th-t',
      points: dPts(cx, cy, hrDR),
    }));
    svg.appendChild(tx('HR', cx, cy + 5.5, {
      class: 'th-bg',
      'font-size': '16', 'font-weight': '700',
      'text-anchor': 'middle',
      'font-family': 'sans-serif',
    }));
    return;
  }

  // ── Diamond / base paths ──
  if (hasSegs) {
    // Draw base paths as polylines for clean corners
    for (const runner of runners) {
      const segs = runner.segments || [];
      const points = [];
      for (const seg of segs) {
        const from = dPt(cx, dcy, DR, seg.from);
        const to = dPt(cx, dcy, DR, seg.to);
        if (seg.isOutSegment) {
          // Out segment: draw separately, truncated to midpoint
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          if (points.length > 1) {
            svg.appendChild(el('polyline', {
              class: 'th-s', points: points.join(' '),
              'stroke-width': PSW, fill: 'none',
              'stroke-linejoin': 'miter', 'stroke-linecap': 'square',
            }));
          }
          svg.appendChild(el('line', {
            class: 'th-s',
            x1: from.x, y1: from.y, x2: mx, y2: my,
            'stroke-width': PSW, 'stroke-linecap': 'square',
          }));
          points.length = 0;
        } else {
          if (points.length === 0) points.push(`${from.x},${from.y}`);
          points.push(`${to.x},${to.y}`);
        }
      }
      if (points.length > 1) {
        svg.appendChild(el('polyline', {
          class: 'th-s', points: points.join(' '),
          'stroke-width': PSW, fill: 'none',
          'stroke-linejoin': 'miter', 'stroke-linecap': 'square',
        }));
      }
    }

    // Hash marks on HP→1B segment (base HITS only: 1B/2B/3B)
    const hitHashes = notation === '1B' ? 1 : notation === '2B' ? 2 : notation === '3B' ? 3 : 0;
    if (hitHashes > 0) {
      const hp = dPt(cx, dcy, DR, 'HP');
      const fb = dPt(cx, dcy, DR, '1B');
      const mx = (hp.x + fb.x) / 2;
      const my = (hp.y + fb.y) / 2;
      const dx = fb.x - hp.x;
      const dy = fb.y - hp.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const px = -dy / len;
      const py = dx / len;
      const hashLen = DR * 0.45;
      const hashGap = 4;
      for (let i = 0; i < hitHashes; i++) {
        const offset = (i - (hitHashes - 1) / 2) * hashGap;
        const hx = mx + offset * dx / len;
        const hy = my + offset * dy / len;
        svg.appendChild(el('line', {
          class: 'th-s',
          x1: hx - px * hashLen, y1: hy - py * hashLen,
          x2: hx + px * hashLen, y2: hy + py * hashLen,
          'stroke-width': PSW,
        }));
      }
    }
  } else if (batterScored) {
    // Batter scored but no segment data — show filled diamond centered, same size as HR
    const scoredDR = Math.round(DR * 1.5);
    svg.appendChild(el('polygon', {
      class: 'th-t',
      points: dPts(cx, cy, scoredDR),
    }));
  }

  // ── Notation text ──
  // Skip notation only for base hits (1B/2B/3B) — paths + hash marks represent those
  if (notation && !isBaseHit) {
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
      const isBackwardsK = notation === '\u{A4D8}';
      const fontSize = showDiamond ? FS_SM : FS;
      const textY = showDiamond ? cellY + CS - PAD : cy + Math.round(fontSize / 3);
      if (isBackwardsK) {
        // Draw a real K and mirror it horizontally for a perfect match
        const t = tx('K', cx, textY, {
          class: 'th-t',
          'font-size': String(fontSize), 'font-weight': '700',
          'text-anchor': 'middle',
          'font-family': 'sans-serif',
          transform: `scale(-1,1)`,
          'transform-origin': `${cx} ${textY}`,
        });
        svg.appendChild(t);
      } else {
        svg.appendChild(tx(display, cx, textY, {
          class: 'th-t',
          'font-size': String(fontSize), 'font-weight': '700',
          'text-anchor': 'middle',
          'font-family': 'sans-serif',
        }));
      }
    }
  }
}
