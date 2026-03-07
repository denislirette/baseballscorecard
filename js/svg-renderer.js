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
const SUMMARY_LABELS = ['R', 'H', 'E', 'LOB'];

// Strike zone mapping range — controls how much "air" surrounds the zone box.
// Wider ranges → smaller zone box relative to plot area → tighter cluster.
const PX_RANGE = 4.0;   // horizontal range in feet (centered on 0)
const PZ_MIN = 0.0;     // bottom of vertical mapping (feet)
const PZ_MAX = 5.0;     // top of vertical mapping (feet)
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
    FONT: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    MONO: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
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

export { svgEl, svgText };

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

  drawGrid(svg, CLR, lineup, innings, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows, activeCellKey);
  drawHeader(svg, CLR, innings, statsWidth);
  drawStatHeaders(svg, CLR, innings);
  drawLineup(svg, CLR, lineup, rowOffsets, boxscore, gameData, side);
  drawAtBats(svg, CLR, lineup, grid, rowOffsets, innings, subMap, subNumberMap);
  drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, innings, gridHeight);
  drawSummaryRows(svg, CLR, linescore, side, innings, gridHeight, width, statsWidth);

  return svg;
}

// ─── Per-cell substitution indicators ────────────────────────────

function drawSubIndicator(g, CLR, x, y, subType, subNum) {
  const circleR = 7;
  const circleFontSize = '10';

  // Abbreviated sub label at bottom of main area
  const subLabels = { pitcher: 'P-SUB', PH: 'PH', PR: 'PR', defensive: 'D-SUB' };
  const label = subLabels[subType];
  if (label) {
    const labelX = x + L.PITCH_COL_W + (L.COL_WIDTH - L.PITCH_COL_W) / 2;
    const labelY = y + L.ROW_HEIGHT - 8;
    g.appendChild(svgText(label, labelX, labelY, {
      'text-anchor': 'middle', 'font-size': '12', 'font-weight': '700',
      'font-family': L.MONO, fill: CLR.sub,
    }));
  }

  if (subType === 'pitcher') {
    // Dashed blue line across top edge
    g.appendChild(svgEl('line', {
      x1: x, y1: y,
      x2: x + L.COL_WIDTH, y2: y,
      stroke: CLR.sub, 'stroke-width': 5,
      'stroke-dasharray': '10,6',
    }));
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

function drawGrid(svg, CLR, lineup, innings, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows, activeCellKey) {
  const g = svgEl('g', { class: 'grid-lines' });

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

  // Each slot = 1 row, so totalRows === lineup.length. Draw bold lines for all.
  for (let i = 0; i <= totalRows; i++) {
    const y = L.HEADER_HEIGHT + i * L.ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: width, y2: y, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
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
      const nameFontSize = numPlayers <= 2 ? '17' : numPlayers <= 3 ? '14' : '12';
      const subFontSize = numPlayers <= 2 ? '16' : numPlayers <= 3 ? '13' : '11';
      const statFontSize = numPlayers <= 2 ? '14' : numPlayers <= 3 ? '12' : '10';

      if (!isSub) {
        // Slot number for the starter
        g.appendChild(svgText(String(slot.slot), 12, bandMidY, {
          'font-size': '22', 'font-weight': '800', 'font-family': L.MONO, fill: CLR.text,
          'dominant-baseline': 'central',
        }));
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

      const textX = isSub ? 46 : 38;
      const nameParts = player.name.split(' ');
      const lastName = (nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]).toUpperCase();
      const posNum = POS_ABBREV[player.position];
      const posStr = posNum !== undefined ? String(posNum) : player.position;
      const batSide = getPlayerBatSide(gameData, player.id);
      const label = `${lastName}-${posStr} (${batSide || '?'})`;

      // Player name — vertically centered in band
      g.appendChild(svgText(label, textX, bandMidY, {
        'font-size': nameFontSize, 'font-weight': nameWeight, 'font-family': L.MONO, fill: nameColor,
        'dominant-baseline': 'central',
      }));

      // Season avg/obp right-aligned on same line as player name
      // These stats belong to THIS player — kept together as "AVG/OBP"
      const statX = L.MARGIN_LEFT - 8;
      const statLabel = avg && obp ? `${avg}/${obp}` : avg || obp || '';
      if (statLabel) {
        g.appendChild(svgText(statLabel, statX, bandMidY, {
          'text-anchor': 'end', 'font-size': statFontSize, 'font-family': L.MONO, fill: CLR.textLight,
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
          drawSubIndicator(g, CLR, x, y, sub.type, subNum);
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

  // Only draw diamond if there are runners on base / baserunner movement
  const hasRunners = ab.runners && ab.runners.some(r => r.end && r.end !== r.start);
  if (hasRunners) {
    drawDiamond(g, CLR, diamondCx, diamondCy, ab, isHR);
  }

  const notation = ab.notation;
  const largeSize = Math.round(L.DIAMOND_R * 1.8);
  // Max font size that fits within the main area (0.6 = monospace char-width ratio)
  const maxFitSize = (len) => Math.floor(mainW * 0.85 / (0.6 * Math.max(len, 1)));
  if (notation) {
    const notationColor = isHR ? CLR.cellBg : CLR.text;
    const isK = notation === 'K' || notation === '\u{A4D8}';
    let notFontSize;
    if (!hasRunners) {
      // No diamond — large notation, capped to fit cell width
      const ideal = largeSize;
      notFontSize = String(Math.min(ideal, maxFitSize(notation.length)));
    } else if (isK) {
      // K always large even with diamond
      notFontSize = String(largeSize);
    } else {
      // With diamond — smaller so it doesn't overpower base paths
      const len = notation.length;
      const ideal = len <= 2 ? 24 : len <= 4 ? 20 : len <= 6 ? 16 : 14;
      notFontSize = String(Math.min(ideal, maxFitSize(len)));
    }

    g.appendChild(svgText(notation, diamondCx, diamondCy, {
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': notFontSize, 'font-weight': '900',
      'font-family': L.MONO, fill: notationColor,
    }));

    // SP K subscript counter (K¹, K², ...)
    if (isK && ab.spKNumber) {
      const fontSize = parseInt(notFontSize);
      const subSize = Math.round(fontSize * 0.35);
      const kWidth = fontSize * 0.55;
      g.appendChild(svgText(String(ab.spKNumber), diamondCx + kWidth / 2 + 2, diamondCy + fontSize * 0.2, {
        'text-anchor': 'start', 'dominant-baseline': 'central',
        'font-size': String(subSize), 'font-weight': '700',
        'font-family': L.MONO, fill: notationColor,
      }));
    }
  }

  // RBI indicator
  if (ab.rbi && ab.rbi > 0) {
    const rbiX = x + L.COL_WIDTH - 4;
    const rbiY = y + 18;
    const rbiLabel = ab.rbi === 1 ? 'RBI' : `${ab.rbi}RBI`;
    g.appendChild(svgText(rbiLabel, rbiX, rbiY, {
      'text-anchor': 'end', 'font-size': '13', 'font-weight': '800',
      'font-family': L.MONO, fill: CLR.hit,
    }));
  }

  if (hasRunners) {
    drawRunnerAnnotations(g, CLR, x, y, ab, diamondCx, diamondCy);
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

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const color = pitchColor(pitch.callCode, CLR);
    const textY = cellY + L.PITCH_START_Y + i * step + L.PITCH_FONT_SIZE;

    // Call code (C / B / F / X / S / H)
    g.appendChild(svgText(pitch.callCode, cellX + 3, textY, {
      'font-size': String(L.PITCH_FONT_SIZE), 'font-weight': '700', 'font-family': L.MONO, fill: color,
    }));

    // Pitch type (FF / SL / CU / CH …) — centered between call code and speed
    const typeLabel = pitch.typeCode || '';
    if (typeLabel) {
      g.appendChild(svgText(typeLabel, cellX + L.PITCH_COL_W / 2, textY, {
        'font-size': String(L.PITCH_FONT_SIZE), 'font-weight': '700', 'font-family': L.MONO, fill: color,
        'text-anchor': 'middle',
      }));
    }

    // Speed (mph)
    const speed = pitch.speed ? String(Math.round(pitch.speed)) : '';
    if (speed) {
      g.appendChild(svgText(speed, cellX + L.PITCH_COL_W - 4, textY, {
        'font-size': String(L.PITCH_FONT_SIZE), 'font-weight': '700', 'font-family': L.MONO, fill: color,
        'text-anchor': 'end',
      }));
    }
  }
}

// ─── Mini strike zone (bottom 1/3 of pitch column) ──────────────

function drawMiniStrikeZone(g, CLR, pitches, cellX, cellY) {
  if (pitches.length === 0 || pitches.length > PITCH_OVERFLOW) return;

  const regionH = L.ROW_HEIGHT / 3;
  const pad = 6;
  const maxW = L.PITCH_COL_W - pad * 2;
  const maxH = regionH - pad * 2;
  // Real strike zone is portrait (~1:1.4 w:h ratio)
  const aspect = 1.4;
  let zoneH = maxH;
  let zoneW = zoneH / aspect;
  if (zoneW > maxW) { zoneW = maxW; zoneH = zoneW * aspect; }
  const zoneX = cellX + pad + (maxW - zoneW) / 2;
  const zoneY = cellY + L.ROW_HEIGHT - regionH + pad + (maxH - zoneH) / 2;

  const mapX = (pX) => zoneX + ((pX + PX_RANGE / 2) / PX_RANGE) * zoneW;
  const mapY = (pZ) => zoneY + (1 - (pZ - PZ_MIN) / (PZ_MAX - PZ_MIN)) * zoneH;

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

function drawDiamond(g, CLR, cx, cy, ab, isHR = false) {
  const hp = { x: cx + L.BASES.HP.dx, y: cy + L.BASES.HP.dy };
  const b1 = { x: cx + L.BASES['1B'].dx, y: cy + L.BASES['1B'].dy };
  const b2 = { x: cx + L.BASES['2B'].dx, y: cy + L.BASES['2B'].dy };
  const b3 = { x: cx + L.BASES['3B'].dx, y: cy + L.BASES['3B'].dy };

  g.appendChild(svgEl('polygon', {
    points: `${hp.x},${hp.y} ${b1.x},${b1.y} ${b2.x},${b2.y} ${b3.x},${b3.y}`,
    fill: isHR ? CLR.text : 'none', stroke: CLR.text, 'stroke-width': 2.5,
  }));

  // Use cumulative runner journeys if available, else fall back to per-AB runners
  const cumRunners = ab.cumulativeRunners;
  if (cumRunners && cumRunners.length > 0) {
    // Draw all cumulative segments (full journey of each runner)
    for (const runner of cumRunners) {
      for (const seg of runner.segments) {
        const from = baseCoords(cx, cy, seg.from);
        const to = baseCoords(cx, cy, seg.to);
        g.appendChild(svgEl('line', {
          x1: from.x, y1: from.y, x2: to.x, y2: to.y,
          stroke: CLR.text, 'stroke-width': 5, 'stroke-linecap': 'round',
        }));
      }
      // Dot on current base (if runner is still on base, not scored/out)
      if (runner.currentBase && !runner.isOut) {
        const pos = baseCoords(cx, cy, runner.currentBase);
        g.appendChild(svgEl('circle', { cx: pos.x, cy: pos.y, r: 6, fill: CLR.text }));
      }
    }
  } else {
    // Fallback: use per-AB runner data
    const segments = computeBasePathSegments(ab, CLR);
    for (const seg of segments) {
      const from = baseCoords(cx, cy, seg.from);
      const to = baseCoords(cx, cy, seg.to);
      g.appendChild(svgEl('line', {
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        stroke: CLR.text, 'stroke-width': 5, 'stroke-linecap': 'round',
      }));
    }
    const reachedBases = getReachedBases(ab, CLR);
    for (const base of reachedBases) {
      const pos = baseCoords(cx, cy, base.base);
      g.appendChild(svgEl('circle', { cx: pos.x, cy: pos.y, r: 6, fill: base.color }));
    }
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

  for (const runner of runners) {
    if (runner.segments) {
      // Cumulative: build label from full segment list, no dashes
      if (runner.segments.length === 0) continue;
      const firstBase = runner.segments[0].from;
      const parts = [label[firstBase]];
      for (const seg of runner.segments) parts.push(label[seg.to]);
      anns.push({ text: parts.join(''), start: firstBase });
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

// ─── Summary rows ────────────────────────────────────────────────

function drawSummaryRows(svg, CLR, linescore, side, innings, gridHeight, width, statsWidth) {
  const g = svgEl('g', { class: 'summary-rows' });
  const innData = linescore.innings || [];
  const halfKey = side === 'away' ? 'away' : 'home';

  for (let rowIdx = 0; rowIdx < SUMMARY_LABELS.length; rowIdx++) {
    const label = SUMMARY_LABELS[rowIdx];
    const y = gridHeight + rowIdx * L.SUMMARY_ROW_HEIGHT;
    const textY = y + L.SUMMARY_ROW_HEIGHT - 7;

    g.appendChild(svgText(label, L.MARGIN_LEFT - 12, textY, {
      'text-anchor': 'end', 'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
    }));

    for (let inn = 0; inn < innings; inn++) {
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
        'text-anchor': 'middle', 'font-size': '16', 'font-weight': '600', 'font-family': L.FONT,
        fill: value > 0 ? CLR.text : CLR.textMuted,
      }));
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
        <td class="pitcher-name">${p.name} <span class="hand-indicator">(${hand || '?'})</span>${p.note ? ` <span class="pitcher-note">${p.note}</span>` : ''}</td>
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
      <strong>${info.name}</strong> <span class="hand-indicator">(${info.hand || '?'})</span>
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
      <td class="pitcher-name">${p.name} <span class="hand-indicator">(${bat || '?'})</span></td>
      <td>${p.position}</td>
      <td>${p.avg}</td>
      <td>${p.obp}</td>
      <td>${p.slg}</td>
      <td>${p.hr}</td>
      <td>${p.rbi}</td>
    </tr>`;
  }).join('');

  return `
    <table class="pitcher-stats-table">
      <thead><tr><th>BENCH</th><th>POS</th><th>AVG</th><th>OBP</th><th>SLG</th><th>HR</th><th>RBI</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
      <td class="pitcher-name">${p.name} <span class="hand-indicator">(${hand || '?'})</span></td>
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
    <table class="pitcher-stats-table">
      <thead><tr><th>BULLPEN</th><th>ERA</th><th>W-L</th><th>SV</th><th>HLD</th><th>IP</th><th>K</th><th>WHIP</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
