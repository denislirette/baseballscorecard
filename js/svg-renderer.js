// SVG scorecard rendering: Bob Carpenter layout, high-contrast, dark mode
// Large cells with full-size diamond, large notation, big batter info

function teamLogo(teamId, size = '2.25em') {
  return `<img class="team-logo team-logo-light" src="/img/logos/light/${teamId}.svg" alt="" style="height:${size};width:auto;vertical-align:middle;margin-right:2px;"><img class="team-logo team-logo-dark" src="/img/logos/dark/${teamId}.svg" alt="" style="height:${size};width:auto;vertical-align:middle;margin-right:2px;">`;
}

import {
  buildTeamLineup,
  buildScorecardGrid,
  buildSubstitutionMap,
  buildSubNumberMap,
  getInningCount,
  getBatterStats,
  getPitcherStats,
  getPlayerBatSide,
  getPlayerPitchHand,
  getGameInfo,
  extractUmpires,
  getBenchPlayers,
  getBullpenPitchers,
  POS_ABBREV,
} from './game-data.js';
import { getConfig } from './layout-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Inline SVG icon for "opens in new tab" — used inside foreignObject where
// CSS ::after pseudo-elements mis-render on iOS/WebKit (they position relative
// to the SVG viewport instead of the HTML flow, causing ghost icons in the grid).
// By embedding the icon as real DOM content, it flows correctly everywhere.
const EXTERNAL_ICON_SVG = `<svg class="external-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>`;

// Player link helper: generates an MLB.com player link.
// When inSVG is true, uses a real <a> tag but with an inline SVG icon instead
// of relying on the ::after pseudo-element (which breaks in foreignObject on iOS).
function playerLink(name, id, { inSVG = false } = {}) {
  if (!id) return name;
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const url = `https://baseballsavant.mlb.com/savant-player/${slug}-${id}`;
  if (inSVG) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="player-link svg-player-link">${name}${EXTERNAL_ICON_SVG}<span class="sr-only"> (opens in new tab)</span></a>`;
  }
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="player-link">${name}<span class="sr-only"> (opens in new tab)</span></a>`;
}

// Stats
const STAT_HEADERS = ['AB', 'R', 'H', 'BI'];
const SUMMARY_LABELS = ['R', 'H', 'E', 'LOB', 'S / P'];

// Strike zone mapping range: controls how much "air" surrounds the zone box.
// Wider ranges → smaller zone box relative to plot area → tighter cluster.
const PX_RANGE = 2.4;   // horizontal range in feet (centered on 0), zone box ~70% of width
const PZ_MIN = 1.0;     // bottom of vertical mapping (feet)
const PZ_MAX = 4.2;     // top of vertical mapping (feet)
const SZ_HALF_PLATE = 0.83;  // half-plate width in feet

// ─── Module-level layout snapshot, refreshed per render ──────────
let L = null;

function refreshLayout() {
  const c = getConfig();
  L = {
    MARGIN_LEFT: c.MARGIN_LEFT,
    COL_WIDTH: c.COL_WIDTH,
    ROW_HEIGHT: c.ROW_HEIGHT,
    HEADER_HEIGHT: c.HEADER_HEIGHT,
    STATS_COL_WIDTH: c.STATS_COL_WIDTH,
    SUMMARY_ROW_HEIGHT: c.SUMMARY_ROW_HEIGHT,
    DIAMOND_R: c.DIAMOND_R,
    PITCH_COL_W: c.PITCH_COL_W,
    PITCH_START_Y: c.PITCH_START_Y,
    PITCH_STEP: c.PITCH_STEP,
    PITCH_FONT_SIZE: c.PITCH_FONT_SIZE,
    SZ_WIDTH: c.SZ_WIDTH,
    SZ_HEIGHT: c.SZ_HEIGHT,
    SUB_CIRCLE_POS: c.SUB_CIRCLE_POS,
    SUB_TEXT_POS: c.SUB_TEXT_POS,
    SUB_CIRCLE_R: c.SUB_CIRCLE_R,
    SUB_LINE_W: c.SUB_LINE_W,
    SUB_CIRCLE_VPOS: c.SUB_CIRCLE_VPOS,
    BASE_PATH_SW: c.BASE_PATH_SW,
    HASH_SW: c.HASH_SW,
    DIAMOND_SW: c.DIAMOND_SW,
    FONT: 'Arial, Helvetica, sans-serif',
    MONO: 'Arial, Helvetica, sans-serif',
    BASES: {
      HP: { dx: 0, dy: c.DIAMOND_R },
      '1B': { dx: c.DIAMOND_R, dy: 0 },
      '2B': { dx: 0, dy: -c.DIAMOND_R },
      '3B': { dx: -c.DIAMOND_R, dy: 0 },
    },
  };
}

// ─── Theme colors (read from CSS custom properties) ──────────────

function getColors() {
  const root = getComputedStyle(document.documentElement);
  const v = (name) => root.getPropertyValue(name).trim();
  return {
    text:      v('--sc-text')      || '#121212',
    textLight: v('--sc-text-light') || '#333333',
    textMuted: v('--sc-text-muted') || '#666666',
    grid:      v('--sc-grid')      || '#AAAAAA',
    gridBold:  v('--sc-grid-bold') || '#121212',
    diamond:   v('--sc-diamond')   || '#999999',
    reached:   v('--sc-reached')   || '#121212',
    scored:    v('--sc-scored')    || '#007700',
    out:       v('--sc-out')       || '#CC0000',
    outBadge:  v('--sc-out-badge') || '#292524',
    hit:       v('--sc-hit')       || '#007700',
    sub:       v('--sc-sub')       || '#0000CC',
    bg:        v('--sc-bg')        || '#FFFFFF',
    cellBg:    v('--sc-cell-bg')   || '#FFFFFF',
    cellBgEmpty: v('--sc-cell-bg-empty') || '#EAEAEA',
    cellBgFuture: v('--sc-cell-bg-future') || '#F5F5F5',
    headerBg:  v('--sc-header-bg') || '#F0F0F0',
    pitchBall:   v('--sc-pitch-ball')   || '#121212',
    pitchStrike: v('--sc-pitch-strike') || '#CC0000',
    pitchInPlay: v('--sc-pitch-in-play') || '#0000CC',
    pitchHbp:    v('--sc-pitch-hbp')    || '#121212',
    activeCell:  v('--sc-active-cell')  || '#FFFACD',
    activeBorder: v('--sc-active-border') || '#377049',
    challenge:    v('--sc-challenge')    || '#7B2D8E',
    pitcherLine:  v('--sc-pitcher-line') || '#7a9a7e',
    link:         v('--link')          || '#294991',
  };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function svgText(text, x, y, attrs = {}) {
  const el = svgEl('text', { x, y, ...attrs });
  el.textContent = text;
  return el;
}

export { svgEl, svgText, refreshLayout, getColors, drawAtBatCell, drawSubIndicator, drawDiamond };

function pitchColor(callCode, CLR) {
  switch (callCode) {
    case 'C': case 'S': case 'F': case 'T': case 'W': case 'L': case 'M': case 'Q':
      return CLR.pitchStrike;
    case 'X': case 'D': case 'E':
      return CLR.pitchInPlay;
    case 'H':
      return CLR.pitchHbp;
    default:
      return CLR.pitchBall;
  }
}

// ─── Main render entry ───────────────────────────────────────────

export function renderTeamScorecard(data, side) {
  refreshLayout();
  const CLR = getColors();
  const boxscore = data.liveData.boxscore;
  const gameData = data.gameData;
  const allPlays = data.liveData.plays.allPlays;
  const linescore = data.liveData.linescore;
  const halfInning = side === 'away' ? 'top' : 'bottom';

  const lineup = buildTeamLineup(boxscore, side);

  // Merge trend data if available
  const trendLineup = data._trends?.[side];
  if (trendLineup) {
    for (const slot of lineup) {
      for (const p of slot.players) {
        const trendSlot = trendLineup.find(s => s.players.some(tp => tp.id === p.id));
        const tp = trendSlot?.players.find(tp => tp.id === p.id);
        if (tp) {
          p.avgTrend = tp.avgTrend || '';
          p.opsTrend = tp.opsTrend || '';
        }
      }
    }
  }

  const grid = buildScorecardGrid(allPlays, halfInning, lineup, boxscore, side);
  const innings = getInningCount(linescore);
  const batterStats = getBatterStats(boxscore, side);
  const subMap = buildSubstitutionMap(allPlays, halfInning, lineup);
  const subNumberMap = buildSubNumberMap(lineup);

  // Build column map: compute how many visual columns each inning needs
  // (bat-around innings get extra columns so each at-bat has a full-size cell)
  const colMap = buildColMap(grid, lineup, innings);

  // Determine active batter cell for highlighting (live games only, not pre-game)
  const currentPlay = data.liveData.plays.currentPlay;
  const gameState = data.gameData.status?.abstractGameState;
  let activeCellKey = null;
  if (gameState === 'Live' && currentPlay && !currentPlay.about.isComplete && currentPlay.about.halfInning === halfInning) {
    const batterId = currentPlay.matchup?.batter?.id;
    if (batterId) {
      const playerSlot = lineup.find(s => s.players.some(p => p.id === batterId));
      if (playerSlot) {
        activeCellKey = `${playerSlot.slot}-${currentPlay.about.inning}`;
      }
    }
  }

  let totalRows = 0;
  const rowOffsets = [];
  for (const _slot of lineup) {
    rowOffsets.push(totalRows);
    totalRows += 1; // always 1 row per batting order slot
  }

  const summaryRows = SUMMARY_LABELS.length;
  const statsWidth = STAT_HEADERS.length * L.STATS_COL_WIDTH;
  const width = L.MARGIN_LEFT + (colMap.totalCols * L.COL_WIDTH) + statsWidth;
  const gridHeight = L.HEADER_HEIGHT + (totalRows * L.ROW_HEIGHT);
  const height = gridHeight + (summaryRows * L.SUMMARY_ROW_HEIGHT) + 2;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    class: 'scorecard-svg',
  });

  svg.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: CLR.bg }));

  // Determine last played inning for this team's half
  const linescoreInnings = linescore.innings || [];
  const halfKey = side === 'away' ? 'away' : 'home';
  let lastPlayedInning = 0;
  for (let i = 0; i < linescoreInnings.length; i++) {
    if (linescoreInnings[i]?.[halfKey]) lastPlayedInning = i + 1;
  }

  const isFinalGame = data.gameData.status?.abstractGameState === 'Final';
  drawGrid(svg, CLR, lineup, colMap, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows, activeCellKey, subMap, grid, lastPlayedInning, isFinalGame);
  drawHeader(svg, CLR, colMap, statsWidth);
  drawStatHeaders(svg, CLR, colMap);
  drawLineup(svg, CLR, lineup, rowOffsets, boxscore, gameData, side, subMap);
  drawAtBats(svg, CLR, lineup, grid, rowOffsets, colMap, subMap, subNumberMap, activeCellKey, lastPlayedInning, isFinalGame);
  drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, colMap, gridHeight);
  // Compute per-inning pitch counts from grid data
  const inningPitchCounts = [];
  for (let inn = 1; inn <= innings; inn++) {
    let strikes = 0, pitches = 0, ks = 0;
    for (const slot of lineup) {
      const key = `${slot.slot}-${inn}`;
      const abs = grid.get(key);
      if (!abs) continue;
      for (const ab of abs) {
        for (const p of ab.pitchSequence || []) {
          pitches++;
          const c = p.callCode;
          if (c !== 'B' && c !== '*') strikes++;
        }
        if (ab.notation === 'K' || ab.notation === '\u{A4D8}') ks++;
      }
    }
    inningPitchCounts.push({ strikes, pitches, ks });
  }
  drawSummaryRows(svg, CLR, linescore, side, colMap, gridHeight, width, statsWidth, inningPitchCounts);


  return svg;
}

// ─── Column map for bat-around innings ───────────────────────────
// When a batter comes up twice in the same inning, the inning gets
// an extra visual column so each at-bat has a full-size cell.
// The header spans both columns with one inning number.

