// SVG scorecard rendering — Bob Carpenter layout, high-contrast, dark mode
// Large cells with full-size diamond, large notation, big batter info

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
  getStartingPitcherInfo,
  getGameInfo,
  extractUmpires,
  getBenchPlayers,
  getBullpenPitchers,
  POS_ABBREV,
} from './game-data.js';
import { getConfig } from './layout-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Stats
const STAT_HEADERS = ['AB', 'R', 'H', 'BI'];
const SUMMARY_LABELS = ['R', 'H', 'E', 'LOB', 'S / P'];

// Strike zone mapping range — controls how much "air" surrounds the zone box.
// Wider ranges → smaller zone box relative to plot area → tighter cluster.
const PX_RANGE = 2.4;   // horizontal range in feet (centered on 0) — zone box ~70% of width
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
    text:      v('--sc-text')      || '#000000',
    textLight: v('--sc-text-light') || '#333333',
    textMuted: v('--sc-text-muted') || '#666666',
    grid:      v('--sc-grid')      || '#AAAAAA',
    gridBold:  v('--sc-grid-bold') || '#000000',
    diamond:   v('--sc-diamond')   || '#999999',
    reached:   v('--sc-reached')   || '#000000',
    scored:    v('--sc-scored')    || '#007700',
    out:       v('--sc-out')       || '#CC0000',
    hit:       v('--sc-hit')       || '#007700',
    sub:       v('--sc-sub')       || '#0000CC',
    bg:        v('--sc-bg')        || '#FFFFFF',
    cellBg:    v('--sc-cell-bg')   || '#FFFFFF',
    headerBg:  v('--sc-header-bg') || '#F0F0F0',
    pitchBall:   v('--sc-pitch-ball')   || '#000000',
    pitchStrike: v('--sc-pitch-strike') || '#CC0000',
    pitchInPlay: v('--sc-pitch-in-play') || '#0000CC',
    pitchHbp:    v('--sc-pitch-hbp')    || '#000000',
    activeCell:  v('--sc-active-cell')  || '#FFFACD',
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

  // Determine active batter cell for highlighting (live games)
  const currentPlay = data.liveData.plays.currentPlay;
  let activeCellKey = null;
  if (currentPlay && !currentPlay.about.isComplete && currentPlay.about.halfInning === halfInning) {
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
  for (const slot of lineup) {
    rowOffsets.push(totalRows);
    totalRows += 1; // always 1 row per batting order slot
  }

  const summaryRows = SUMMARY_LABELS.length;
  const statsWidth = STAT_HEADERS.length * L.STATS_COL_WIDTH;
  const width = L.MARGIN_LEFT + (innings * L.COL_WIDTH) + statsWidth;
  const gridHeight = L.HEADER_HEIGHT + (totalRows * L.ROW_HEIGHT);
  const height = gridHeight + (summaryRows * L.SUMMARY_ROW_HEIGHT) + 2;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    class: 'scorecard-svg',
  });

  svg.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: CLR.bg }));

  drawGrid(svg, CLR, lineup, innings, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows, activeCellKey, subMap);
  drawHeader(svg, CLR, innings, statsWidth);
  drawStatHeaders(svg, CLR, innings);
  drawLineup(svg, CLR, lineup, rowOffsets, boxscore, gameData, side);
  drawAtBats(svg, CLR, lineup, grid, rowOffsets, innings, subMap, subNumberMap);
  drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, innings, gridHeight);
  // Compute per-inning pitch counts from grid data
  const inningPitchCounts = [];
  for (let inn = 1; inn <= innings; inn++) {
    let strikes = 0, pitches = 0;
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
      }
    }
    inningPitchCounts.push({ strikes, pitches });
  }
  drawSummaryRows(svg, CLR, linescore, side, innings, gridHeight, width, statsWidth, inningPitchCounts);

  // Team logo in the empty bottom-right corner (stats × summary area)
  const teamId = gameData.teams[side]?.id;
  if (teamId) {
    drawTeamLogo(svg, teamId, innings, gridHeight, statsWidth);
  }

  return svg;
}

// ─── Per-cell substitution indicators ────────────────────────────

function drawSubIndicator(g, CLR, x, y, subType, subNum, pStats) {
  const circleR = 7;
  const circleFontSize = '10';

  if (subType === 'pitcher') {
    // Dashed blue line across top edge (replaces grid line)
    g.appendChild(svgEl('line', {
      x1: x, y1: y,
      x2: x + L.COL_WIDTH, y2: y,
      stroke: CLR.sub, 'stroke-width': 7,
      'stroke-dasharray': '12,6',
    }));
    // Pitcher S/P label centered above the dashed line
    if (pStats) {
      const fs = String(L.PITCH_FONT_SIZE);
      const label = `${pStats.strikes} / ${pStats.pitches}`;
      const mainW = L.COL_WIDTH - L.PITCH_COL_W;
      const labelX = x + L.COL_WIDTH - 5;
      const labelY = y - 8;
      g.appendChild(svgText(label, labelX, labelY, {
        'text-anchor': 'end', 'dominant-baseline': 'auto',
        'font-size': fs, 'font-weight': '700', 'font-family': L.MONO, fill: CLR.sub,
      }));
    }
  } else if (subType === 'PH') {
    // Solid blue line on left edge
    g.appendChild(svgEl('line', {
      x1: x, y1: y,
      x2: x, y2: y + L.ROW_HEIGHT,
      stroke: CLR.sub, 'stroke-width': 5,
    }));
    // Sub number circle at bottom of left edge (avoids pitch sequence area)
    if (subNum) {
      const cx = x + circleR + 3;
      const cy = y + L.ROW_HEIGHT - circleR - 3;
      g.appendChild(svgEl('circle', { cx, cy, r: circleR, fill: CLR.bg, stroke: CLR.sub, 'stroke-width': 1.5 }));
      g.appendChild(svgText(String(subNum), cx, cy, {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': circleFontSize, 'font-weight': '700', 'font-family': L.FONT, fill: CLR.sub,
      }));
    }
  } else if (subType === 'PR') {
    // Solid blue line on right edge
    g.appendChild(svgEl('line', {
      x1: x + L.COL_WIDTH, y1: y,
      x2: x + L.COL_WIDTH, y2: y + L.ROW_HEIGHT,
      stroke: CLR.sub, 'stroke-width': 5,
    }));
    // Sub number circle at bottom of right edge
    if (subNum) {
      const cx = x + L.COL_WIDTH - circleR - 3;
      const cy = y + L.ROW_HEIGHT - circleR - 3;
      g.appendChild(svgEl('circle', { cx, cy, r: circleR, fill: CLR.bg, stroke: CLR.sub, 'stroke-width': 1.5 }));
      g.appendChild(svgText(String(subNum), cx, cy, {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': circleFontSize, 'font-weight': '700', 'font-family': L.FONT, fill: CLR.sub,
      }));
    }
  } else if (subType === 'defensive') {
    // Solid blue line on right edge — player exits, replacement enters
    g.appendChild(svgEl('line', {
      x1: x + L.COL_WIDTH, y1: y,
      x2: x + L.COL_WIDTH, y2: y + L.ROW_HEIGHT,
      stroke: CLR.sub, 'stroke-width': 5,
    }));
    if (subNum) {
      const cx = x + L.COL_WIDTH - circleR - 3;
      const cy = y + L.ROW_HEIGHT - circleR - 3;
      g.appendChild(svgEl('circle', { cx, cy, r: circleR, fill: CLR.bg, stroke: CLR.sub, 'stroke-width': 1.5 }));
      g.appendChild(svgText(String(subNum), cx, cy, {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': circleFontSize, 'font-weight': '700', 'font-family': L.FONT, fill: CLR.sub,
      }));
    }
  }
}