function buildColMap(grid, lineup, innings) {
  // For each inning, find max at-bats any single slot has
  const spans = []; // spans[i] = number of visual columns for inning (i+1)
  const starts = []; // starts[i] = cumulative column offset for inning (i+1)
  let cumulative = 0;
  for (let inn = 1; inn <= innings; inn++) {
    let maxAbs = 1;
    for (const slot of lineup) {
      const key = `${slot.slot}-${inn}`;
      const abs = grid.get(key);
      if (abs && abs.length > maxAbs) maxAbs = abs.length;
    }
    spans.push(maxAbs);
    starts.push(cumulative);
    cumulative += maxAbs;
  }
  return {
    innings,
    spans,      // spans[inn-1] = how many visual columns for this inning
    starts,     // starts[inn-1] = visual column offset where this inning begins
    totalCols: cumulative,
    // Get x position for inning inn (1-based), sub-column subCol (0-based)
    colX(inn, subCol = 0) {
      return L.MARGIN_LEFT + (this.starts[inn - 1] + subCol) * L.COL_WIDTH;
    },
    // Get total pixel width for an inning's span
    spanWidth(inn) {
      return this.spans[inn - 1] * L.COL_WIDTH;
    },
    // Get x position for stats columns (after all inning columns)
    statsX() {
      return L.MARGIN_LEFT + this.totalCols * L.COL_WIDTH;
    },
  };
}

// ─── Per-cell substitution indicators ────────────────────────────

function drawSubIndicator(g, CLR, x, y, subType, subNum, pStats, cellBgColor) {
  // Helper: draw a vertical sub indicator with dotted squares (matches pitcher line style).
  function drawVerticalSubLine(lineX) {
    const sqSize = 5;
    const sqGap = 4;
    const sqStep = sqSize + sqGap;
    const startY = y + 2;
    const endY = y + L.ROW_HEIGHT - 2;
    for (let sy = startY; sy + sqSize <= endY; sy += sqStep) {
      g.appendChild(svgEl('rect', {
        x: lineX - sqSize / 2, y: sy, width: sqSize, height: sqSize,
        fill: CLR.sub,
      }));
    }
  }

  if (subType === 'pitcher') {
    // Cover the grid line with cell background, then draw pitcher change line on top
    const pColor = CLR.pitcherLine;
    g.appendChild(svgEl('rect', {
      x: x, y: y - 4, width: L.COL_WIDTH, height: 8,
      fill: cellBgColor || CLR.cellBg, stroke: 'none',
    }));
    // Draw square blocks on either side of the label (or across full width if no stats)
    const sqSize = 5; // perfect squares
    const sqGap = 4;  // gap between squares
    const sqStep = sqSize + sqGap;

    if (pStats) {
      const fs = String(L.PITCH_FONT_SIZE);
      const label = `${pStats.strikes} / ${pStats.pitches} / ${pStats.ks}K`;
      const labelX = x + L.COL_WIDTH / 2;
      const minSquares = 4;
      const sideW = minSquares * sqStep;
      const maxLabelW = L.COL_WIDTH - 4 - sideW * 2;
      const halfLabel = maxLabelW / 2;

      const leftStart = x + 2;
      const leftEnd = labelX - halfLabel;
      for (let sx = leftStart; sx + sqSize <= leftEnd; sx += sqStep) {
        g.appendChild(svgEl('rect', {
          x: sx, y: y - sqSize / 2, width: sqSize, height: sqSize,
          fill: pColor,
        }));
      }

      const rightStart = labelX + halfLabel;
      const rightEnd = x + L.COL_WIDTH - 2;
      for (let sx = rightStart; sx + sqSize <= rightEnd; sx += sqStep) {
        g.appendChild(svgEl('rect', {
          x: sx, y: y - sqSize / 2, width: sqSize, height: sqSize,
          fill: pColor,
        }));
      }

      g.appendChild(svgText(label, labelX, y, {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': fs, 'font-weight': '700', 'font-family': L.MONO, fill: pColor,
      }));
    } else {
      const start = x + 2;
      const end = x + L.COL_WIDTH - 2;
      for (let sx = start; sx + sqSize <= end; sx += sqStep) {
        g.appendChild(svgEl('rect', {
          x: sx, y: y - sqSize / 2, width: sqSize, height: sqSize,
          fill: pColor,
        }));
      }
    }
  } else if (subType === 'PH') {
    // PH: left side of play cell — sub happens BEFORE the at-bat
    drawVerticalSubLine(x + 4);
  } else if (subType === 'PR') {
    // PR: right side of play cell — sub happens AFTER the at-bat
    drawVerticalSubLine(x + L.COL_WIDTH - 4);
  }
  // Defensive switches do NOT draw lines in play cells.
  // They are reflected in the lineup display only.
}

// ─── Grid ────────────────────────────────────────────────────────

function drawGrid(svg, CLR, lineup, colMap, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows, activeCellKey, subMap, grid, lastPlayedInning, _isFinalGame) {
  const g = svgEl('g', { class: 'grid-lines' });
  const { innings } = colMap;

  // Cell backgrounds
  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    const y = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
    for (let inn = 1; inn <= innings; inn++) {
      const cellKey = `${slot.slot}-${inn}`;
      const isActive = cellKey === activeCellKey;
      const hasData = grid && grid.has(cellKey) && grid.get(cellKey).length > 0;
      const isFuture = lastPlayedInning > 0 && inn > lastPlayedInning;
      const emptyFill = isFuture ? CLR.cellBgFuture : CLR.cellBgEmpty;
      const bgFill = isActive ? CLR.activeCell : (hasData ? CLR.cellBg : emptyFill);
      // Get pitcher ID for this cell (from first at-bat)
      const cellPitcherId = hasData ? grid.get(cellKey)[0].pitcherId : null;
      // Fill all visual columns for this inning
      for (let sc = 0; sc < colMap.spans[inn - 1]; sc++) {
        const cx = colMap.colX(inn, sc);
        const rectAttrs = {
          x: cx + 0.5, y: y + 0.5,
          width: L.COL_WIDTH - 1, height: L.ROW_HEIGHT - 1,
          fill: bgFill, stroke: 'none',
          class: 'cell-bg',
        };
        if (cellPitcherId) rectAttrs['data-pitcher-id'] = cellPitcherId;
        g.appendChild(svgEl('rect', rectAttrs));
        if (isActive) {
          const bw = 3;
          g.appendChild(svgEl('rect', {
            x: cx + bw / 2, y: y + bw / 2,
            width: L.COL_WIDTH - bw, height: L.ROW_HEIGHT - bw,
            fill: 'none', stroke: CLR.activeBorder, 'stroke-width': bw,
          }));
        }
      }
    }
  }

  // Horizontal bold lines: always draw all lines (pitcher sub dashed lines draw on top later)
  for (let i = 0; i <= totalRows; i++) {
    const y = L.HEADER_HEIGHT + i * L.ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: width, y2: y, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  }

  // Summary row lines
  for (let i = 1; i <= summaryRows; i++) {
    const y = gridHeight + i * L.SUMMARY_ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: colMap.statsX(), y2: y, stroke: CLR.grid, 'stroke-width': 1 }));
  }

  // Vertical lines
  g.appendChild(svgEl('line', { x1: L.MARGIN_LEFT, y1: 0, x2: L.MARGIN_LEFT, y2: gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  for (let vc = 0; vc <= colMap.totalCols; vc++) {
    const x = L.MARGIN_LEFT + vc * L.COL_WIDTH;
    // Use bold line at inning boundaries, thin line for sub-columns within an inning
    let isBoundary = false;
    let cumCol = 0;
    for (let inn = 1; inn <= innings; inn++) {
      if (vc === cumCol) { isBoundary = true; break; }
      cumCol += colMap.spans[inn - 1];
    }
    if (vc === colMap.totalCols) isBoundary = true;
    const sw = isBoundary ? 1.5 : 0.75;
    // Non-boundary lines (bat-around sub-columns) stop at gridHeight; boundary lines extend into summary
    const lineBottom = isBoundary ? gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT : gridHeight;
    g.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: lineBottom, stroke: CLR.grid, 'stroke-width': sw }));
  }
  const statsX = colMap.statsX();
  const statsBottom = gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT;
  g.appendChild(svgEl('line', { x1: statsX, y1: 0, x2: statsX, y2: statsBottom, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  for (let i = 1; i <= STAT_HEADERS.length; i++) {
    g.appendChild(svgEl('line', { x1: statsX + i * L.STATS_COL_WIDTH, y1: 0, x2: statsX + i * L.STATS_COL_WIDTH, y2: statsBottom, stroke: CLR.grid, 'stroke-width': 1 }));
  }

  g.appendChild(svgEl('rect', { x: 0, y: 0, width, height: gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT, fill: 'none', stroke: CLR.gridBold, 'stroke-width': 2.5 }));

  svg.appendChild(g);
}

// ─── Header ──────────────────────────────────────────────────────

function drawHeader(svg, CLR, colMap, statsWidth) {
  const g = svgEl('g', { class: 'header' });
  g.appendChild(svgEl('rect', { x: 0, y: 0, width: colMap.statsX() + statsWidth, height: L.HEADER_HEIGHT, fill: CLR.headerBg }));
  for (let inn = 1; inn <= colMap.innings; inn++) {
    // Center inning number across all visual columns for this inning
    const spanW = colMap.spanWidth(inn);
    const centerX = colMap.colX(inn) + spanW / 2;
    g.appendChild(svgText(String(inn), centerX, L.HEADER_HEIGHT / 2, {
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': '20', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));
    // Vertical divider line between innings
    const innX = colMap.colX(inn);
    g.appendChild(svgEl('line', {
      x1: innX, y1: 0, x2: innX, y2: L.HEADER_HEIGHT,
      stroke: CLR.grid, 'stroke-width': 1,
    }));
  }
  // Right edge divider
  const lastInn = colMap.innings;
  const rightX = colMap.colX(lastInn) + colMap.spanWidth(lastInn);
  g.appendChild(svgEl('line', {
    x1: rightX, y1: 0, x2: rightX, y2: L.HEADER_HEIGHT,
    stroke: CLR.grid, 'stroke-width': 1,
  }));
  svg.appendChild(g);
}

function drawStatHeaders(svg, CLR, colMap) {
  const g = svgEl('g', { class: 'stat-headers' });
  const baseX = colMap.statsX();
  for (let i = 0; i < STAT_HEADERS.length; i++) {
    g.appendChild(svgText(STAT_HEADERS[i], baseX + i * L.STATS_COL_WIDTH + L.STATS_COL_WIDTH / 2, L.HEADER_HEIGHT / 2, {
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));
  }
  svg.appendChild(g);
}

// ─── Lineup (left margin) ────────────────────────────────────────

function drawLineup(svg, CLR, lineup, rowOffsets, boxscore, gameData, side, _subMap) {
  const g = svgEl('g', { class: 'lineup' });
  const team = boxscore.teams[side];
  const players = team.players;

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    const baseY = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
    const numPlayers = slot.players.length;

    // Vertical spacing: stack all players evenly within one ROW_HEIGHT
    // Each player gets a vertical "band" within the row
    const bandHeight = L.ROW_HEIGHT / Math.max(1, numPlayers);

    for (let pIdx = 0; pIdx < numPlayers; pIdx++) {
      const player = slot.players[pIdx];
      const bandY = baseY + pIdx * bandHeight;
      const playerData = players[`ID${player.id}`];
      const seasonBatting = playerData?.seasonStats?.batting;
      const avg = seasonBatting?.avg || '';
      const isSub = player.isSubstitute;

      const jerseyNum = player.jerseyNumber || '';

      if (!isSub) {
        // No separate number; jersey # is already in the name label
      } else {
        // Horizontal dotted sub line at top of sub band (matches play cell sub style)
        const lineY = bandY;
        const lineStartX = 4;
        const lineEndX = L.MARGIN_LEFT - 4;
        const sqSize = 5;
        const sqGap = 4;
        const sqStep = sqSize + sqGap;
        for (let sx = lineStartX; sx + sqSize <= lineEndX; sx += sqStep) {
          g.appendChild(svgEl('rect', {
            x: sx, y: lineY - sqSize / 2, width: sqSize, height: sqSize,
            fill: CLR.sub,
          }));
        }
      }

      // Align sub player text with the right edge of the circle
      const textX = isSub ? Math.round(L.MARGIN_LEFT * L.SUB_TEXT_POS) : 8;
      const posNum = POS_ABBREV[player.position];
      const posStr = posNum !== undefined ? String(posNum) : '';
      const batSide = getPlayerBatSide(gameData, player.id);

      const ops = seasonBatting?.ops || '';

      // Use foreignObject to embed HTML — exact same rendering as pitcher tables
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('x', textX);
      fo.setAttribute('y', bandY + 4);
      fo.setAttribute('width', L.MARGIN_LEFT - textX - 4);
      fo.setAttribute('height', bandHeight - 8);

      const wrapper = document.createElement('div');
      wrapper.className = 'lineup-name-html';

      // Shorten name if needed: "F. Lastname Jr."
      let displayName = player.name;
      const maxChars = 18;
      if (displayName.length > maxChars && displayName.includes(' ')) {
        const suffixes = ['Jr.', 'Sr.', 'II', 'III', 'IV'];
        const parts = displayName.split(' ');
        const suffix = suffixes.includes(parts[parts.length - 1]) ? ' ' + parts.pop() : '';
        const last = parts[parts.length - 1];
        displayName = parts[0][0] + '. ' + last + suffix;
      }

      // Line 1: position + name link + bat side
      const line1 = document.createElement('div');
      line1.className = 'lineup-line1';
      line1.innerHTML = `${posStr ? posStr + ' ' : ''}${playerLink(displayName, player.id, { inSVG: true })}${batSide ? `<span class="hand-indicator">, ${batSide}</span>` : ''}`;
      wrapper.appendChild(line1);

      // Line 2: jersey + stats
      const line2 = document.createElement('div');
      line2.className = 'lineup-line2';
      const line2Parts = [];
      if (jerseyNum) line2Parts.push(`#${jerseyNum}`);
      if (avg) line2Parts.push(`${avg} AVG`);
      if (ops) line2Parts.push(`${ops} OPS`);
      line2.textContent = line2Parts.join('  ');
      wrapper.appendChild(line2);

      fo.appendChild(wrapper);
      g.appendChild(fo);
    }
  }

  svg.appendChild(g);
}

// ─── At-bat cells ────────────────────────────────────────────────

function drawAtBats(svg, CLR, lineup, grid, rowOffsets, colMap, subMap, subNumberMap, activeCellKey, lastPlayedInning, isFinalGame) {
  const g = svgEl('g', { class: 'at-bats' });
  const { innings } = colMap;

  // Pre-compute pitcher S/P counts and ABS challenge numbers
  const pitcherTotals = new Map();
  const pitcherSubStats = new Map();
  let lastPitcherId = null;
  const challengeCounts = new Map(); // teamId -> running count of challenges used
  for (let inn = 1; inn <= innings; inn++) {
    for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
      const slot = lineup[slotIdx];
      const key = `${slot.slot}-${inn}`;

      const atBats = grid.get(key);
      if (atBats) {
        for (const ab of atBats) {
          const pid = ab.pitcherId;
          if (!pitcherTotals.has(pid)) pitcherTotals.set(pid, { strikes: 0, pitches: 0, ks: 0 });
          const t = pitcherTotals.get(pid);
          for (const p of ab.pitchSequence || []) {
            t.pitches++;
            const c = p.callCode;
            if (c === 'C' || c === 'S' || c === 'F' || c === 'W' || c === 'T' || c === 'X') t.strikes++;
            // Track ABS challenge numbers per team
            if (p.challenged && p.challengeTeamId) {
              const tid = p.challengeTeamId;
              const count = (challengeCounts.get(tid) || 0) + 1;
              challengeCounts.set(tid, count);
              p.challengeLabel = `${p.overturned ? 'W' : 'L'}${count}`;
            }
          }
          if (ab.notation === 'K' || ab.notation === '\u{A4D8}') t.ks++;
          lastPitcherId = pid;
        }
      }

      const subs = subMap.get(key);
      if (subs) {
        for (const sub of subs) {
          if (sub.type === 'pitcher' && lastPitcherId) {
            const t = pitcherTotals.get(lastPitcherId);
            if (t) pitcherSubStats.set(key, { strikes: t.strikes, pitches: t.pitches, ks: t.ks });
          }
        }
      }
    }
  }

  // Pass 1: Draw substitution indicators first (bottom layer)
  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    for (let inn = 1; inn <= innings; inn++) {
      const key = `${slot.slot}-${inn}`;
      const y = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
      const cellAbs = grid.get(key);
      const isBatAround = cellAbs && cellAbs.length > 1;
      const subs = subMap.get(key);
      if (subs) {
        const sorted = [...subs].sort((a, b) => (a.type === 'pitcher' ? 1 : 0) - (b.type === 'pitcher' ? 1 : 0));
        // Determine the cell background for the cover rect
        const hasData = cellAbs && cellAbs.length > 0;
        const isActive = key === activeCellKey;
        const isFuture = lastPlayedInning > 0 && inn > lastPlayedInning;
        const cellBgColor = isActive ? CLR.activeCell : (hasData ? CLR.cellBg : (isFuture ? CLR.cellBgFuture : CLR.cellBgEmpty));
        for (const sub of sorted) {
          if (isBatAround && (sub.type === 'PH' || sub.type === 'PR')) continue;
          const subX = colMap.colX(inn);
          const subNum = subNumberMap.get(sub.playerId) || 0;
          const pStats = sub.type === 'pitcher' ? pitcherSubStats.get(key) : null;
          // Pitcher sub line at bottom of cell (exit door); others at top
          const subY = sub.type === 'pitcher' ? y + L.ROW_HEIGHT : y;
          drawSubIndicator(g, CLR, subX, subY, sub.type, subNum, pStats, cellBgColor);
        }
      }
    }
  }

  // Pass 2: Draw at-bat cells on top (ABS badges, pitches, etc. above sub lines)
  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    for (let inn = 1; inn <= innings; inn++) {
      const key = `${slot.slot}-${inn}`;
      const y = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
      const atBats = grid.get(key);
      if (atBats && atBats.length > 0) {
        const nextSlot = slotIdx + 1 < lineup.length ? lineup[slotIdx + 1] : null;
        const belowKey = nextSlot ? `${nextSlot.slot}-${inn}` : null;
        const hasPitcherSubBelow = belowKey && subMap.get(belowKey)?.some(s => s.type === 'pitcher');
        for (let ai = 0; ai < atBats.length; ai++) {
          const x = colMap.colX(inn, ai);
          drawAtBatCell(g, CLR, atBats[ai], x, y, hasPitcherSubBelow);
        }
      }
    }
  }

  // Inning flow notch: a single 45° line (top-right → bottom-left) crossing
  // through the bottom-right corner of the cell where the 3rd out is recorded.
  const notchHalf = 14;
  const notchSW = L.DIAMOND_SW;
  for (let inn = 1; inn <= innings; inn++) {
    let thirdOutSlotIdx = -1;
    for (let si = 0; si < lineup.length; si++) {
      const key = `${lineup[si].slot}-${inn}`;
      const abs = grid.get(key);
      if (!abs) continue;
      for (const ab of abs) {
        // Check if this at-bat produced the 3rd out (batter or any runner)
        const has3rdOut = ab.outNumber === 3 ||
          (ab.runners && ab.runners.some(r => r.outNumber === 3));
        if (has3rdOut) thirdOutSlotIdx = si;
      }
    }
    if (thirdOutSlotIdx < 0) continue;

    const cx = colMap.colX(inn, colMap.spans[inn - 1] - 1) + L.COL_WIDTH;
    const cy = L.HEADER_HEIGHT + (rowOffsets[thirdOutSlotIdx] + 1) * L.ROW_HEIGHT;

    g.appendChild(svgEl('line', {
      x1: cx + notchHalf, y1: cy - notchHalf,
      x2: cx - notchHalf, y2: cy + notchHalf,
      stroke: CLR.text, 'stroke-width': notchSW,
    }));
  }

  // Last pitcher stats: only draw at the bottom of the final at-bat cell
  // when the game is Final. During live games this would create a phantom
  // sub line suggesting the current pitcher has been replaced.
  if (isFinalGame && lastPitcherId && pitcherTotals.has(lastPitcherId)) {
    // Find the last cell that has at-bat data (scan innings in reverse, then slots in reverse)
    let lastCellX = -1;
    let lastCellY = -1;
    outer:
    for (let inn = innings; inn >= 1; inn--) {
      for (let si = lineup.length - 1; si >= 0; si--) {
        const key = `${lineup[si].slot}-${inn}`;
        const abs = grid.get(key);
        if (abs && abs.length > 0) {
          const lastAi = abs.length - 1;
          lastCellX = colMap.colX(inn, lastAi);
          lastCellY = L.HEADER_HEIGHT + rowOffsets[si] * L.ROW_HEIGHT;
          break outer;
        }
      }
    }
    if (lastCellX >= 0) {
      const t = pitcherTotals.get(lastPitcherId);
      const bottomY = lastCellY + L.ROW_HEIGHT;
      drawSubIndicator(g, CLR, lastCellX, bottomY, 'pitcher', 0,
        { strikes: t.strikes, pitches: t.pitches, ks: t.ks }, CLR.cellBg);
    }
  }

  svg.appendChild(g);
}

function drawAtBatCell(g, CLR, ab, x, y, hasPitcherSubBelow) {
  const isHR = ab.notation === 'HR';
  const isPlacedRunner = ab.isPlacedRunner;
  const subBelowShift = hasPitcherSubBelow ? 10 : 0;

  // ── Grid system ──
  // Consistent inner padding for breathing room (sub lines sit on cell edges)
  const PAD = 10;
  const TOP_ROW_H = 22;    // height of top row (out circle + count + first pitch baseline)
  const BOT_ROW_H = 28;    // height of bottom row (RBI + notation + strike zone)

  // Pitch area: right side, single column always
  const pitchCount = ab.pitchSequence.length;
  const pitchAreaW = L.PITCH_COL_W;
  const PITCH_GAP = 14; // breathing room between main area and pitches
  const PITCH_PAD_R = 12; // right padding for pitch column
  const pitchX = x + L.COL_WIDTH - PITCH_PAD_R - pitchAreaW;

  // Main area: left side (for diamond, notation, out badge, RBI)
  const mainLeft = x + PAD;
  const mainRight = pitchX - PITCH_GAP;
  const mainW = mainRight - mainLeft;
  const mainCx = mainLeft + mainW / 2;

  // Vertical zones
  const topY = y + PAD;                              // top of content area
  const midTop = topY + TOP_ROW_H;                   // top of middle zone (diamond area)
  const botY = y + L.ROW_HEIGHT - PAD - BOT_ROW_H;  // top of bottom row
  const midBot = botY;                                // bottom of middle zone
  const midCy = (midTop + midBot) / 2 - 10 - subBelowShift; // diamond center Y

  // ── Top row: out badge (left), count (right of main area) ──
  // Skip count and pitch sequence for placed runners (no at-bat)
  if (!isPlacedRunner) {
    const count = computeCount(ab.pitchSequence);
    g.appendChild(svgText(count, pitchX - PITCH_GAP * 2, topY + TOP_ROW_H / 2 - 2, {
      'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.textLight,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
    }));

    // ── Pitches (right side) ──
    const needsScroll = pitchCount > PITCH_OVERFLOW;
    if (needsScroll) {
      drawScrollablePitchSequence(g, CLR, ab.pitchSequence, pitchX, topY, pitchAreaW, y);
    } else {
      drawPitchSequence(g, CLR, ab.pitchSequence, pitchX, topY, false);
      drawMiniStrikeZone(g, CLR, ab.pitchSequence, pitchX, y, pitchAreaW, ab.batSide, ab.pitchHand);
    }
  }

  // ── Diamond logic ──
  const isSF = ab.result?.eventType === 'sac_fly';
  const isStrikeout = ab.result?.eventType === 'strikeout';
  let hasRunners;
  if (isSF) {
    hasRunners = false;
  } else if (isStrikeout) {
    const batterReached = ab.runners && ab.runners.some(r => r.playerId === ab.batterId && r.end && !r.isOut);
    hasRunners = !!batterReached;
  } else {
    hasRunners = (ab.cumulativeRunners && ab.cumulativeRunners.length > 0) ||
      (ab.runners && ab.runners.some(r => r.playerId === ab.batterId && r.end && !r.isOut));
  }
  const alwaysDiamond = isHR || ab.result?.eventType === 'hit_by_pitch' || ab.result?.eventType === 'catcher_interf';
  // Ensure diamond fits within main area: left point must not go past mainLeft
  const diamondR = L.DIAMOND_R;
  const minCx = mainLeft + diamondR + 4; // 4px breathing room from left edge
  const diamondCx = Math.max(mainCx, minCx);
  const diamondCy = midCy;

  // Did the batter score (go all the way around)? Out overrides scored.
  const batterRunner = (ab.cumulativeRunners || []).find(r => r.playerId === ab.batterId);
  const batterScored = (batterRunner?.scored && !batterRunner?.isOut) || false;

  if (hasRunners || alwaysDiamond) {
    drawDiamond(g, CLR, diamondCx, diamondCy, ab, isHR, batterScored && !isHR);
  }

  // ── Placed runner "DR" notation ──
  if (isPlacedRunner) {
    const drY = diamondCy + L.DIAMOND_R + 18;
    g.appendChild(svgText('DR', diamondCx, drY, {
      'font-size': '18', 'font-weight': '700', 'text-anchor': 'middle',
      'dominant-baseline': 'central', 'font-family': L.MONO, fill: CLR.textLight,
    }));
  }

  // ── Notation ──
  const notation = ab.notation;
  const largeSize = Math.round(L.DIAMOND_R * 1.8);
  const maxFitSize = (len) => Math.floor(mainW * 0.9 / (0.6 * Math.max(len, 1)));
  const isHit = notation === '1B' || notation === '2B' || notation === '3B';

  if (isHR) {
    g.appendChild(svgText('HR', diamondCx, diamondCy, {
      'font-size': '28', 'font-weight': '900', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': L.MONO, fill: CLR.bg,
    }));
  } else if (notation && !isHit) {
    const notationColor = CLR.text;
    const isK = notation === 'K' || notation === '\u{A4D8}';
    const isWalk = notation === 'BB' || notation === 'IBB' || notation === 'HBP' || notation === 'CI';
    const dpSplitMatch = notation.match(/^(DP|TP|KDP)([\d][\d-]*)$/);

    if (hasRunners || alwaysDiamond) {
      // Notation centered below the diamond
      const notY = diamondCy + diamondR + 18;

      if (dpSplitMatch) {
        // DP/TP: render in center of cell, same weight as other out notations
        const prefix = dpSplitMatch[1];
        const positions = dpSplitMatch[2];
        const maxLen = Math.max(prefix.length, positions.length);
        const fitSize = Math.min(Math.round(largeSize * 0.4), maxFitSize(maxLen));
        const lineGap = fitSize * 0.55;
        g.appendChild(svgText(prefix, diamondCx, diamondCy - lineGap, {
          'font-size': String(fitSize), 'font-weight': '400', 'font-family': L.MONO, fill: notationColor,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
        }));
        g.appendChild(svgText(positions, diamondCx, diamondCy + lineGap, {
          'font-size': String(fitSize), 'font-weight': '400', 'font-family': L.MONO, fill: notationColor,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
        }));
      } else {
        const fitSize = String(Math.min(20, maxFitSize(notation.length)));
        g.appendChild(svgText(notation, diamondCx, notY, {
          'font-size': fitSize, 'font-weight': '700', 'font-family': L.MONO, fill: notationColor,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
        }));
      }
    } else {
      // No diamond: notation centered in middle zone
      let notFontWeight = isWalk ? '900' : '400';
      const isDP = !!dpSplitMatch;
      const scale = isWalk ? 1 : isK ? 0.7 : isDP ? 0.7 : 0.6;
      if (isDP) notFontWeight = '700';
      const ideal = Math.round(largeSize * scale);
      const notFontSize = String(Math.min(ideal, maxFitSize(notation.length)));

      const parenMatch = notation.match(/^([A-Za-z\d]+)\(([A-Z]+)\)$/);
      const splitMatch = dpSplitMatch || parenMatch || (notation.length > 4 && notation.match(/^([A-Za-z\u{A4D8}]{2,})([\d][\d]*)$/u));
      if (splitMatch) {
        const prefix = splitMatch[1];
        const nums = splitMatch[2];
        const maxLen = Math.max(prefix.length, nums.length);
        const fitSize = Math.min(parseInt(notFontSize) * 1.4, maxFitSize(maxLen));
        const lineGap = fitSize * 0.55;
        // Shift down to avoid colliding with out badge in top-left
        const splitCy = diamondCy + fitSize * 0.3;
        g.appendChild(svgText(prefix, diamondCx, splitCy - lineGap, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': String(Math.round(fitSize)), 'font-weight': notFontWeight,
          'font-family': L.MONO, fill: notationColor,
        }));
        g.appendChild(svgText(nums, diamondCx, splitCy + lineGap, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': String(Math.round(fitSize)), 'font-weight': notFontWeight,
          'font-family': L.MONO, fill: notationColor,
        }));
      } else {
        g.appendChild(svgText(notation, diamondCx, diamondCy, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': notFontSize, 'font-weight': notFontWeight,
          'font-family': L.MONO, fill: notationColor,
        }));
      }
    }
  }

  // ── Bottom row: RBI diamonds (left) ──
  if (ab.rbi && ab.rbi > 0) {
    const rbiR = L.SUB_CIRCLE_R;
    const rbiSpacing = rbiR * 2 + 4;
    const rbiBaseX = mainLeft + rbiR + 4;
    const rbiBaseY = botY + BOT_ROW_H / 2;
    for (let i = 0; i < ab.rbi; i++) {
      const cx = rbiBaseX + i * rbiSpacing;
      g.appendChild(svgEl('polygon', {
        points: `${cx},${rbiBaseY - rbiR} ${cx + rbiR},${rbiBaseY} ${cx},${rbiBaseY + rbiR} ${cx - rbiR},${rbiBaseY}`,
        fill: CLR.text,
      }));
    }
  }

  // ── Top row: Out badge (top-left, inside padding) ──
  if (ab.outNumber) {
    const badgeR = Math.round(L.SUB_CIRCLE_R * 1.45);
    const badgeCx = mainLeft + badgeR + 2;
    const badgeCy = topY + badgeR + 2;  // top of circle aligns with top of count text
    drawOutMarker(g, badgeCx, badgeCy, CLR.outBadge, ab.outNumber, CLR.bg, badgeR);
  }
}