// ─── Grid ────────────────────────────────────────────────────────

function drawGrid(svg, CLR, lineup, innings, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows, activeCellKey, subMap) {
  const g = svgEl('g', { class: 'grid-lines' });

  // Build set of cells that have pitcher substitution lines on their top edge
  const pitcherSubCells = new Set();
  if (subMap) {
    for (const [key, subs] of subMap) {
      if (subs.some(s => s.type === 'pitcher')) pitcherSubCells.add(key);
    }
  }

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    const y = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
    for (let inn = 0; inn < innings; inn++) {
      const cellKey = `${slot.slot}-${inn + 1}`;
      const isActive = cellKey === activeCellKey;
      g.appendChild(svgEl('rect', {
        x: L.MARGIN_LEFT + inn * L.COL_WIDTH + 0.5, y: y + 0.5,
        width: L.COL_WIDTH - 1, height: L.ROW_HEIGHT - 1,
        fill: isActive ? CLR.activeCell : CLR.cellBg, stroke: 'none',
      }));
    }
  }

  // Horizontal bold lines — draw per-cell, skipping cells with pitcher sub lines
  for (let i = 0; i <= totalRows; i++) {
    const y = L.HEADER_HEIGHT + i * L.ROW_HEIGHT;
    // Left margin area (name column) — always draw
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: L.MARGIN_LEFT, y2: y, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
    // Per-inning segments — skip where pitcher sub exists
    for (let inn = 0; inn < innings; inn++) {
      // The sub line sits at the TOP of the cell it belongs to, i.e. row i (0-indexed slot)
      const slotIdx = i < lineup.length ? i : -1;
      const slot = slotIdx >= 0 ? lineup[slotIdx] : null;
      const cellKey = slot ? `${slot.slot}-${inn + 1}` : null;
      if (cellKey && pitcherSubCells.has(cellKey)) continue;
      const x1 = L.MARGIN_LEFT + inn * L.COL_WIDTH;
      const x2 = x1 + L.COL_WIDTH;
      g.appendChild(svgEl('line', { x1, y1: y, x2, y2: y, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
    }
    // Stats columns area — always draw
    const statsX = L.MARGIN_LEFT + innings * L.COL_WIDTH;
    g.appendChild(svgEl('line', { x1: statsX, y1: y, x2: width, y2: y, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  }

  for (let i = 1; i <= summaryRows; i++) {
    const y = gridHeight + i * L.SUMMARY_ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: L.MARGIN_LEFT + innings * L.COL_WIDTH, y2: y, stroke: CLR.grid, 'stroke-width': 1 }));
  }

  g.appendChild(svgEl('line', { x1: L.MARGIN_LEFT, y1: 0, x2: L.MARGIN_LEFT, y2: gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  for (let i = 0; i <= innings; i++) {
    const x = L.MARGIN_LEFT + i * L.COL_WIDTH;
    g.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT, stroke: CLR.grid, 'stroke-width': 1.5 }));
  }
  const statsX = L.MARGIN_LEFT + innings * L.COL_WIDTH;
  g.appendChild(svgEl('line', { x1: statsX, y1: 0, x2: statsX, y2: gridHeight, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  for (let i = 1; i <= STAT_HEADERS.length; i++) {
    g.appendChild(svgEl('line', { x1: statsX + i * L.STATS_COL_WIDTH, y1: 0, x2: statsX + i * L.STATS_COL_WIDTH, y2: gridHeight, stroke: CLR.grid, 'stroke-width': 1 }));
  }

  g.appendChild(svgEl('rect', { x: 0, y: 0, width, height: gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT, fill: 'none', stroke: CLR.gridBold, 'stroke-width': 2.5 }));

  svg.appendChild(g);
}

// ─── Header ──────────────────────────────────────────────────────

function drawHeader(svg, CLR, innings, statsWidth) {
  const g = svgEl('g', { class: 'header' });
  g.appendChild(svgEl('rect', { x: 0, y: 0, width: L.MARGIN_LEFT + innings * L.COL_WIDTH + statsWidth, height: L.HEADER_HEIGHT, fill: CLR.headerBg }));
  for (let i = 1; i <= innings; i++) {
    g.appendChild(svgText(String(i), L.MARGIN_LEFT + (i - 1) * L.COL_WIDTH + L.COL_WIDTH / 2, L.HEADER_HEIGHT - 10, {
      'text-anchor': 'middle', 'font-size': '20', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));
  }
  svg.appendChild(g);
}

function drawStatHeaders(svg, CLR, innings) {
  const g = svgEl('g', { class: 'stat-headers' });
  const baseX = L.MARGIN_LEFT + innings * L.COL_WIDTH;
  for (let i = 0; i < STAT_HEADERS.length; i++) {
    g.appendChild(svgText(STAT_HEADERS[i], baseX + i * L.STATS_COL_WIDTH + L.STATS_COL_WIDTH / 2, L.HEADER_HEIGHT - 10, {
      'text-anchor': 'middle', 'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));
  }
  svg.appendChild(g);
}

// ─── Lineup (left margin) ────────────────────────────────────────

function drawLineup(svg, CLR, lineup, rowOffsets, boxscore, gameData, side) {
  const g = svgEl('g', { class: 'lineup' });
  const team = boxscore.teams[side];
  const players = team.players;

  let subCount = 0; // running count across all slots for the entire team

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
      const bandMidY = bandY + bandHeight / 2;
      const playerData = players[`ID${player.id}`];
      const seasonBatting = playerData?.seasonStats?.batting;
      const avg = seasonBatting?.avg || '';
      const obp = seasonBatting?.obp || '';
      const isSub = player.isSubstitute;
      const nameColor = isSub ? CLR.sub : CLR.text;
      const nameWeight = isSub ? '600' : '800';

      // Font size scales down when there are many subs
      const nameFontSize = numPlayers <= 2 ? '20' : numPlayers <= 3 ? '16' : '14';
      const subFontSize = numPlayers <= 2 ? '18' : numPlayers <= 3 ? '15' : '13';
      const statFontSize = numPlayers <= 2 ? '16' : numPlayers <= 3 ? '14' : '12';

      const jerseyNum = player.jerseyNumber || '';

      if (!isSub) {
        // No separate number — jersey # is already in the name label
      } else {
        // Circled sub number
        subCount++;
        const circleX = 16;
        g.appendChild(svgEl('circle', {
          cx: circleX, cy: bandMidY, r: numPlayers <= 2 ? 10 : 8,
          fill: 'none', stroke: CLR.sub, 'stroke-width': 1.5,
        }));
        g.appendChild(svgText(String(subCount), circleX, bandMidY, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': subFontSize, 'font-weight': '700', 'font-family': L.MONO, fill: CLR.sub,
        }));

        // Thin blue separator line at top of sub band
        g.appendChild(svgEl('line', {
          x1: 4, y1: bandY + 1, x2: L.MARGIN_LEFT - 4, y2: bandY + 1,
          stroke: CLR.sub, 'stroke-width': 1.5,
        }));
      }

      const textX = isSub ? 46 : 8;
      const nameParts = player.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '').toUpperCase();
      const posNum = POS_ABBREV[player.position];
      const posStr = posNum !== undefined ? String(posNum) : player.position;
      const batSide = getPlayerBatSide(gameData, player.id);
      const sideStr = batSide ? ` / ${batSide}` : '';

      // Line 1: "POS / L / FirstName LASTNAME" (or split across 2 lines if long)
      const posLabel = `${posStr}${sideStr}`;
      const nameLine = `${posLabel} / ${firstName} ${lastName}`;
      // Approximate max chars that fit (monospace ~0.6 * fontSize per char)
      const nfs = parseInt(nameFontSize);
      const availW = L.MARGIN_LEFT - textX - 4;
      const maxChars = Math.floor(availW / (nfs * 0.6));
      const nameIsLong = nameLine.length > maxChars;

      // Season AVG/OPS with trend arrows
      const ops = seasonBatting?.ops || '';
      const avgTrend = player.avgTrend || '';
      const opsTrend = player.opsTrend || '';
      const avgLabel = avg ? `${avg}${avgTrend}` : '';
      const opsLabel = ops ? `${ops}${opsTrend}` : '';
      const statParts = [`#${jerseyNum}`];
      if (avgLabel) statParts.push(avgLabel);
      if (opsLabel) statParts.push(opsLabel);
      const statLine = statParts.join(' / ');

      if (nameIsLong) {
        // Three-line layout: "POS - FirstName" / "LASTNAME" / "#38 / .318↓ / .761↑"
        const line1Y = bandMidY - 24;
        const line2Y = bandMidY;
        const line3Y = bandMidY + 24;
        g.appendChild(svgText(`${posLabel} / ${firstName}`, textX, line1Y, {
          'font-size': nameFontSize, 'font-weight': nameWeight, 'font-family': L.MONO, fill: nameColor,
          'dominant-baseline': 'central',
        }));
        g.appendChild(svgText(lastName, textX, line2Y, {
          'font-size': nameFontSize, 'font-weight': nameWeight, 'font-family': L.MONO, fill: nameColor,
          'dominant-baseline': 'central',
        }));
        g.appendChild(svgText(statLine, textX, line3Y, {
          'font-size': statFontSize, 'font-family': L.MONO, fill: CLR.textLight,
          'dominant-baseline': 'central',
        }));
      } else {
        // Two-line layout: "POS - FirstName LASTNAME" / "#38 / .318↓ / .761↑"
        const nameY = bandMidY - 12;
        const statY = bandMidY + 12;
        g.appendChild(svgText(nameLine, textX, nameY, {
          'font-size': nameFontSize, 'font-weight': nameWeight, 'font-family': L.MONO, fill: nameColor,
          'dominant-baseline': 'central',
        }));
        g.appendChild(svgText(statLine, textX, statY, {
          'font-size': statFontSize, 'font-family': L.MONO, fill: CLR.textLight,
          'dominant-baseline': 'central',
        }));
      }
    }
  }

  svg.appendChild(g);
}

// ─── At-bat cells ────────────────────────────────────────────────

function drawAtBats(svg, CLR, lineup, grid, rowOffsets, innings, subMap, subNumberMap) {
  const g = svgEl('g', { class: 'at-bats' });

  // Pre-compute pitcher S/P counts at the point of each pitcher sub.
  // Walk cells in inning order tracking per-pitcher totals, snapshot before sub.
  const pitcherTotals = new Map(); // pitcherId → {strikes, pitches}
  const pitcherSubStats = new Map(); // "slot-inn" → {strikes, pitches} for the outgoing pitcher
  let lastPitcherId = null;
  for (let inn = 1; inn <= innings; inn++) {
    for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
      const slot = lineup[slotIdx];
      const key = `${slot.slot}-${inn}`;

      // Check for pitcher sub BEFORE counting this cell's pitches
      const subs = subMap.get(key);
      if (subs) {
        for (const sub of subs) {
          if (sub.type === 'pitcher' && lastPitcherId) {
            const t = pitcherTotals.get(lastPitcherId);
            if (t) pitcherSubStats.set(key, { strikes: t.strikes, pitches: t.pitches });
          }
        }
      }

      const atBats = grid.get(key);
      if (atBats) {
        for (const ab of atBats) {
          const pid = ab.pitcherId;
          if (!pitcherTotals.has(pid)) pitcherTotals.set(pid, { strikes: 0, pitches: 0 });
          const t = pitcherTotals.get(pid);
          for (const p of ab.pitchSequence || []) {
            t.pitches++;
            const c = p.callCode;
            if (c === 'C' || c === 'S' || c === 'F' || c === 'W' || c === 'T' || c === 'X') t.strikes++;
          }
          lastPitcherId = pid;
        }
      }
    }
  }

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    for (let inn = 1; inn <= innings; inn++) {
      const key = `${slot.slot}-${inn}`;
      const y = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
      const x = L.MARGIN_LEFT + (inn - 1) * L.COL_WIDTH;

      // Draw at-bat content
      const atBats = grid.get(key);
      if (atBats && atBats.length > 0) {
        for (const ab of atBats) {
          drawAtBatCell(g, CLR, ab, x, y);
        }
      }

      // Draw substitution indicators (independent of at-bats)
      const subs = subMap.get(key);
      if (subs) {
        for (const sub of subs) {
          const subNum = subNumberMap.get(sub.playerId) || 0;
          const pStats = sub.type === 'pitcher' ? pitcherSubStats.get(key) : null;
          drawSubIndicator(g, CLR, x, y, sub.type, subNum, pStats);
        }
      }
    }
  }

  svg.appendChild(g);
}

function drawAtBatCell(g, CLR, ab, x, y) {
  const isHR = ab.notation === 'HR';

  g.appendChild(svgEl('line', {
    x1: x + L.PITCH_COL_W, y1: y + 1, x2: x + L.PITCH_COL_W, y2: y + L.ROW_HEIGHT - 1,
    stroke: CLR.grid, 'stroke-width': 1,
  }));

  drawPitchSequence(g, CLR, ab.pitchSequence, x, y);
  drawMiniStrikeZone(g, CLR, ab.pitchSequence, x, y);

  const count = computeCount(ab.pitchSequence);
  const mainW = L.COL_WIDTH - L.PITCH_COL_W;
  const diamondCx = x + L.PITCH_COL_W + mainW / 2;
  const diamondCy = y + L.ROW_HEIGHT * 0.45;

  g.appendChild(svgText(count, x + L.PITCH_COL_W + 8, y + 18, {
    'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.textLight,
  }));

  // Draw diamond if there are runners on base / baserunner movement, or HR/HBP/CI
  // Skip diamond for sac flies — just show notation + RBI dots
  // Skip diamond for strikeouts unless the batter reaches base (dropped 3rd strike)
  const isSF = ab.result?.eventType === 'sac_fly';
  const isStrikeout = ab.result?.eventType === 'strikeout';
  let hasRunners;
  if (isSF) {
    hasRunners = false;
  } else if (isStrikeout) {
    // Only show diamond if the batter reached base (e.g. dropped third strike)
    const batterReached = ab.runners && ab.runners.some(r => r.playerId === ab.batterId && r.end && !r.isOut);
    hasRunners = !!batterReached;
  } else {
    hasRunners = ab.runners && ab.runners.some(r => r.end && r.end !== r.start);
  }
  const alwaysDiamond = isHR || ab.result?.eventType === 'hit_by_pitch' || ab.result?.eventType === 'catcher_interf';
  if (hasRunners || alwaysDiamond) {
    drawDiamond(g, CLR, diamondCx, diamondCy, ab, isHR);
  }

  const notation = ab.notation;
  const largeSize = Math.round(L.DIAMOND_R * 1.8);
  // Max font size that fits within the main area (0.6 = monospace char-width ratio)
  const maxFitSize = (len) => Math.floor(mainW * 0.85 / (0.6 * Math.max(len, 1)));
  // Hits use hash marks on diamond instead of text notation
  const isHit = notation === '1B' || notation === '2B' || notation === '3B';
  if (isHR) {
    // HR: show "HR" centered on filled diamond in white
    g.appendChild(svgText('HR', diamondCx, diamondCy, {
      'font-size': '28', 'font-weight': '900', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': L.MONO, fill: CLR.bg,
    }));
  } else if (notation && !isHit) {
    const notationColor = CLR.text;
    const isK = notation === 'K' || notation === '\u{A4D8}';
    // All play notation uses same size and weight
    const isWalk = notation === 'BB' || notation === 'IBB' || notation === 'HBP' || notation === 'CI';
    let notFontSize;
    let notFontWeight = isWalk ? '900' : '400';
    if (!hasRunners && !alwaysDiamond) {
      const scale = isWalk ? 1 : isK ? 0.7 : 0.6;
      const ideal = Math.round(largeSize * scale);
      notFontSize = String(Math.min(ideal, maxFitSize(notation.length)));
    } else {
      const len = notation.length;
      const base = len <= 2 ? 24 : len <= 4 ? 20 : len <= 6 ? 16 : 14;
      const scale = isWalk ? 1 : isK ? 0.7 : 0.6;
      const ideal = Math.round(base * scale);
      notFontSize = String(Math.min(ideal, maxFitSize(len)));
    }

    // When diamond has runner lines, place notation below diamond (centered between HP and cell bottom)
    // Always single line, consistent size/weight — use same base size for all, capped to fit width
    if (hasRunners || alwaysDiamond) {
      const belowY = (diamondCy + L.DIAMOND_R + y + L.ROW_HEIGHT) / 2;
      const belowSize = String(Math.min(24, maxFitSize(notation.length)));
      g.appendChild(svgText(notation, diamondCx, belowY, {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': belowSize, 'font-weight': '400',
        'font-family': L.MONO, fill: notationColor,
      }));
    }
    // No diamond — notation centered in cell
    else {
      const splitMatch = notation.match(/^([A-Za-z\u{A4D8}]{2,})(\d{2,})$/u);
      if (splitMatch) {
        const prefix = splitMatch[1];
        const nums = splitMatch[2];
        const maxLen = Math.max(prefix.length, nums.length);
        const fitSize = Math.min(parseInt(notFontSize) * 1.4, maxFitSize(maxLen));
        const lineGap = fitSize * 0.55;
        g.appendChild(svgText(prefix, diamondCx, diamondCy - lineGap, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': String(Math.round(fitSize)), 'font-weight': notFontWeight,
          'font-family': L.MONO, fill: notationColor,
        }));
        g.appendChild(svgText(nums, diamondCx, diamondCy + lineGap, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': String(Math.round(fitSize)), 'font-weight': notFontWeight,
          'font-family': L.MONO, fill: notationColor,
        }));
      } else if (notation.includes(' ')) {
        // Multi-word annotations (e.g. "Batter Timeout") — split into lines
        const words = notation.split(' ');
        const longestWord = Math.max(...words.map(w => w.length));
        const fitSize = Math.min(22, maxFitSize(longestWord));
        const lineGap = fitSize * 1.3;
        const startY = diamondCy - (lineGap * (words.length - 1)) / 2;
        for (let wi = 0; wi < words.length; wi++) {
          g.appendChild(svgText(words[wi], diamondCx, startY + wi * lineGap, {
            'text-anchor': 'middle', 'dominant-baseline': 'central',
            'font-size': String(Math.round(fitSize)), 'font-weight': '400',
            'font-family': L.FONT, fill: CLR.textMuted,
          }));
        }
      } else {
        g.appendChild(svgText(notation, diamondCx, diamondCy, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': notFontSize, 'font-weight': notFontWeight,
          'font-family': L.MONO, fill: notationColor,
        }));
      }
    }

    // SP K subscript counter (K₃, K₄, ...)
    if (isK && ab.spKNumber) {
      const fontSize = parseInt(notFontSize);
      const subSize = Math.round(fontSize * 0.45);
      const kWidth = fontSize * 0.5;
      g.appendChild(svgText(String(ab.spKNumber), diamondCx + kWidth / 2 + 6, diamondCy + fontSize * 0.35, {
        'text-anchor': 'start', 'dominant-baseline': 'central',
        'font-size': String(subSize), 'font-weight': '400',
        'font-family': L.MONO, fill: notationColor,
      }));
    }
  }

  // RBI dots — one filled dot per RBI in the bottom-left of the cell
  if (ab.rbi && ab.rbi > 0) {
    const dotR = 5;
    const dotSpacing = 14;
    const dotBaseX = x + L.PITCH_COL_W + 10 + dotR;
    const dotBaseY = y + L.ROW_HEIGHT - dotR - 6;
    for (let i = 0; i < ab.rbi; i++) {
      g.appendChild(svgEl('circle', {
        cx: dotBaseX + i * dotSpacing, cy: dotBaseY,
        r: dotR, fill: CLR.text,
      }));
    }
  }

  // Out number badge in top-right corner for simple outs (no runner path on diamond)
  if (ab.outNumber && !(hasRunners || alwaysDiamond)) {
    const badgeR = 11;
    const badgeCx = x + L.COL_WIDTH - badgeR - 8;
    const badgeCy = y + badgeR + 8;
    drawOutMarker(g, badgeCx, badgeCy, CLR.text, ab.outNumber);
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

// ─── Vertical pitch sequence (call code · pitch type · speed) ────

const PITCH_OVERFLOW = 10; // hide strike zone above this count

function drawPitchSequence(g, CLR, pitches, cellX, cellY) {
  if (pitches.length === 0) return;

  const showSZ = pitches.length <= PITCH_OVERFLOW;
  const szRegionH = L.ROW_HEIGHT / 3;
  const availH = (showSZ ? L.ROW_HEIGHT - szRegionH : L.ROW_HEIGHT) - L.PITCH_START_Y - 4;
  const step = Math.min(L.PITCH_STEP, availH / Math.max(pitches.length, 1));

  // Three fixed columns within pitch area for grid alignment
  const col1X = cellX + 2;                          // Call code (left-aligned)
  const col2X = cellX + 18;                         // Pitch type (left-aligned)
  const col3X = cellX + L.PITCH_COL_W - 3;          // Speed (right-aligned)
  const fs = String(L.PITCH_FONT_SIZE);

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const color = pitchColor(pitch.callCode, CLR);
    const textY = cellY + L.PITCH_START_Y + i * step + L.PITCH_FONT_SIZE;

    // Call code (C / B / F / X / S / H)
    g.appendChild(svgText(pitch.callCode, col1X, textY, {
      'font-size': fs, 'font-weight': '400', 'font-family': L.MONO, fill: color,
    }));

    // Pitch type (FF / SL / CU / CH …)
    const typeLabel = pitch.typeCode || '';
    if (typeLabel) {
      g.appendChild(svgText(typeLabel, col2X, textY, {
        'font-size': fs, 'font-weight': '400', 'font-family': L.MONO, fill: color,
      }));
    }

    // Speed (mph)
    const speed = pitch.speed ? String(Math.round(pitch.speed)) : '';
    if (speed) {
      g.appendChild(svgText(speed, col3X, textY, {
        'font-size': fs, 'font-weight': '400', 'font-family': L.MONO, fill: color,
        'text-anchor': 'end',
      }));
    }
  }
}

// ─── Mini strike zone (bottom 1/3 of pitch column) ──────────────

function drawMiniStrikeZone(g, CLR, pitches, cellX, cellY) {
  if (pitches.length === 0 || pitches.length > PITCH_OVERFLOW) return;

  const regionH = L.ROW_HEIGHT * 0.28;
  const padX = 6;
  const padTop = 4;
  const padBot = 8;
  const maxW = L.PITCH_COL_W - padX * 2;
  const maxH = regionH - padTop - padBot;
  // Real strike zone is tall portrait (~1:2 w:h ratio)
  const aspect = 2.0;
  let zoneH = maxH;
  let zoneW = zoneH / aspect;
  if (zoneW > maxW) { zoneW = maxW; zoneH = zoneW * aspect; }
  const zoneX = cellX + padX + (maxW - zoneW) / 2;
  const zoneY = cellY + L.ROW_HEIGHT - regionH + padTop + (maxH - zoneH) / 2;

  // Clamp boundaries to keep dots inside the cell
  const clipTop = cellY + L.ROW_HEIGHT - regionH;
  const clipBot = cellY + L.ROW_HEIGHT - padBot;
  const mapX = (pX) => zoneX + ((pX + PX_RANGE / 2) / PX_RANGE) * zoneW;
  const mapY = (pZ) => Math.max(clipTop, Math.min(clipBot, zoneY + (1 - (pZ - PZ_MIN) / (PZ_MAX - PZ_MIN)) * zoneH));

  const avgTop = averageZoneEdge(pitches, 'szTop', 3.4);
  const avgBot = averageZoneEdge(pitches, 'szBot', 1.6);
  const szLeft = mapX(-SZ_HALF_PLATE);
  const szRight = mapX(SZ_HALF_PLATE);
  const szTopY = mapY(avgTop);
  const szBotY = mapY(avgBot);

  g.appendChild(svgEl('rect', {
    x: szLeft, y: szTopY,
    width: szRight - szLeft, height: szBotY - szTopY,
    fill: 'none', stroke: CLR.grid, 'stroke-width': 0.75,
  }));

  for (const pitch of pitches) {
    if (pitch.pX === null || pitch.pZ === null) continue;
    const dotX = mapX(pitch.pX);
    const dotY = mapY(pitch.pZ);
    const color = pitchColor(pitch.callCode, CLR);

    g.appendChild(svgEl('rect', {
      x: dotX - 2, y: dotY - 2, width: 4, height: 4,
      fill: color,
    }));
  }
}

function averageZoneEdge(pitches, field, fallback) {
  let sum = 0, count = 0;
  for (const p of pitches) {
    if (p[field] != null) { sum += p[field]; count++; }
  }
  return count > 0 ? sum / count : fallback;
}

// ─── Diamond rendering ───────────────────────────────────────────

// Figma-matched diamond constants (from 134-unit Figma diamond, scaled to DIAMOND_R)
const FIGMA_R = 67; // Figma diamond half-size
const PATH_SW = 4;  // base path stroke-width — matches circle-X marker weight
const HASH_SW = 4;  // hash mark stroke-width — matches PATH_SW
const DIAMOND_SW = 2.5; // diamond outline stroke-width (Figma)

function drawDiamond(g, CLR, cx, cy, ab, isHR = false) {
  const R = L.DIAMOND_R;
  const hp = { x: cx, y: cy + R };       // bottom
  const b1 = { x: cx + R, y: cy };       // right
  const b2 = { x: cx, y: cy - R };       // top
  const b3 = { x: cx - R, y: cy };       // left

  // Diamond outline — only show for HR (filled), otherwise hidden
  if (isHR) {
    g.appendChild(svgEl('polygon', {
      points: `${hp.x},${hp.y} ${b1.x},${b1.y} ${b2.x},${b2.y} ${b3.x},${b3.y}`,
      fill: CLR.text, stroke: CLR.text, 'stroke-width': DIAMOND_SW,
    }));
  }

  // Base path lines from runner journeys (extended past corners to overlap)
  const EXT = PATH_SW * 0.6; // overlap amount
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
      for (const seg of runner.segments) {
        const from = diamondPt(cx, cy, R, seg.from);
        const to = diamondPt(cx, cy, R, seg.to);
        if (seg.isOutSegment && outSeg) {
          // Truncate: draw from start to midpoint only (no extension)
          g.appendChild(svgEl('line', {
            x1: from.x, y1: from.y, x2: outMx, y2: outMy,
            stroke: CLR.text, 'stroke-width': PATH_SW,
          }));
        } else {
          const ln = extendedLine(from, to, EXT);
          g.appendChild(svgEl('line', {
            ...ln,
            stroke: CLR.text, 'stroke-width': PATH_SW,
          }));
        }
      }
      if (runner.isOut) {
        if (outSeg) {
          drawOutMarker(g, outMx, outMy, CLR.text, runner.outNumber);
        } else if (runner.outBase) {
          const pos = diamondPt(cx, cy, R, runner.outBase);
          drawOutMarker(g, pos.x, pos.y, CLR.text, runner.outNumber);
        }
      }
    }
  } else {
    const segments = computeBasePathSegments(ab, CLR);
    for (const seg of segments) {
      const from = diamondPt(cx, cy, R, seg.from);
      const to = diamondPt(cx, cy, R, seg.to);
      const ln = extendedLine(from, to, EXT);
      g.appendChild(svgEl('line', {
        ...ln,
        stroke: CLR.text, 'stroke-width': PATH_SW,
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

function drawOutMarker(g, cx, cy, color, outNumber) {
  const r = 13; // marker radius
  const scale = (r * 2) / 44;
  const marker = svgEl('g', {
    transform: `translate(${cx - r}, ${cy - r}) scale(${scale})`,
  });
  // Circle background
  marker.appendChild(svgEl('circle', {
    cx: 21.8979, cy: 21.8979, r: 21.8979, fill: color,
  }));
  // Number glyph (white)
  const num = Math.min(3, Math.max(1, outNumber || 1));
  const numPath = OUT_NUMBER_PATHS[num];
  if (numPath) {
    marker.appendChild(svgEl('path', { d: numPath, fill: '#ffffff' }));
  }
  g.appendChild(marker);
}

/** Extend a line segment past its endpoints by `ext` pixels to overlap at corners */
function extendedLine(from, to, ext) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  const ux = dx / len * ext;
  const uy = dy / len * ext;
  return { x1: from.x - ux, y1: from.y - uy, x2: to.x + ux, y2: to.y + uy };
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
      stroke: CLR.text, 'stroke-width': HASH_SW,
    }));
  }
}