function computeCount(pitches) {
  let balls = 0, strikes = 0;
  for (const p of pitches) {
    const c = p.callCode;
    if (c === 'B' || c === '*') balls++;
    else if (c === 'C' || c === 'S' || c === 'W' || c === 'T') {
      if (strikes < 2) strikes++;
    } else if (c === 'F') {
      if (strikes < 2) strikes++;
    }
  }
  return `${balls}-${strikes}`;
}

// ─── Scrollable pitch sequence (>10 pitches, foreignObject) ──────

function drawScrollablePitchSequence(g, CLR, pitches, pitchX, topY, colW, cellY) {
  const fs = L.PITCH_FONT_SIZE;
  const step = L.PITCH_STEP;
  const scrollH = L.ROW_HEIGHT - (topY - cellY) - 8; // available height

  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', pitchX);
  fo.setAttribute('y', topY);
  fo.setAttribute('width', colW);
  fo.setAttribute('height', scrollH);

  const div = document.createElement('div');
  div.style.cssText = `
    width: ${colW}px; height: ${scrollH}px; overflow-y: auto; overflow-x: hidden;
    scrollbar-width: thin; scrollbar-color: ${CLR.grid} transparent;
  `;

  // Build pitch rows as tiny inline SVGs inside the scrollable div
  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const color = pitchColor(pitch.callCode, CLR);
    const isInPlay = pitch.callCode === 'X' || pitch.callCode === 'D' || pitch.callCode === 'E';
    const fw = isInPlay ? '700' : '400';
    const typeLabel = pitch.typeCode || '';
    const speed = pitch.speed ? String(Math.round(pitch.speed)) : '';

    const rowSvg = document.createElementNS(SVG_NS, 'svg');
    rowSvg.setAttribute('width', colW);
    rowSvg.setAttribute('height', step);
    rowSvg.setAttribute('viewBox', `0 0 ${colW} ${step}`);
    rowSvg.style.display = 'block';

    const midX = colW / 2;
    const textY = fs;

    // Challenge badge
    const hasBadge = !!pitch.challenged;
    const badgeSize = fs;
    if (hasBadge) {
      const label = pitch.overturned ? 'W' : 'L';
      const typeW = typeLabel.length * fs * 0.55;
      const sqX = midX + 3 + typeW + 4;
      const sqY = textY - badgeSize + 2;
      rowSvg.appendChild(svgEl('rect', { x: sqX, y: sqY, width: badgeSize, height: badgeSize, fill: CLR.challenge }));
      rowSvg.appendChild(svgText(label, sqX + badgeSize / 2, sqY + badgeSize / 2, {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': String(badgeSize - 2), 'font-weight': '700', 'font-family': L.MONO, fill: '#ffffff',
      }));
    }

    if (speed) {
      rowSvg.appendChild(svgText(speed, midX - 3, textY, {
        'font-size': String(fs), 'font-weight': fw, 'font-family': L.MONO, fill: color, 'text-anchor': 'end',
      }));
    }
    if (typeLabel) {
      rowSvg.appendChild(svgText(typeLabel, midX + 3, textY, {
        'font-size': String(fs), 'font-weight': fw, 'font-family': L.MONO, fill: color,
      }));
    }

    div.appendChild(rowSvg);
  }

  fo.appendChild(div);
  g.appendChild(fo);
}

// ─── Vertical pitch sequence (call code · pitch type · speed) ────

const PITCH_OVERFLOW = 10; // hide strike zone above this count

function drawPitchSequence(g, CLR, pitches, pitchX, topY, twoCols) {
  if (pitches.length === 0) return;

  const colW = L.PITCH_COL_W;
  const fs = String(L.PITCH_FONT_SIZE);
  const startY = topY;

  if (twoCols) {
    const half = Math.ceil(pitches.length / 2);
    const step = Math.min(L.PITCH_STEP, (L.ROW_HEIGHT * 0.72) / Math.max(half, 1));
    for (let i = 0; i < pitches.length; i++) {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const colBaseX = pitchX + col * (colW + 2);
      drawSinglePitch(g, CLR, pitches[i], colBaseX, startY, row, step, colW, fs);
    }
  } else {
    const szRegionH = pitches.length <= PITCH_OVERFLOW ? L.ROW_HEIGHT * 0.28 : 0;
    const availH = L.ROW_HEIGHT - 20 - szRegionH; // 20 = top padding
    const step = Math.min(L.PITCH_STEP, availH / Math.max(pitches.length, 1));
    for (let i = 0; i < pitches.length; i++) {
      drawSinglePitch(g, CLR, pitches[i], pitchX, startY, i, step, colW, fs);
    }
  }
}

function drawSinglePitch(g, CLR, pitch, colBaseX, startY, row, step, colW, fs) {
  const color = pitchColor(pitch.callCode, CLR);
  const isInPlay = pitch.callCode === 'X' || pitch.callCode === 'D' || pitch.callCode === 'E';
  const fw = isInPlay ? '700' : '400';
  const textY = startY + row * step + L.PITCH_FONT_SIZE;
  const midX = colBaseX + colW / 2;
  const fsi = parseInt(fs);

  // ABS challenge badge: purple square with W/L, right-aligned at end of column
  const hasBadge = !!pitch.challenged;

  // Speed (94, 87, etc.) - left of center, right-aligned
  const speed = pitch.speed ? String(Math.round(pitch.speed)) : '';
  if (speed) {
    g.appendChild(svgText(speed, midX - 3, textY, {
      'font-size': fs, 'font-weight': fw, 'font-family': L.MONO, fill: color,
      'text-anchor': 'end',
    }));
  }

  // Pitch type (FF / SL / CU / CH) - right of center, left-aligned
  const typeLabel = pitch.typeCode || '';
  if (typeLabel) {
    g.appendChild(svgText(typeLabel, midX + 3, textY, {
      'font-size': fs, 'font-weight': fw, 'font-family': L.MONO, fill: color,
    }));
  }

  // Badge after type, aligned to the right edge of the pitch column
  if (hasBadge) {
    const label = pitch.overturned ? 'W' : 'L';
    const badgeSize = fsi;
    const typeW = typeLabel.length * fsi * 0.55;
    const sqX = midX + 3 + typeW + 4;
    const sqY = textY - badgeSize + 2;
    g.appendChild(svgEl('rect', {
      x: sqX, y: sqY, width: badgeSize, height: badgeSize,
      fill: CLR.challenge,
    }));
    g.appendChild(svgText(label, sqX + badgeSize / 2, sqY + badgeSize / 2, {
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': String(badgeSize - 2), 'font-weight': '700', 'font-family': L.MONO, fill: '#ffffff',
    }));
  }
}

// ─── Mini strike zone (bottom 1/3 of pitch column) ──────────────

function drawMiniStrikeZone(g, CLR, pitches, pitchX, cellY, pitchColW, batSide, pitchHand) {
  if (pitches.length === 0 || pitches.length > PITCH_OVERFLOW) return;

  const regionH = L.ROW_HEIGHT * 0.28;
  const padX = 6;
  const padTop = 4;
  const padBot = 8;
  const maxW = pitchColW - padX * 2;
  const maxH = regionH - padTop - padBot;
  // Real strike zone is tall portrait (~1:2 w:h ratio)
  const aspect = 2.0;
  let zoneH = maxH;
  let zoneW = zoneH / aspect;
  if (zoneW > maxW) { zoneW = maxW; zoneH = zoneW * aspect; }
  const zoneX = pitchX + padX + (maxW - zoneW) / 2;
  const zoneY = cellY + L.ROW_HEIGHT - regionH + padTop + (maxH - zoneH) / 2;

  // Clamp boundaries to keep dots inside the cell
  const clipTop = cellY + L.ROW_HEIGHT - regionH;
  const clipBot = cellY + L.ROW_HEIGHT - padBot;
  const mapX = (pX) => zoneX + ((pX + PX_RANGE / 2) / PX_RANGE) * zoneW;
  const mapY = (pZ) => Math.max(clipTop, Math.min(clipBot, zoneY + (1 - (pZ - PZ_MIN) / (PZ_MAX - PZ_MIN)) * zoneH));

  const avgTop = averageZoneEdge(pitches, 'szTop', 3.4);
  const avgBot = averageZoneEdge(pitches, 'szBot', 1.6);
  const szLeft = Math.min(mapX(-SZ_HALF_PLATE), mapX(SZ_HALF_PLATE));
  const szRight = Math.max(mapX(-SZ_HALF_PLATE), mapX(SZ_HALF_PLATE));
  const szTopY = mapY(avgTop);
  const szBotY = mapY(avgBot);

  // Batter silhouette pill (behind zone and pitches)
  if (batSide === 'R' || batSide === 'L') {
    const zoneW = szRight - szLeft;
    const zoneH = szBotY - szTopY;
    const pillW = zoneW * 0.55;
    const pillH = zoneH * 1.3;
    const pillY = szTopY + zoneH / 2 - pillH / 2;
    const gap = pillW;
    // From catcher's view: R batter stands to catcher's left, L to catcher's right
    const pillX = batSide === 'R'
      ? szLeft - gap - pillW
      : szRight + gap;
    g.appendChild(svgEl('rect', {
      x: pillX, y: pillY, width: pillW, height: pillH,
      rx: pillW / 2, ry: pillW / 2,
      fill: CLR.text, opacity: 0.25,
    }));

    // Pitcher silhouette pill (sits on the zone edge, sticks out above)
    if (pitchHand === 'R' || pitchHand === 'L') {
      const pPillW = zoneW * 0.35;
      const pPillH = zoneH * 0.7;
      const pPillCY = szTopY - pPillH * 0.35;
      // Centered on the zone's left or right edge line
      const pPillX = pitchHand === 'R'
        ? szRight - pPillW / 2
        : szLeft - pPillW / 2;
      g.appendChild(svgEl('rect', {
        x: pPillX, y: pPillCY, width: pPillW, height: pPillH,
        rx: pPillW / 2, ry: pPillW / 2,
        fill: CLR.text, opacity: 0.25,
      }));
    }
  }

  g.appendChild(svgEl('rect', {
    x: szLeft, y: szTopY,
    width: szRight - szLeft, height: szBotY - szTopY,
    fill: 'none', stroke: CLR.grid, 'stroke-width': 0.75,
  }));

  for (const pitch of pitches) {
    if (pitch.pX === null || pitch.pZ === null) continue;
    const dotX = mapX(pitch.pX);
    const dotY = mapY(pitch.pZ);
    // Challenged pitches show in purple; others use normal pitch color
    const color = pitch.challenged ? CLR.challenge : pitchColor(pitch.callCode, CLR);
    const dotR = pitch.challenged ? 3.5 : 2.5;

    g.appendChild(svgEl('circle', {
      cx: dotX, cy: dotY, r: dotR,
      fill: color,
    }));
  }
}

function averageZoneEdge(pitches, field, fallback) {
  let sum = 0, count = 0;
  for (const p of pitches) {
    if (p[field] !== null && p[field] !== undefined) { sum += p[field]; count++; }
  }
  return count > 0 ? sum / count : fallback;
}

// ─── Diamond rendering ───────────────────────────────────────────

// Figma-matched diamond constants (from 134-unit Figma diamond, scaled to DIAMOND_R)
const FIGMA_R = 67; // Figma diamond half-size
// These are now read from L.BASE_PATH_SW, L.HASH_SW, L.DIAMOND_SW via layout-config

function drawDiamond(g, CLR, cx, cy, ab, isHR = false, scoredNotHR = false) {
  const R = L.DIAMOND_R;
  const hp = { x: cx, y: cy + R };       // bottom
  const b1 = { x: cx + R, y: cy };       // right
  const b2 = { x: cx, y: cy - R };       // top
  const b3 = { x: cx - R, y: cy };       // left
  const pts = `${hp.x},${hp.y} ${b1.x},${b1.y} ${b2.x},${b2.y} ${b3.x},${b3.y}`;

  if (isHR) {
    // HR: fully filled black diamond
    g.appendChild(svgEl('polygon', {
      points: pts,
      fill: CLR.text, stroke: CLR.text, 'stroke-width': L.DIAMOND_SW,
    }));
  } else if (scoredNotHR) {
    // Runner scored (not HR): exactly 3 diagonal lines inside the diamond
    const clipId = `hatch-clip-${cx}-${cy}`;
    const defs = svgEl('defs', {});
    const clipPath = svgEl('clipPath', { id: clipId });
    clipPath.appendChild(svgEl('polygon', { points: pts }));
    defs.appendChild(clipPath);
    g.appendChild(defs);
    const hatchG = svgEl('g', { 'clip-path': `url(#${clipId})` });
    const sw = L.BASE_PATH_SW;
    const spacing = R * 0.5;
    for (let i = -1; i <= 1; i++) {
      const offset = i * spacing;
      hatchG.appendChild(svgEl('line', {
        x1: cx - R - 5, y1: cy + offset + R + 5,
        x2: cx + R + 5, y2: cy + offset - R - 5,
        stroke: CLR.text, 'stroke-width': sw, 'stroke-linecap': 'square',
      }));
    }
    g.appendChild(hatchG);
  }

  // Base path lines from runner journeys, drawn as polylines for clean corners
  const cumRunners = ab.cumulativeRunners;
  if (cumRunners && cumRunners.length > 0) {
    for (const runner of cumRunners) {
      // Find the out segment to know where to truncate
      const outSeg = runner.isOut ? runner.segments.find(s => s.isOutSegment) : null;
      let outMx, outMy;
      if (outSeg) {
        const oFrom = diamondPt(cx, cy, R, outSeg.from);
        const oTo = diamondPt(cx, cy, R, outSeg.to);
        outMx = (oFrom.x + oTo.x) / 2;
        outMy = (oFrom.y + oTo.y) / 2;
      }

      // Build connected point list for non-out segments
      const points = [];
      const outPoints = [];
      for (const seg of runner.segments) {
        const from = diamondPt(cx, cy, R, seg.from);
        const to = diamondPt(cx, cy, R, seg.to);
        if (seg.isOutSegment && outSeg) {
          // Out segment drawn separately (truncated to midpoint)
          outPoints.push(`${from.x},${from.y}`, `${outMx},${outMy}`);
        } else {
          if (points.length === 0) points.push(`${from.x},${from.y}`);
          points.push(`${to.x},${to.y}`);
        }
      }

      if (points.length > 1) {
        g.appendChild(svgEl('polyline', {
          points: points.join(' '),
          stroke: CLR.text, 'stroke-width': L.BASE_PATH_SW,
          fill: 'none', 'stroke-linejoin': 'miter', 'stroke-linecap': 'square',
        }));
      }
      if (outPoints.length > 0) {
        g.appendChild(svgEl('polyline', {
          points: outPoints.join(' '),
          stroke: CLR.text, 'stroke-width': L.BASE_PATH_SW,
          fill: 'none', 'stroke-linecap': 'square',
        }));
      }

      if (runner.isOut) {
        // Skip drawing other runners' out markers in the batter's cell (DP case)
        // — those outs belong in the runner's own cell, not duplicated here
        if (runner.playerId !== ab.batterId) continue;
        const outR = Math.round(L.SUB_CIRCLE_R * 1.45);
        if (outSeg) {
          drawOutMarker(g, outMx, outMy, CLR.outBadge, runner.outNumber, CLR.bg, outR);
        } else if (runner.outBase) {
          const pos = diamondPt(cx, cy, R, runner.outBase);
          drawOutMarker(g, pos.x, pos.y, CLR.outBadge, runner.outNumber, CLR.bg, outR);
        }
      }
    }
  } else {
    // Fallback: build polyline from per-AB runners
    const segments = computeBasePathSegments(ab, CLR);
    if (segments.length > 0) {
      const points = [];
      for (const seg of segments) {
        const from = diamondPt(cx, cy, R, seg.from);
        const to = diamondPt(cx, cy, R, seg.to);
        if (points.length === 0) points.push(`${from.x},${from.y}`);
        points.push(`${to.x},${to.y}`);
      }
      g.appendChild(svgEl('polyline', {
        points: points.join(' '),
        stroke: CLR.text, 'stroke-width': L.BASE_PATH_SW,
        fill: 'none', 'stroke-linejoin': 'miter', 'stroke-linecap': 'square',
      }));
    }
  }

  // Hash marks for hit type (matches Figma Group 1 / Group 2 SVGs)
  const hitHashes = ab.notation === '1B' ? 1 : ab.notation === '2B' ? 2 : ab.notation === '3B' ? 3 : 0;
  if (hitHashes > 0) {
    drawHitHashMarks(g, CLR, hp, b1, hitHashes, R);
  }
}

function diamondPt(cx, cy, R, baseName) {
  switch (baseName) {
    case '1B': return { x: cx + R, y: cy };
    case '2B': return { x: cx, y: cy - R };
    case '3B': return { x: cx - R, y: cy };
    default:   return { x: cx, y: cy + R }; // HP
  }
}