function baseCoords(cx, cy, baseName) {
  const b = L.BASES[baseName] || L.BASES.HP;
  return { x: cx + b.dx, y: cy + b.dy };
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

function getReachedBases(ab, CLR) {
  return ab.runners
    .filter(r => !r.isOut && r.end && r.end !== 'score')
    .map(r => ({ base: r.end, color: CLR.text }));
}

function drawRunnerAnnotations(g, CLR, cellX, cellY, ab, diamondCx, diamondCy) {
  const order = ['HP', '1B', '2B', '3B'];
  const label = { HP: 'H', '1B': '1', '2B': '2', '3B': '3' };
  // Use cumulative runners if available, else per-AB runners
  const runners = ab.cumulativeRunners || ab.runners;
  const anns = [];

  const ADV_LABELS = { sb: 'SB', cs: 'CS', wp: 'WP', pb: 'PB', bk: 'BK' };
  for (const runner of runners) {
    if (runner.segments) {
      if (runner.segments.length === 0) continue;
      const firstBase = runner.segments[0].from;
      // Group consecutive segments by advanceType, show special labels for non-hit advances
      const specialAdvances = runner.segments
        .filter(s => s.advanceType && s.advanceType !== 'hit')
        .map(s => ADV_LABELS[s.advanceType] || s.advanceType.toUpperCase());
      // Remove duplicates
      const unique = [...new Set(specialAdvances)];
      let text;
      if (unique.length > 0) {
        text = unique.join('+');
      } else {
        // Default: show base path (H12 etc)
        const parts = [label[firstBase]];
        for (const seg of runner.segments) parts.push(label[seg.to]);
        text = parts.join('');
      }
      anns.push({ text, start: firstBase });
    } else {
      // Fallback per-AB runner, no dashes
      if (!runner.start || !runner.end || runner.end === runner.start) continue;
      const startIdx = order.indexOf(runner.start);
      const endBase = runner.end === 'score' ? 'HP' : runner.end;
      const steps = runner.end === 'score' ? 4 - startIdx : order.indexOf(endBase) - startIdx;
      if (steps <= 0) continue;
      const parts = [];
      for (let i = 0; i <= steps; i++) parts.push(label[order[(startIdx + i) % 4]]);
      anns.push({ text: parts.join(''), start: runner.start || 'HP' });
    }
  }
  if (anns.length === 0) return;

  // Place annotation OUTSIDE the diamond at midpoint of first segment
  // Clamp within cell boundaries to prevent overflow
  const R = L.DIAMOND_R;
  const nudge = 12;
  const cellRight = cellX + L.COL_WIDTH - 2;
  const cellLeft = cellX + L.PITCH_COL_W + 2;
  const cellTop = cellY + 2;
  const cellBot = cellY + L.ROW_HEIGHT - 2;
  const seg = {
    HP:   { mx:  0.5, my:  0.5, nx:  1, ny:  1 },  // bottom-right
    '1B': { mx:  0.5, my: -0.5, nx:  1, ny: -1 },  // top-right
    '2B': { mx: -0.5, my: -0.5, nx: -1, ny: -1 },  // top-left
    '3B': { mx: -0.5, my:  0.5, nx: -1, ny:  1 },  // bottom-left
  };
  for (const ann of anns) {
    const b = seg[ann.start] || seg.HP;
    const mx = diamondCx + R * b.mx;
    const my = diamondCy + R * b.my;
    let ax = mx + nudge * b.nx * 0.707;
    let ay = my + nudge * b.ny * 0.707;
    // Scale font for long annotations
    const fontSize = ann.text.length <= 3 ? 14 : ann.text.length <= 4 ? 12 : 10;
    const textW = ann.text.length * fontSize * 0.6;
    const anchor = b.nx > 0 ? 'start' : 'end';
    // Clamp horizontal: right-side text must not exceed cellRight
    if (anchor === 'start' && ax + textW > cellRight) ax = cellRight - textW;
    if (anchor === 'end' && ax - textW < cellLeft) ax = cellLeft + textW;
    // Clamp vertical
    ay = Math.max(cellTop + fontSize / 2, Math.min(cellBot - fontSize / 2, ay));
    g.appendChild(svgText(ann.text, ax, ay, {
      'text-anchor': anchor, 'dominant-baseline': 'central',
      'font-size': String(fontSize), 'font-weight': '800', 'font-family': L.MONO, fill: CLR.text,
    }));
  }
}

// ─── Batter stats ────────────────────────────────────────────────

function drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, innings, gridHeight) {
  const g = svgEl('g', { class: 'batter-stats' });
  const baseX = L.MARGIN_LEFT + innings * L.COL_WIDTH;
  const totals = [0, 0, 0, 0];

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    const baseY = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
    const numPlayers = slot.players.length;
    const bandHeight = L.ROW_HEIGHT / Math.max(1, numPlayers);
    const fontSize = numPlayers <= 2 ? '16' : numPlayers <= 3 ? '13' : '11';

    for (let pIdx = 0; pIdx < numPlayers; pIdx++) {
      const stats = batterStats.get(slot.players[pIdx].id);
      if (!stats) continue;
      const bandMidY = baseY + pIdx * bandHeight + bandHeight / 2;
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

  const totalsY = gridHeight - 2;
  g.appendChild(svgEl('line', {
    x1: baseX, y1: gridHeight - L.SUMMARY_ROW_HEIGHT,
    x2: baseX + STAT_HEADERS.length * L.STATS_COL_WIDTH, y2: gridHeight - L.SUMMARY_ROW_HEIGHT,
    stroke: CLR.gridBold, 'stroke-width': 1.5,
  }));
  for (let i = 0; i < totals.length; i++) {
    g.appendChild(svgText(String(totals[i]), baseX + i * L.STATS_COL_WIDTH + L.STATS_COL_WIDTH / 2, totalsY - 6, {
      'text-anchor': 'middle', 'font-size': '16', 'font-weight': '900', 'font-family': L.FONT, fill: CLR.text,
    }));
  }

  svg.appendChild(g);
}

// ─── Team logo (bottom-right corner) ─────────────────────────────

function drawTeamLogo(svg, teamId, innings, gridHeight, statsWidth) {
  const boxX = L.MARGIN_LEFT + innings * L.COL_WIDTH;
  const boxY = gridHeight;
  const boxW = statsWidth;
  const boxH = SUMMARY_LABELS.length * L.SUMMARY_ROW_HEIGHT;
  const padding = 16;
  const size = Math.min(boxW, boxH) - padding * 2;
  const logoX = boxX + (boxW - size) / 2;
  const logoY = boxY + (boxH - size) / 2;
  const img = svgEl('image', {
    href: `https://www.mlbstatic.com/team-logos/${teamId}.svg`,
    x: logoX, y: logoY, width: size, height: size,
    opacity: '0.25',
  });
  svg.appendChild(img);
}

// ─── Summary rows ────────────────────────────────────────────────

function drawSummaryRows(svg, CLR, linescore, side, innings, gridHeight, width, statsWidth, inningPitchCounts) {
  const g = svgEl('g', { class: 'summary-rows' });
  const innData = linescore.innings || [];
  const halfKey = side === 'away' ? 'away' : 'home';

  for (let rowIdx = 0; rowIdx < SUMMARY_LABELS.length; rowIdx++) {
    const label = SUMMARY_LABELS[rowIdx];
    const y = gridHeight + rowIdx * L.SUMMARY_ROW_HEIGHT;
    const textY = y + L.SUMMARY_ROW_HEIGHT / 2;

    g.appendChild(svgText(label, L.MARGIN_LEFT - 12, textY, {
      'text-anchor': 'end', 'dominant-baseline': 'central',
      'font-size': '18', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));

    for (let inn = 0; inn < innings; inn++) {
      if (label === 'S / P') {
        const pc = inningPitchCounts?.[inn];
        if (!pc || pc.pitches === 0) continue;
        const display = `${pc.strikes} / ${pc.pitches}`;
        g.appendChild(svgText(display, L.MARGIN_LEFT + inn * L.COL_WIDTH + L.COL_WIDTH / 2, textY, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': '16', 'font-weight': '600', 'font-family': L.FONT,
          fill: CLR.text,
        }));
      } else {
        const halfData = innData[inn]?.[halfKey];
        if (!halfData) continue;
        let value;
        switch (label) {
          case 'R': value = halfData.runs; break;
          case 'H': value = halfData.hits; break;
          case 'E': value = halfData.errors; break;
          case 'LOB': value = halfData.leftOnBase; break;
        }
        if (value == null) continue;
        g.appendChild(svgText(String(value), L.MARGIN_LEFT + inn * L.COL_WIDTH + L.COL_WIDTH / 2, textY, {
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

export function renderPitcherStatsHTML(data, side) {
  const boxscore = data.liveData.boxscore;
  const decisions = data.liveData.decisions || {};
  const gameData = data.gameData;
  const pitchers = getPitcherStats(boxscore, side, decisions);
  if (pitchers.length === 0) return '';

  const rows = pitchers.map(p => {
    const s = p.stats;
    const hand = getPlayerPitchHand(gameData, p.id);
    return `
      <tr>
        <td class="pitcher-name">${p.name}<span class="hand-indicator">, ${hand || '?'}</span>${p.note ? ` <span class="pitcher-note">${p.note}</span>` : ''}</td>
        <td>${s.inningsPitched ?? ''}</td>
        <td>${s.hits ?? 0}</td>
        <td>${s.runs ?? 0}</td>
        <td>${s.earnedRuns ?? 0}</td>
        <td>${s.baseOnBalls ?? 0}</td>
        <td>${s.strikeOuts ?? 0}</td>
        <td>${s.strikes ?? 0}</td>
        <td>${s.numberOfPitches ?? 0}</td>
      </tr>`;
  }).join('');

  return `
    <table class="pitcher-stats-table">
      <thead><tr><th>PITCHERS</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>S</th><th>P</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderStartingPitcherHTML(data, side) {
  const info = getStartingPitcherInfo(data, side);
  if (!info) return '';

  const s = info.seasonStats;
  const rep = info.repertoire.map(r => r.code).join(', ') || 'N/A';

  return `
    <div class="starting-pitcher-info">
      <strong>${info.name}</strong><span class="hand-indicator">, ${info.hand || '?'}</span>
      <span class="sp-record">${s.w}-${s.l}, ${s.era} ERA, ${s.whip} WHIP</span>
      <br>
      <span class="sp-season">Season: ${s.ip} IP, ${s.h} H, ${s.r} R, ${s.er} ER, ${s.bb} BB, ${s.k} K</span>
      <br>
      <span class="sp-repertoire">Pitches: ${rep}</span>
    </div>`;
}

export function renderBenchHTML(data, side) {
  const boxscore = data.liveData.boxscore;
  const gameData = data.gameData;
  const players = getBenchPlayers(boxscore, side);
  if (players.length === 0) return '';

  const rows = players.map(p => {
    const bat = getPlayerBatSide(gameData, p.id);
    return `
    <tr>
      <td class="pitcher-name">${p.name}<span class="hand-indicator">, ${bat || '?'}</span></td>
      <td>${p.position}</td>
      <td>${p.avg}</td>
      <td>${p.obp}</td>
      <td>${p.slg}</td>
      <td>${p.hr}</td>
      <td>${p.rbi}</td>
    </tr>`;
  }).join('');

  return `
    <details class="collapsible-section">
      <summary role="button" aria-expanded="false">Bench (${players.length})</summary>
      <table class="pitcher-stats-table">
        <thead><tr><th>BENCH</th><th>POS</th><th>AVG</th><th>OBP</th><th>SLG</th><th>HR</th><th>RBI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

export function renderBullpenHTML(data, side) {
  const boxscore = data.liveData.boxscore;
  const gameData = data.gameData;
  const players = getBullpenPitchers(boxscore, side);
  if (players.length === 0) return '';

  const rows = players.map(p => {
    const hand = getPlayerPitchHand(gameData, p.id);
    return `
    <tr>
      <td class="pitcher-name">${p.name}<span class="hand-indicator">, ${hand || '?'}</span></td>
      <td>${p.era}</td>
      <td>${p.record}</td>
      <td>${p.sv}</td>
      <td>${p.hld}</td>
      <td>${p.ip}</td>
      <td>${p.k}</td>
      <td>${p.whip}</td>
    </tr>`;
  }).join('');

  return `
    <details class="collapsible-section">
      <summary role="button" aria-expanded="false">Bullpen (${players.length})</summary>
      <table class="pitcher-stats-table">
        <thead><tr><th>BULLPEN</th><th>ERA</th><th>W-L</th><th>SV</th><th>HLD</th><th>IP</th><th>K</th><th>WHIP</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

export function renderGameHeaderHTML(data) {
  const gd = data.gameData;
  const ls = data.liveData.linescore;
  const decisions = data.liveData.decisions || {};
  const away = gd.teams.away;
  const home = gd.teams.home;
  const info = getGameInfo(gd);

  const awayTotals = ls.teams.away;
  const homeTotals = ls.teams.home;
  const awayLOB = data.liveData.boxscore.teams.away.teamStats?.batting?.leftOnBase ?? '';
  const homeLOB = data.liveData.boxscore.teams.home.teamStats?.batting?.leftOnBase ?? '';

  const wp = decisions.winner ? `WP: ${decisions.winner.fullName}` : '';
  const lp = decisions.loser ? `LP: ${decisions.loser.fullName}` : '';
  const sv = decisions.save ? `SV: ${decisions.save.fullName}` : '';
  const decisionParts = [wp, lp, sv].filter(Boolean);

  const firstPitchStr = info.firstPitch
    ? new Date(info.firstPitch).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : info.time;

  return `
    <div class="game-header">
      <div class="game-header-teams">
        <div class="game-header-team">
          <img class="team-logo-sm" src="https://www.mlbstatic.com/team-logos/${away.id}.svg" alt="${away.abbreviation}">
          <span class="team-abbrev">${away.abbreviation}</span>
          <span class="team-record">(${away.record.wins}-${away.record.losses})</span>
        </div>
        <span class="game-header-at">@</span>
        <div class="game-header-team">
          <img class="team-logo-sm" src="https://www.mlbstatic.com/team-logos/${home.id}.svg" alt="${home.abbreviation}">
          <span class="team-abbrev">${home.abbreviation}</span>
          <span class="team-record">(${home.record.wins}-${home.record.losses})</span>
        </div>
      </div>

      <table class="rhe-box">
        <thead><tr><th></th><th>R</th><th>H</th><th>E</th><th>LOB</th></tr></thead>
        <tbody>
          <tr><td class="rhe-team">${away.abbreviation}</td><td><strong>${awayTotals.runs}</strong></td><td>${awayTotals.hits}</td><td>${awayTotals.errors}</td><td>${awayLOB}</td></tr>
          <tr><td class="rhe-team">${home.abbreviation}</td><td><strong>${homeTotals.runs}</strong></td><td>${homeTotals.hits}</td><td>${homeTotals.errors}</td><td>${homeLOB}</td></tr>
        </tbody>
      </table>

      <div class="game-header-meta">
        ${decisionParts.length > 0 ? `<p class="decisions">${decisionParts.join(' | ')}</p>` : ''}
        <p class="venue-info"><strong>${info.venue}</strong> | ${info.date} | First Pitch: ${firstPitchStr}</p>
        <p class="weather-info">${info.weather}${info.wind ? ', Wind: ' + info.wind : ''}</p>
        ${info.attendance ? `<p class="attendance">Attendance: ${info.attendance.toLocaleString()}</p>` : ''}
        ${info.durationMinutes ? `<p class="duration">Duration: ${Math.floor(info.durationMinutes / 60)}:${String(info.durationMinutes % 60).padStart(2, '0')}</p>` : ''}
        <p class="game-status">${gd.status.detailedState}</p>
      </div>
    </div>`;
}

export function renderLinescoreHTML(data) {
  const ls = data.liveData.linescore;
  const gd = data.gameData;
  const innings = ls.innings || [];
  const numInnings = Math.max(innings.length, 9);

  const headerCells = Array.from({ length: numInnings }, (_, i) => `<th>${i + 1}</th>`).join('');
  const awayInnings = Array.from({ length: numInnings }, (_, i) => `<td>${innings[i]?.away?.runs ?? ''}</td>`).join('');
  const homeInnings = Array.from({ length: numInnings }, (_, i) => `<td>${innings[i]?.home?.runs ?? ''}</td>`).join('');

  return `
    <table class="linescore-table">
      <thead><tr><th></th>${headerCells}<th class="rhe">R</th><th class="rhe">H</th><th class="rhe">E</th></tr></thead>
      <tbody>
        <tr><td class="team-name">${gd.teams.away.abbreviation}</td>${awayInnings}<td class="rhe"><strong>${ls.teams.away.runs}</strong></td><td class="rhe">${ls.teams.away.hits}</td><td class="rhe">${ls.teams.away.errors}</td></tr>
        <tr><td class="team-name">${gd.teams.home.abbreviation}</td>${homeInnings}<td class="rhe"><strong>${ls.teams.home.runs}</strong></td><td class="rhe">${ls.teams.home.hits}</td><td class="rhe">${ls.teams.home.errors}</td></tr>
      </tbody>
    </table>`;
}

export function renderUmpiresHTML(data) {
  const umps = extractUmpires(data);
  if (!umps.hp && !umps.first && !umps.second && !umps.third) return '';

  const rows = [
    umps.hp ? `<span class="ump-entry"><span class="ump-pos">HP</span> ${umps.hp}</span>` : '',
    umps.first ? `<span class="ump-entry"><span class="ump-pos">1B</span> ${umps.first}</span>` : '',
    umps.second ? `<span class="ump-entry"><span class="ump-pos">2B</span> ${umps.second}</span>` : '',
    umps.third ? `<span class="ump-entry"><span class="ump-pos">3B</span> ${umps.third}</span>` : '',
  ].filter(Boolean).join('');

  return `<div class="umpires-section"><span class="ump-label">UMPS</span>${rows}</div>`;
}