/** Numbered out marker (circle with 1/2/3). Centered at (cx, cy). */
const OUT_NUMBER_PATHS = {
  1: 'M25.2397 32H21.2607V17.0044C19.807 18.3638 18.0936 19.3691 16.1206 20.0205V16.4097C17.159 16.0698 18.2871 15.4279 19.5049 14.4839C20.7227 13.5304 21.5581 12.4212 22.0112 11.1562H25.2397V32Z',
  2: 'M28.4966 28.3042V32H14.5488C14.6999 30.6029 15.153 29.2812 15.9082 28.0352C16.6634 26.7796 18.1549 25.1182 20.3828 23.0508C22.1764 21.3799 23.2762 20.2471 23.6821 19.6523C24.2297 18.8311 24.5034 18.0192 24.5034 17.2168C24.5034 16.3294 24.2627 15.6497 23.7812 15.1777C23.3092 14.6963 22.6532 14.4556 21.813 14.4556C20.9823 14.4556 20.3215 14.7057 19.8306 15.2061C19.3397 15.7064 19.0565 16.5371 18.981 17.6982L15.0161 17.3018C15.2521 15.1117 15.9932 13.5399 17.2393 12.5864C18.4854 11.633 20.043 11.1562 21.9121 11.1562C23.9606 11.1562 25.5701 11.7085 26.7407 12.813C27.9113 13.9175 28.4966 15.291 28.4966 16.9336C28.4966 17.8682 28.3267 18.7603 27.9868 19.6099C27.6564 20.45 27.1278 21.3327 26.4009 22.2578C25.9194 22.8714 25.0509 23.7541 23.7954 24.9058C22.5399 26.0575 21.7422 26.8221 21.4023 27.1997C21.0719 27.5773 20.8029 27.9455 20.5952 28.3042H28.4966Z',
  3: 'M14.917 26.4917L18.7686 26.0244C18.8913 27.0062 19.2217 27.7567 19.7598 28.2759C20.2979 28.7951 20.9492 29.0547 21.7139 29.0547C22.5352 29.0547 23.2243 28.7432 23.7812 28.1201C24.3477 27.4971 24.6309 26.6569 24.6309 25.5996C24.6309 24.599 24.3618 23.806 23.8237 23.2207C23.2856 22.6354 22.6296 22.3428 21.8555 22.3428C21.3457 22.3428 20.7368 22.4419 20.0288 22.6401L20.4678 19.3975C21.5439 19.4258 22.3652 19.1945 22.9316 18.7036C23.498 18.2033 23.7812 17.5425 23.7812 16.7212C23.7812 16.0226 23.5736 15.4657 23.1582 15.0503C22.7428 14.6349 22.1906 14.4272 21.5015 14.4272C20.8218 14.4272 20.2412 14.6632 19.7598 15.1353C19.2783 15.6073 18.9857 16.2964 18.8818 17.2026L15.2144 16.5796C15.4692 15.3241 15.8516 14.3234 16.3613 13.5776C16.8805 12.8224 17.598 12.2324 18.5137 11.8076C19.4388 11.3734 20.4725 11.1562 21.6147 11.1562C23.5688 11.1562 25.1359 11.7793 26.3159 13.0254C27.2882 14.0449 27.7744 15.1966 27.7744 16.4805C27.7744 18.3024 26.7785 19.7562 24.7866 20.8418C25.9761 21.0967 26.9248 21.6678 27.6328 22.5552C28.3503 23.4425 28.709 24.514 28.709 25.7695C28.709 27.5915 28.0435 29.1444 26.7124 30.4282C25.3813 31.7121 23.7246 32.354 21.7422 32.354C19.8636 32.354 18.306 31.8159 17.0693 30.7397C15.8327 29.6541 15.1152 28.2381 14.917 26.4917Z',
};

function drawOutMarker(g, cx, cy, color, outNumber, numColor, customR) {
  const r = customR || L.SUB_CIRCLE_R;
  const scale = (r * 2) / 44;
  const marker = svgEl('g', {
    transform: `translate(${cx - r}, ${cy - r}) scale(${scale})`,
  });
  // Circle background
  marker.appendChild(svgEl('circle', {
    cx: 21.8979, cy: 21.8979, r: 21.8979, fill: color,
  }));
  // Number glyph
  const num = Math.min(3, Math.max(1, outNumber || 1));
  const numPath = OUT_NUMBER_PATHS[num];
  if (numPath) {
    marker.appendChild(svgEl('path', { d: numPath, fill: numColor || '#faf9f6' }));
  }
  g.appendChild(marker);
}

/**
 * Hash marks perpendicular to HP→1B segment, matching Figma design.
 * Figma Group 1 (double): two parallel lines ~13.7 units apart at 45°
 * Figma Group 2 (triple): three parallel lines ~13.7 units apart
 * Single: one hash at midpoint of HP→1B
 */
function drawHitHashMarks(g, CLR, hp, b1, count, R) {
  // Scale from Figma 67-unit radius to our radius
  const scale = R / FIGMA_R;
  // HP→1B goes at 45°: unit vectors
  const inv = 1 / Math.SQRT2;
  const ux = inv, uy = -inv;   // along HP→1B
  const px = inv, py = inv;    // perpendicular (top-left to bottom-right)
  // Hash dimensions scaled from Figma
  const hashHalf = 15.5 * scale;  // half-length of each hash
  const spacing = 13.7 * scale;   // distance between hashes
  // Center of HP→1B segment
  const midX = (hp.x + b1.x) / 2;
  const midY = (hp.y + b1.y) / 2;
  const startOffset = -((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const off = startOffset + i * spacing;
    const hx = midX + ux * off;
    const hy = midY + uy * off;
    g.appendChild(svgEl('line', {
      x1: hx - px * hashHalf, y1: hy - py * hashHalf,
      x2: hx + px * hashHalf, y2: hy + py * hashHalf,
      stroke: CLR.text, 'stroke-width': L.HASH_SW,
    }));
  }
}

function computeBasePathSegments(ab, CLR) {
  const segments = [];
  for (const runner of ab.runners) {
    const start = runner.start || 'HP';
    const end = runner.end;
    if (!end) continue;
    const endBase = end === 'score' ? 'HP' : end;
    for (const [from, to] of getBasePath(start, endBase, end === 'score')) {
      segments.push({ from, to, color: CLR.text });
    }
  }
  return segments;
}

function getBasePath(from, to, isScore) {
  const order = ['HP', '1B', '2B', '3B'];
  let startIdx = order.indexOf(from);
  if (startIdx === -1) startIdx = 0;
  let numSegments;
  if (isScore) { numSegments = 4 - startIdx; }
  else {
    let endIdx = order.indexOf(to);
    if (endIdx === -1) endIdx = 0;
    numSegments = endIdx - startIdx;
    if (numSegments <= 0) return [];
  }
  const path = [];
  for (let n = 0; n < numSegments; n++) {
    const i = (startIdx + n) % 4;
    path.push([order[i], order[(i + 1) % 4]]);
  }
  return path;
}

// ─── Batter stats ────────────────────────────────────────────────

function drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, colMap, gridHeight) {
  const g = svgEl('g', { class: 'batter-stats' });
  const baseX = colMap.statsX();
  const totals = [0, 0, 0, 0];

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    const baseY = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
    const numPlayers = slot.players.length;
    const bandHeight = L.ROW_HEIGHT / Math.max(1, numPlayers);
    const fontSize = numPlayers <= 2 ? '16' : numPlayers <= 3 ? '13' : '11';

    for (let pIdx = 0; pIdx < numPlayers; pIdx++) {
      const player = slot.players[pIdx];
      const bandY = baseY + pIdx * bandHeight;
      const stats = batterStats.get(player.id);
      if (!stats) continue;
      const bandMidY = bandY + bandHeight / 2;

      // Draw horizontal dotted sub line across stats columns (matches lineup divider)
      if (player.isSubstitute) {
        const statsEndX = baseX + STAT_HEADERS.length * L.STATS_COL_WIDTH;
        const sqSize = 5;
        const sqGap = 4;
        const sqStep = sqSize + sqGap;
        for (let sx = baseX; sx + sqSize <= statsEndX; sx += sqStep) {
          g.appendChild(svgEl('rect', {
            x: sx, y: bandY - sqSize / 2, width: sqSize, height: sqSize,
            fill: CLR.sub,
          }));
        }
      }

      const values = [stats.ab, stats.r, stats.h, stats.rbi];
      for (let i = 0; i < values.length; i++) {
        totals[i] += values[i] || 0;
        g.appendChild(svgText(String(values[i]), baseX + i * L.STATS_COL_WIDTH + L.STATS_COL_WIDTH / 2, bandMidY, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': fontSize, 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
        }));
      }
    }
  }

  // Grand totals aligned with the bottom summary row
  const summaryBottom = gridHeight + SUMMARY_LABELS.length * L.SUMMARY_ROW_HEIGHT;
  const totalsY = summaryBottom - L.SUMMARY_ROW_HEIGHT / 2;
  g.appendChild(svgEl('line', {
    x1: baseX, y1: summaryBottom - L.SUMMARY_ROW_HEIGHT,
    x2: baseX + STAT_HEADERS.length * L.STATS_COL_WIDTH, y2: summaryBottom - L.SUMMARY_ROW_HEIGHT,
    stroke: CLR.gridBold, 'stroke-width': 1.5,
  }));
  for (let i = 0; i < totals.length; i++) {
    g.appendChild(svgText(String(totals[i]), baseX + i * L.STATS_COL_WIDTH + L.STATS_COL_WIDTH / 2, totalsY, {
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': '18', 'font-weight': '900', 'font-family': L.FONT, fill: CLR.text,
    }));
  }

  svg.appendChild(g);
}

// ─── Summary rows ────────────────────────────────────────────────

function drawSummaryRows(svg, CLR, linescore, side, colMap, gridHeight, width, statsWidth, inningPitchCounts) {
  const g = svgEl('g', { class: 'summary-rows' });
  const innData = linescore.innings || [];
  const halfKey = side === 'away' ? 'away' : 'home';
  const { innings } = colMap;

  for (let rowIdx = 0; rowIdx < SUMMARY_LABELS.length; rowIdx++) {
    const label = SUMMARY_LABELS[rowIdx];
    const y = gridHeight + rowIdx * L.SUMMARY_ROW_HEIGHT;
    const textY = y + L.SUMMARY_ROW_HEIGHT / 2;

    g.appendChild(svgText(label, L.MARGIN_LEFT - 12, textY, {
      'text-anchor': 'end', 'dominant-baseline': 'central',
      'font-size': '18', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));

    for (let inn = 1; inn <= innings; inn++) {
      // Center summary value across the inning's span (may be >1 column for bat-arounds)
      const spanW = colMap.spanWidth(inn);
      const centerX = colMap.colX(inn) + spanW / 2;
      if (label === 'S / P') {
        const pc = inningPitchCounts?.[inn - 1];
        if (!pc || pc.pitches === 0) continue;
        const display = `${pc.strikes} / ${pc.pitches}`;
        g.appendChild(svgText(display, centerX, textY, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': '16', 'font-weight': '600', 'font-family': L.FONT,
          fill: CLR.text,
        }));
      } else {
        const halfData = innData[inn - 1]?.[halfKey];
        if (!halfData) continue;
        let value;
        switch (label) {
          case 'R': value = halfData.runs; break;
          case 'H': value = halfData.hits; break;
          case 'E': value = halfData.errors; break;
          case 'LOB': value = halfData.leftOnBase; break;
        }
        if (value === null || value === undefined) continue;
        g.appendChild(svgText(String(value), centerX, textY, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': '18', 'font-weight': '600', 'font-family': L.FONT,
          fill: value > 0 ? CLR.text : CLR.textMuted,
        }));
      }
    }
  }
  svg.appendChild(g);
}

// ═══════════════════════════════════════════════════════════════════
// HTML renderers (pitcher stats, game header, linescore)
// ═══════════════════════════════════════════════════════════════════

/** Display a stat value, using '-' when data is unavailable */
function v(val) {
  if (val === null || val === undefined || val === '') return '-';
  return String(val);
}

function formatRepertoire(repertoire) {
  if (!repertoire || repertoire.length === 0) return '-';
  return repertoire.map(r => {
    const velo = r.avgVelo ? `, ${r.avgVelo}` : '';
    return `<span style="white-space:nowrap">${r.code} (${r.pct}%${velo})</span>`;
  }).join(', ');
}

export function renderPitcherStatsHTML(data, side, teamAbbrev) {
  const boxscore = data.liveData.boxscore;
  const decisions = data.liveData.decisions || {};
  const gameData = data.gameData;
  const arsenals = data._arsenals || new Map();
  const allPlays = data.liveData.plays.allPlays;
  const pitchers = getPitcherStats(boxscore, side, decisions, allPlays);
  if (pitchers.length === 0) return '';
  const label = teamAbbrev ? `${teamAbbrev} PITCHERS` : 'PITCHERS';

  const rows = pitchers.map((p, i) => {
    const s = p.stats;
    const ss = p.seasonStats || {};
    const hand = getPlayerPitchHand(gameData, p.id);
    // Always prefer season arsenal (stable sample) over in-game repertoire (small sample)
    const repertoire = arsenals.get?.(p.id) || p.repertoire || [];
    const pitchCodes = formatRepertoire(repertoire);
    const spacer = i > 0 ? `<tr class="pitcher-spacer"><td colspan="12"></td></tr>` : '';
    // Season stats row (above game row, smaller font)
    const seasonRow = `${spacer}
      <tr class="pitcher-season-row">
        <td class="pitcher-season-label" colspan="2">Season</td>
        <td>${v(ss.inningsPitched)}</td>
        <td>${v(ss.hits)}</td>
        <td>${v(ss.runs)}</td>
        <td>${v(ss.earnedRuns)}</td>
        <td>${v(ss.baseOnBalls)}</td>
        <td>${v(ss.strikeOuts)}</td>
        <td>-</td>
        <td>-</td>
        <td>${v(ss.era)}</td>
        <td>${v(ss.whip)}</td>
      </tr>`;
    // Game stats row
    const gameRow = `
      <tr class="pitcher-game-row" data-pitcher-id="${p.id}">
        <td class="pitcher-name">${playerLink(p.name, p.id)}<span class="hand-indicator">, ${hand || '?'}</span>${p.note ? ` <span class="pitcher-note">${p.note}</span>` : ''}</td>
        <td class="pitcher-pitches">${pitchCodes}</td>
        <td>${v(s.inningsPitched)}</td>
        <td>${v(s.hits)}</td>
        <td>${v(s.runs)}</td>
        <td>${v(s.earnedRuns)}</td>
        <td>${v(s.baseOnBalls)}</td>
        <td>${v(s.strikeOuts)}</td>
        <td>${v(s.strikes)}</td>
        <td>${v(s.numberOfPitches)}</td>
        <td>-</td>
        <td>-</td>
      </tr>`;
    return seasonRow + gameRow;
  }).join('');

  return `
    <div class="table-scroll-wrapper">
    <table class="pitcher-stats-table">
      <thead><tr><th>${label}</th><th>PITCH TYPES (USAGE/MPH)</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>S</th><th>P</th><th>ERA</th><th>WHIP</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`;
}

// 2025 MLB linear weights for wOBA (source: FanGraphs Guts)
const WOBA_WEIGHTS = { bb: 0.691, hbp: 0.722, s1b: 0.882, s2b: 1.252, s3b: 1.584, hr: 2.037 };

function calcWOBA(ss) {
  const bb = (ss.baseOnBalls ?? 0) - (ss.intentionalWalks ?? 0);
  const hbp = ss.hitByPitch ?? 0;
  const singles = (ss.hits ?? 0) - (ss.doubles ?? 0) - (ss.triples ?? 0) - (ss.homeRuns ?? 0);
  const doubles = ss.doubles ?? 0;
  const triples = ss.triples ?? 0;
  const hr = ss.homeRuns ?? 0;
  const ab = ss.atBats ?? 0;
  const sf = ss.sacFlies ?? 0;
  const denom = ab + bb + (ss.intentionalWalks ?? 0) + sf + hbp;
  if (denom === 0) return '-';
  const woba = (WOBA_WEIGHTS.bb * bb + WOBA_WEIGHTS.hbp * hbp + WOBA_WEIGHTS.s1b * singles +
    WOBA_WEIGHTS.s2b * doubles + WOBA_WEIGHTS.s3b * triples + WOBA_WEIGHTS.hr * hr) / denom;
  return woba.toFixed(3);
}

export function renderBenchHTML(data, side, teamAbbrev, { useAccordion = true } = {}) {
  const boxscore = data.liveData.boxscore;
  const gameData = data.gameData;
  const players = getBenchPlayers(boxscore, side);
  if (players.length === 0) return '';
  const label = teamAbbrev ? `${teamAbbrev} BENCH` : 'BENCH';
  const colCount = 11;

  // Group by bat side: R, L, S
  const groups = { R: [], L: [], S: [] };
  for (const p of players) {
    const bat = getPlayerBatSide(gameData, p.id) || '?';
    (groups[bat] || groups['R']).push({ ...p, bat });
  }
  const groupLabels = { R: 'Right Handed', L: 'Left Handed', S: 'Switch Hitters' };
  const rows = [];
  for (const code of ['R', 'L', 'S']) {
    if (groups[code].length === 0) continue;
    rows.push(`<tr class="hand-group-row"><td colspan="${colCount}">${groupLabels[code]}</td></tr>`);
    for (const p of groups[code]) {
      const ss = p.seasonStats;
      const woba = calcWOBA(ss);
      rows.push(`
      <tr>
        <td class="pitcher-name">${playerLink(p.name, p.id)}<span class="hand-indicator">, ${p.bat}</span></td>
        <td>${p.position}</td>
        <td>${v(ss.avg)}</td>
        <td>${v(ss.obp)}</td>
        <td>${v(ss.slg)}</td>
        <td>${v(ss.ops)}</td>
        <td>${woba}</td>
        <td>${v(ss.homeRuns)}</td>
        <td>${v(ss.rbi)}</td>
        <td>${v(ss.stolenBases)}</td>
        <td>${v(ss.plateAppearances)}</td>
      </tr>`);
    }
  }

  const tableHTML = `<div class="table-scroll-wrapper">
      <table class="pitcher-stats-table">
        <thead><tr><th>Player</th><th>POS</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th><th>wOBA</th><th>HR</th><th>RBI</th><th>SB</th><th>PA</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      </div>`;

  if (useAccordion) {
    return `<details class="collapsible-section" data-section="bench-${side}">
      <summary role="button" aria-expanded="false">${label} <span class="section-count">(${players.length})</span></summary>
      ${tableHTML}
    </details>`;
  }
  return `<div class="open-section">
    <h3 class="scorecard-section-header">${label} <span class="section-count">(${players.length})</span></h3>
    ${tableHTML}
  </div>`;
}

export function renderBullpenHTML(data, side, teamAbbrev, { useAccordion = true } = {}) {
  const boxscore = data.liveData.boxscore;
  const gameData = data.gameData;
  const arsenals = data._arsenals || new Map();
  const players = getBullpenPitchers(boxscore, side);
  if (players.length === 0) return '';
  const label = teamAbbrev ? `${teamAbbrev} BULLPEN` : 'BULLPEN';
  const colCount = 12;

  // Group by pitch hand: R, L
  const groups = { R: [], L: [] };
  for (const p of players) {
    const hand = getPlayerPitchHand(gameData, p.id) || '?';
    (groups[hand] || groups['R']).push({ ...p, hand });
  }
  const groupLabels = { R: 'Right Handed', L: 'Left Handed' };
  const rows = [];
  for (const code of ['R', 'L']) {
    if (groups[code].length === 0) continue;
    rows.push(`<tr class="hand-group-row"><td colspan="${colCount}">${groupLabels[code]}</td></tr>`);
    for (const p of groups[code]) {
      const ss = p.seasonStats;
      const arsenal = arsenals.get?.(p.id);
      const pitchCodes = arsenal ? formatRepertoire(arsenal) : '-';
      rows.push(`
      <tr>
        <td class="pitcher-name">${playerLink(p.name, p.id)}<span class="hand-indicator">, ${p.hand}</span></td>
        <td class="pitcher-pitches">${pitchCodes}</td>
        <td>${v(ss.inningsPitched)}</td>
        <td>${v(ss.hits)}</td>
        <td>${v(ss.runs)}</td>
        <td>${v(ss.earnedRuns)}</td>
        <td>${v(ss.baseOnBalls)}</td>
        <td>${v(ss.strikeOuts)}</td>
        <td>${v(ss.strikes)}</td>
        <td>${v(ss.numberOfPitches || ss.pitchesThrown)}</td>
        <td>${v(ss.era)}</td>
        <td>${v(ss.whip)}</td>
      </tr>`);
    }
  }

  const tableHTML = `<div class="table-scroll-wrapper">
      <table class="pitcher-stats-table">
        <thead><tr><th>Player</th><th>PITCH TYPES (USAGE/MPH)</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>S</th><th>P</th><th>ERA</th><th>WHIP</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      </div>`;

  if (useAccordion) {
    return `<details class="collapsible-section" data-section="bullpen-${side}">
      <summary role="button" aria-expanded="false">${label} <span class="section-count">(${players.length})</span></summary>
      ${tableHTML}
    </details>`;
  }
  return `<div class="open-section">
    <h3 class="scorecard-section-header">${label} <span class="section-count">(${players.length})</span></h3>
    ${tableHTML}
  </div>`;
}

function weatherIcon(condition) {
  if (!condition) return '';
  const c = condition.toLowerCase();
  if (c.includes('sunny') || c === 'clear') return 'wi-day-sunny';
  if (c.includes('partly cloudy') || c.includes('partly')) return 'wi-day-sunny-overcast';
  if (c.includes('overcast')) return 'wi-cloudy';
  if (c.includes('cloudy') || c.includes('cloud')) return 'wi-day-cloudy';
  if (c.includes('thunder') || c.includes('storm')) return 'wi-thunderstorm';
  if (c.includes('drizzle') || c.includes('sprinkle')) return 'wi-sprinkle';
  if (c.includes('rain') || c.includes('shower')) return 'wi-rain';
  if (c.includes('snow') || c.includes('flurr')) return 'wi-snow';
  if (c.includes('fog') || c.includes('mist')) return 'wi-fog';
  if (c.includes('haze') || c.includes('smog')) return 'wi-day-haze';
  if (c.includes('wind')) return 'wi-strong-wind';
  if (c.includes('hot')) return 'wi-hot';
  if (c.includes('cold')) return 'wi-snowflake-cold';
  if (c.includes('dome') || c.includes('roof')) return 'wi-day-sunny';
  return 'wi-na';
}

function formatWind(wind) {
  if (!wind) return '';
  // Convert mph to km/h, keep direction
  const match = wind.match(/(\d+)\s*mph[,]?\s*(.*)/i);
  if (!match) return wind;
  const mph = parseInt(match[1], 10);
  const kmh = Math.round(mph * 1.609);
  const dir = match[2] ? `, ${match[2].trim()}` : '';
  return `${kmh} km/h / ${mph} mph${dir}`;
}

// Division short names for column headers
const DIV_SHORT = {
  200: 'W', 201: 'E', 202: 'C',
  203: 'W', 204: 'E', 205: 'C',
};

function findTeamStandings(standings, teamId) {
  if (!standings?.records) return null;
  for (const rec of standings.records) {
    const tr = rec.teamRecords.find(t => t.team.id === teamId);
    if (tr) return { ...tr, divisionId: rec.division.id, leagueId: rec.league?.id };
  }
  return null;
}

function splitRecord(splits, type) {
  const s = splits?.find(r => r.type === type);
  return s ? `${s.wins}-${s.losses}` : '-';
}

function divRecord(divRecords, divId) {
  const d = divRecords?.find(r => r.division.id === divId);
  return d ? `${d.wins}-${d.losses}` : '-';
}

function interleagueRecord(leagueRecords, teamLeagueId) {
  // Interleague = record against the OTHER league
  const otherLeagueId = teamLeagueId === 103 ? 104 : 103;
  const r = leagueRecords?.find(l => l.league.id === otherLeagueId);
  return r ? `${r.wins}-${r.losses}` : '-';
}

export function renderTeamComparisonHTML(data, standings) {
  const gd = data.gameData;
  const away = gd.teams.away;
  const home = gd.teams.home;
  const isSpringTraining = gd.game?.type === 'S';

  const awaySt = findTeamStandings(standings, away.id);
  const homeSt = findTeamStandings(standings, home.id);

  // If no standings data, show a simpler version with just W-L from game data
  if (!awaySt && !homeSt) {
    return `
    <div class="team-comparison" tabindex="0" role="region" aria-label="Team comparison">
      <table class="pitcher-stats-table">
        <thead><tr><th>Team</th><th>W-L</th><th>PCT</th></tr></thead>
        <tbody>
          <tr>
            <td>${teamLogo(away.id, '1.125em')}${away.abbreviation}</td>
            <td>${away.record.wins}-${away.record.losses}</td>
            <td>${away.record.winningPercentage}</td>
          </tr>
          <tr>
            <td>${teamLogo(home.id, '1.125em')}${home.abbreviation}</td>
            <td>${home.record.wins}-${home.record.losses}</td>
            <td>${home.record.winningPercentage}</td>
          </tr>
        </tbody>
      </table>
      ${isSpringTraining ? '<p class="tc-note">Spring Training</p>' : ''}
    </div>`;
  }

  // Full comparison with standings splits
  const awaySplits = awaySt?.records?.splitRecords;
  const homeSplits = homeSt?.records?.splitRecords;
  const awayDivRecs = awaySt?.records?.divisionRecords;
  const homeDivRecs = homeSt?.records?.divisionRecords;
  const awayLeagueRecs = awaySt?.records?.leagueRecords;
  const homeLeagueRecs = homeSt?.records?.leagueRecords;

  // Determine division columns: show all 3 divisions for the team's league
  const awayLeagueId = away.league?.id || awaySt?.leagueId;
  const homeLeagueId = home.league?.id || homeSt?.leagueId;
  const sameLeague = awayLeagueId === homeLeagueId;

  // Division IDs by league
  const alDivs = [201, 202, 200]; // East, Central, West
  const nlDivs = [204, 205, 203];
  const awayDivIds = awayLeagueId === 103 ? alDivs : nlDivs;

  let homeDivCells;

  // Always show E, C, W columns — use away team's league for headers
  const divHeaders = awayDivIds.map(id => `<th>${DIV_SHORT[id]}</th>`).join('');
  const awayDivCells = awayDivIds.map(id => `<td>${divRecord(awayDivRecs, id)}</td>`).join('');
  if (sameLeague) {
    homeDivCells = awayDivIds.map(id => `<td>${divRecord(homeDivRecs, id)}</td>`).join('');
  } else {
    // Inter-league: home team uses their own league's division IDs
    const homeDivIds = homeLeagueId === 103 ? alDivs : nlDivs;
    homeDivCells = awayDivIds.map((_, i) => `<td>${divRecord(homeDivRecs, homeDivIds[i])}</td>`).join('');
  }

  const awayGB = awaySt?.divisionGamesBack || '-';
  const homeGB = homeSt?.divisionGamesBack || '-';
  return `
    <div class="team-comparison" tabindex="0" role="region" aria-label="Team comparison">
      <table class="pitcher-stats-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>W-L</th>
            <th>GB</th>
            <th>H</th>
            <th>R</th>
            ${divHeaders}
            <th>IL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${teamLogo(away.id, '1.125em')}${away.abbreviation}</td>
            <td>${awaySt?.leagueRecord?.wins ?? away.record.wins}-${awaySt?.leagueRecord?.losses ?? away.record.losses}</td>
            <td>${awayGB}</td>
            <td>${splitRecord(awaySplits, 'home')}</td>
            <td>${splitRecord(awaySplits, 'away')}</td>
            ${awayDivCells}
            <td>${interleagueRecord(awayLeagueRecs, awayLeagueId)}</td>
          </tr>
          <tr>
            <td>${teamLogo(home.id, '1.125em')}${home.abbreviation}</td>
            <td>${homeSt?.leagueRecord?.wins ?? home.record.wins}-${homeSt?.leagueRecord?.losses ?? home.record.losses}</td>
            <td>${homeGB}</td>
            <td>${splitRecord(homeSplits, 'home')}</td>
            <td>${splitRecord(homeSplits, 'away')}</td>
            ${homeDivCells}
            <td>${interleagueRecord(homeLeagueRecs, homeLeagueId)}</td>
          </tr>
        </tbody>
      </table>
      ${isSpringTraining ? '<p class="tc-note">Spring Training</p>' : ''}
    </div>`;
}

export function renderGameHeaderHTML(data) {
  const gd = data.gameData;
  const ls = data.liveData.linescore;
  const decisions = data.liveData.decisions || {};
  const away = gd.teams.away;
  const home = gd.teams.home;
  const info = getGameInfo(gd);
  const umps = extractUmpires(data);

  const decisionLines = [
    decisions.winner ? `<div class="decision-line"><strong>WP:</strong> ${playerLink(decisions.winner.fullName, decisions.winner.id)}</div>` : '',
    decisions.loser ? `<div class="decision-line"><strong>LP:</strong> ${playerLink(decisions.loser.fullName, decisions.loser.id)}</div>` : '',
    decisions.save ? `<div class="decision-line"><strong>SV:</strong> ${playerLink(decisions.save.fullName, decisions.save.id)}</div>` : '',
  ].filter(Boolean).join('');

  const firstPitchStr = info.firstPitch
    ? new Date(info.firstPitch).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })
    : (info.time || '');

  // Format date as DD/MM/YYYY
  let dateStr = info.date || '';
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [yr, mo, da] = dateStr.split('-');
    dateStr = `${da}/${mo}/${yr}`;
  }

  // Linescore table
  const innings = ls.innings || [];
  const numInnings = Math.max(innings.length, 9);
  const headerCells = Array.from({ length: numInnings }, (_, i) => `<th>${i + 1}</th>`).join('');
  const isFinal = gd.status?.abstractGameState === 'Final';
  const awayInnings = Array.from({ length: numInnings }, (_, i) => `<td>${innings[i]?.away?.runs ?? ''}</td>`).join('');
  const homeInnings = Array.from({ length: numInnings }, (_, i) => {
    const homeRuns = innings[i]?.home?.runs;
    // Home team didn't bat (winning going into bottom of last inning)
    if (isFinal && (homeRuns === null || homeRuns === undefined) && innings[i]?.away !== null && innings[i]?.away !== undefined) return '<td>X</td>';
    return `<td>${homeRuns ?? ''}</td>`;
  }).join('');

  // Umpires table
  const hasUmps = umps.hp || umps.first || umps.second || umps.third;
  const umpTableRows = [
    umps.hp ? `<tr><td class="pitcher-name">HP</td><td>${umps.hp}</td></tr>` : '',
    umps.first ? `<tr><td class="pitcher-name">1B</td><td>${umps.first}</td></tr>` : '',
    umps.second ? `<tr><td class="pitcher-name">2B</td><td>${umps.second}</td></tr>` : '',
    umps.third ? `<tr><td class="pitcher-name">3B</td><td>${umps.third}</td></tr>` : '',
  ].filter(Boolean).join('');

  // Game info table rows
  const durationStr = info.durationMinutes
    ? `${Math.floor(info.durationMinutes / 60)}:${String(info.durationMinutes % 60).padStart(2, '0')}`
    : '';
  const gameInfoRows = [
    dateStr ? `<tr><td class="pitcher-name">Date</td><td>${dateStr}</td></tr>` : '',
    firstPitchStr ? `<tr><td class="pitcher-name">First Pitch</td><td>${firstPitchStr}</td></tr>` : '',
    durationStr ? `<tr><td class="pitcher-name">Duration</td><td>${durationStr}</td></tr>` : '',
    info.venue ? `<tr><td class="pitcher-name">Venue</td><td>${info.venue}${info.attendance ? ` (${info.attendance.toLocaleString()} / ${info.venueCapacity ? info.venueCapacity.toLocaleString() : '-'})` : info.venueCapacity ? ` (${info.venueCapacity.toLocaleString()})` : ''}</td></tr>` : '',
  ].filter(Boolean).join('');

  // Weather table rows - always show, with fallback
  const weatherRows = info.weather || info.wind
    ? [
        info.weather ? `<tr><td class="pitcher-name"><i class="wi ${weatherIcon(info.weatherCondition)}"></i> Temp</td><td>${info.weather}</td></tr>` : '',
        info.wind ? `<tr><td class="pitcher-name"><i class="wi wi-strong-wind"></i> Wind</td><td>${formatWind(info.wind)}</td></tr>` : '',
      ].filter(Boolean).join('')
    : `<tr><td colspan="2">Waiting on data from sources</td></tr>`;

  return {
    linescore: `
      <div class="game-header-linescore">
        <table class="linescore-table">
          <thead><tr><th>Team</th>${headerCells}<th class="rhe">R</th><th class="rhe">H</th><th class="rhe">E</th><th class="rhe">LOB</th></tr></thead>
          <tbody>
            <tr><td class="team-name">${away.abbreviation}</td>${awayInnings}<td class="rhe"><strong>${ls.teams.away?.runs ?? ''}</strong></td><td class="rhe">${ls.teams.away?.hits ?? ''}</td><td class="rhe">${ls.teams.away?.errors ?? ''}</td><td class="rhe">${ls.teams.away?.leftOnBase ?? ''}</td></tr>
            <tr><td class="team-name">${home.abbreviation}</td>${homeInnings}<td class="rhe"><strong>${ls.teams.home?.runs ?? ''}</strong></td><td class="rhe">${ls.teams.home?.hits ?? ''}</td><td class="rhe">${ls.teams.home?.errors ?? ''}</td><td class="rhe">${ls.teams.home?.leftOnBase ?? ''}</td></tr>
          </tbody>
        </table>
        ${decisionLines ? `<div class="decisions">${decisionLines}</div>` : ''}
      </div>`,
    gameInfo: `
      <div class="game-header-grid">
        <div>
          <table class="pitcher-stats-table">
            <thead><tr><th colspan="2">Game Info</th></tr></thead>
            <tbody>${gameInfoRows}</tbody>
          </table>
        </div>
        <div>
          <table class="pitcher-stats-table">
            <thead><tr><th colspan="2">Weather</th></tr></thead>
            <tbody>${weatherRows}</tbody>
          </table>
        </div>
        <div>
          <table class="pitcher-stats-table">
            <thead><tr><th colspan="2">Umpires</th></tr></thead>
            <tbody>${hasUmps ? umpTableRows : '<tr><td colspan="2">Waiting on data from sources</td></tr>'}</tbody>
          </table>
        </div>
      </div>`,
  };
}

export function renderCoachingStaffHTML(data, side, _teamName) {
  const coaches = data._coaches?.[side];
  if (!coaches) return '';

  const entries = [
    coaches.manager ? ['Manager', coaches.manager] : null,
    coaches.pitching ? ['Pitching Coach', coaches.pitching] : null,
    coaches.firstBase ? ['First Base Coach', coaches.firstBase] : null,
    coaches.thirdBase ? ['Third Base Coach', coaches.thirdBase] : null,
  ].filter(Boolean);

  if (!entries.length) return '';

  const headers = entries.map(([role]) => `<th>${role}</th>`).join('');
  const cells = entries.map(([, name]) => `<td>${name}</td>`).join('');

  return `<table class="team-season-table coaching-staff-table">
    <thead><tr>${headers}</tr></thead>
    <tbody><tr>${cells}</tr></tbody>
  </table>`;
}
