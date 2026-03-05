// SVG scorecard rendering — Bob Carpenter layout, high-contrast, dark mode
// Large cells with full-size diamond, large notation, big batter info

import {
  buildTeamLineup,
  buildScorecardGrid,
  buildSubstitutionMap,
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

// Strike zone constants (not configurable — fixed baseball physics)
const PX_RANGE = 3.0;
const PZ_MIN = 0.5;
const PZ_MAX = 4.5;
const SZ_HALF_PLATE = 0.83;

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

  let totalRows = 0;
  const rowOffsets = [];
  for (const slot of lineup) {
    rowOffsets.push(totalRows);
    totalRows += Math.max(1, slot.players.length);
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

  drawGrid(svg, CLR, lineup, innings, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows);
  drawHeader(svg, CLR, innings, statsWidth);
  drawStatHeaders(svg, CLR, innings);
  drawLineup(svg, CLR, lineup, rowOffsets, boxscore, gameData, side);
  drawAtBats(svg, CLR, lineup, grid, rowOffsets, innings, subMap);
  drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, innings, gridHeight);
  drawSummaryRows(svg, CLR, linescore, side, innings, gridHeight, width, statsWidth);

  return svg;
}

// ─── Per-cell substitution indicators ────────────────────────────

function drawSubIndicator(g, CLR, x, y, subType) {
  if (subType === 'pitcher') {
    // Replace top edge of cell with dashed blue line
    g.appendChild(svgEl('line', {
      x1: x, y1: y,
      x2: x + L.COL_WIDTH, y2: y,
      stroke: CLR.sub, 'stroke-width': 2.5,
      'stroke-dasharray': '8,5',
    }));
  } else if (subType === 'PH') {
    // Replace left edge of cell with solid blue line
    g.appendChild(svgEl('line', {
      x1: x, y1: y,
      x2: x, y2: y + L.ROW_HEIGHT,
      stroke: CLR.sub, 'stroke-width': 2.5,
    }));
  } else if (subType === 'PR') {
    // Replace right edge of cell with solid blue line
    g.appendChild(svgEl('line', {
      x1: x + L.COL_WIDTH, y1: y,
      x2: x + L.COL_WIDTH, y2: y + L.ROW_HEIGHT,
      stroke: CLR.sub, 'stroke-width': 2.5,
    }));
  }
}

// ─── Grid ────────────────────────────────────────────────────────

function drawGrid(svg, CLR, lineup, innings, totalRows, rowOffsets, width, gridHeight, statsWidth, summaryRows) {
  const g = svgEl('g', { class: 'grid-lines' });

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const rows = Math.max(1, lineup[slotIdx].players.length);
    for (let r = 0; r < rows; r++) {
      const y = L.HEADER_HEIGHT + (rowOffsets[slotIdx] + r) * L.ROW_HEIGHT;
      for (let inn = 0; inn < innings; inn++) {
        g.appendChild(svgEl('rect', {
          x: L.MARGIN_LEFT + inn * L.COL_WIDTH + 0.5, y: y + 0.5,
          width: L.COL_WIDTH - 1, height: L.ROW_HEIGHT - 1,
          fill: CLR.cellBg, stroke: 'none',
        }));
      }
    }
  }

  for (let i = 0; i <= totalRows; i++) {
    const y = L.HEADER_HEIGHT + i * L.ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: width, y2: y, stroke: CLR.grid, 'stroke-width': 1.5 }));
  }
  for (let i = 0; i < lineup.length; i++) {
    const y = L.HEADER_HEIGHT + rowOffsets[i] * L.ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: width, y2: y, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  }
  g.appendChild(svgEl('line', { x1: 0, y1: gridHeight, x2: width, y2: gridHeight, stroke: CLR.gridBold, 'stroke-width': 2.5 }));

  for (let i = 1; i <= summaryRows; i++) {
    const y = gridHeight + i * L.SUMMARY_ROW_HEIGHT;
    g.appendChild(svgEl('line', { x1: 0, y1: y, x2: L.MARGIN_LEFT + innings * L.COL_WIDTH, y2: y, stroke: CLR.grid, 'stroke-width': 1 }));
  }

  g.appendChild(svgEl('line', { x1: L.MARGIN_LEFT, y1: 0, x2: L.MARGIN_LEFT, y2: gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT, stroke: CLR.gridBold, 'stroke-width': 2.5 }));
  for (let i = 0; i <= innings; i++) {
    const x = L.MARGIN_LEFT + i * L.COL_WIDTH;
    const bY = (i < innings) ? gridHeight + summaryRows * L.SUMMARY_ROW_HEIGHT : gridHeight;
    g.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: bY, stroke: CLR.grid, 'stroke-width': 1.5 }));
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

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    const baseY = L.HEADER_HEIGHT + rowOffsets[slotIdx] * L.ROW_HEIGHT;
    let subCount = 0;

    for (let pIdx = 0; pIdx < slot.players.length; pIdx++) {
      const player = slot.players[pIdx];
      const y = baseY + pIdx * L.ROW_HEIGHT;
      const playerData = players[`ID${player.id}`];
      const seasonBatting = playerData?.seasonStats?.batting;
      const avg = seasonBatting?.avg || '';
      const obp = seasonBatting?.obp || '';
      const isSub = player.isSubstitute;
      const nameColor = isSub ? CLR.sub : CLR.text;
      const nameWeight = isSub ? '600' : '800';

      if (!isSub) {
        g.appendChild(svgText(String(slot.slot), 12, y + L.ROW_HEIGHT / 2 - 10, {
          'font-size': '22', 'font-weight': '800', 'font-family': L.FONT, fill: CLR.text,
        }));
      } else {
        subCount++;
        const circleX = 16;
        const circleY = y + L.ROW_HEIGHT / 2 - 14;
        g.appendChild(svgEl('circle', {
          cx: circleX, cy: circleY, r: 10,
          fill: 'none', stroke: CLR.sub, 'stroke-width': 1.5,
        }));
        g.appendChild(svgText(String(subCount), circleX, circleY, {
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.sub,
        }));
      }

      const textX = isSub ? 46 : 38;
      const nameParts = player.name.split(' ');
      const lastName = (nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]).toUpperCase();
      const posNum = POS_ABBREV[player.position];
      const posStr = posNum !== undefined ? String(posNum) : player.position;
      const batSide = getPlayerBatSide(gameData, player.id);
      const label = `${lastName}-${posStr} (${batSide || '?'})`;

      g.appendChild(svgText(label, textX, y + L.ROW_HEIGHT / 2 - 14, {
        'font-size': '17', 'font-weight': nameWeight, 'font-family': L.MONO, fill: nameColor,
      }));

      if (player.jerseyNumber) {
        g.appendChild(svgText(`#${player.jerseyNumber}`, textX, y + L.ROW_HEIGHT / 2 + 4, {
          'font-size': '16', 'font-weight': '600', 'font-family': L.MONO, fill: CLR.textMuted,
        }));
      }

      const statX = L.MARGIN_LEFT - 8;
      if (avg) {
        g.appendChild(svgText(avg, statX, y + L.ROW_HEIGHT / 2 - 14, {
          'text-anchor': 'end', 'font-size': '16', 'font-family': L.MONO, fill: CLR.textLight,
        }));
      }
      if (obp) {
        g.appendChild(svgText(obp, statX, y + L.ROW_HEIGHT / 2 + 4, {
          'text-anchor': 'end', 'font-size': '16', 'font-family': L.MONO, fill: CLR.textMuted,
        }));
      }

      if (isSub) {
        g.appendChild(svgEl('line', {
          x1: 4, y1: y + 1, x2: L.MARGIN_LEFT - 4, y2: y + 1,
          stroke: CLR.sub, 'stroke-width': 2,
        }));
      }
    }
  }

  svg.appendChild(g);
}

// ─── At-bat cells ────────────────────────────────────────────────

function drawAtBats(svg, CLR, lineup, grid, rowOffsets, innings, subMap) {
  const g = svgEl('g', { class: 'at-bats' });

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    for (let inn = 1; inn <= innings; inn++) {
      const key = `${slot.slot}-${inn}`;
      const atBats = grid.get(key);
      if (!atBats || atBats.length === 0) continue;

      for (const ab of atBats) {
        const playerIdx = slot.players.findIndex(p => p.id === ab.batterId);
        const subRow = playerIdx >= 0 ? playerIdx : 0;
        const y = L.HEADER_HEIGHT + (rowOffsets[slotIdx] + subRow) * L.ROW_HEIGHT;
        const x = L.MARGIN_LEFT + (inn - 1) * L.COL_WIDTH;
        drawAtBatCell(g, CLR, ab, x, y);

        const sub = subMap.get(key);
        if (sub) {
          drawSubIndicator(g, CLR, x, y, sub.type);
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

  drawDiamond(g, CLR, diamondCx, diamondCy, ab, isHR);

  const notation = ab.notation;
  if (notation) {
    const notationColor = isHR ? CLR.cellBg : CLR.text;
    const len = notation.length;
    const notFontSize = len <= 2 ? '28' : len <= 4 ? '24' : len <= 6 ? '20' : '16';

    g.appendChild(svgText(notation, diamondCx, diamondCy, {
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': notFontSize, 'font-weight': '900',
      'font-family': L.MONO, fill: notationColor,
    }));
  }

  drawRunnerAnnotations(g, CLR, x, y, ab, diamondCx, diamondCy);
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

// ─── Vertical pitch sequence ─────────────────────────────────────

function drawPitchSequence(g, CLR, pitches, cellX, cellY) {
  if (pitches.length === 0) return;

  const maxRows = Math.floor((L.ROW_HEIGHT - L.SZ_HEIGHT - 16) / L.PITCH_STEP);
  const useTwoCols = pitches.length > maxRows;

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const color = pitchColor(pitch.callCode, CLR);
    const label = pitch.typeCode || pitch.callCode;

    let px, py;
    if (useTwoCols) {
      const colLen = Math.ceil(pitches.length / 2);
      const col = i < colLen ? 0 : 1;
      const row = col === 0 ? i : i - colLen;
      px = cellX + 3 + col * 30;
      py = cellY + L.PITCH_START_Y + row * L.PITCH_STEP;
    } else {
      px = cellX + 3;
      py = cellY + L.PITCH_START_Y + i * L.PITCH_STEP;
    }

    g.appendChild(svgText(label, px, py + L.PITCH_FONT_SIZE, {
      'font-size': String(L.PITCH_FONT_SIZE), 'font-weight': '700', 'font-family': L.MONO, fill: color,
    }));
  }
}

// ─── Mini strike zone ────────────────────────────────────────────

function drawMiniStrikeZone(g, CLR, pitches, cellX, cellY) {
  if (pitches.length === 0) return;

  const zoneX = cellX + 18;
  const zoneY = cellY + L.ROW_HEIGHT - L.SZ_HEIGHT - 8;

  const szLeft = mapPX(-SZ_HALF_PLATE, zoneX);
  const szRight = mapPX(SZ_HALF_PLATE, zoneX);
  const avgTop = averageZoneEdge(pitches, 'szTop', 3.4);
  const avgBot = averageZoneEdge(pitches, 'szBot', 1.6);
  const szTopY = mapPZ(avgTop, zoneY);
  const szBotY = mapPZ(avgBot, zoneY);

  g.appendChild(svgEl('rect', {
    x: szLeft, y: szTopY,
    width: szRight - szLeft, height: szBotY - szTopY,
    fill: 'none', stroke: CLR.grid, 'stroke-width': 0.75,
  }));

  for (const pitch of pitches) {
    if (pitch.pX === null || pitch.pZ === null) continue;
    const dotX = mapPX(pitch.pX, zoneX);
    const dotY = mapPZ(pitch.pZ, zoneY);
    const color = pitchColor(pitch.callCode, CLR);

    g.appendChild(svgEl('rect', {
      x: dotX - 1.5, y: dotY - 1.5, width: 3, height: 3,
      fill: color,
    }));
  }
}

function mapPX(pX, zoneX) {
  return zoneX + ((pX + PX_RANGE / 2) / PX_RANGE) * L.SZ_WIDTH;
}

function mapPZ(pZ, zoneY) {
  return zoneY + (1 - (pZ - PZ_MIN) / (PZ_MAX - PZ_MIN)) * L.SZ_HEIGHT;
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

  const segments = computeBasePathSegments(ab, CLR);
  for (const seg of segments) {
    const from = baseCoords(cx, cy, seg.from);
    const to = baseCoords(cx, cy, seg.to);
    g.appendChild(svgEl('line', {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: seg.color, 'stroke-width': 5, 'stroke-linecap': 'round',
    }));
  }

  const reachedBases = getReachedBases(ab, CLR);
  for (const base of reachedBases) {
    const pos = baseCoords(cx, cy, base.base);
    g.appendChild(svgEl('circle', { cx: pos.x, cy: pos.y, r: 6, fill: base.color }));
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
  const anns = [];
  for (const runner of ab.runners) {
    if (!runner.start || !runner.end || runner.end === runner.start) continue;
    anns.push({
      text: `${baseLabelShort(runner.start)}-${baseLabelShort(runner.end)}`,
      color: CLR.text,
      start: runner.start,
      end: runner.end,
    });
  }
  if (anns.length === 0) return;

  const R = L.DIAMOND_R;
  const offset = R + 18;
  for (const ann of anns) {
    const startBase = ann.start || 'HP';
    let ax, ay, anchor;
    if (startBase === 'HP') {
      ax = diamondCx + offset * 0.7;
      ay = diamondCy + offset * 0.3;
      anchor = 'start';
    } else if (startBase === '1B') {
      ax = diamondCx + offset * 0.7;
      ay = diamondCy - offset * 0.3;
      anchor = 'start';
    } else if (startBase === '2B') {
      ax = diamondCx - offset * 0.7;
      ay = diamondCy - offset * 0.3;
      anchor = 'end';
    } else {
      ax = diamondCx - offset * 0.7;
      ay = diamondCy + offset * 0.3;
      anchor = 'end';
    }
    g.appendChild(svgText(ann.text, ax, ay, {
      'text-anchor': anchor, 'font-size': '16', 'font-weight': '800', 'font-family': L.MONO, fill: ann.color,
    }));
  }
}

function baseLabelShort(base) {
  if (!base) return '?';
  if (base === 'score') return 'H';
  return { '1B': '1', '2B': '2', '3B': '3' }[base] || base;
}

// ─── Batter stats ────────────────────────────────────────────────

function drawBatterStats(svg, CLR, lineup, rowOffsets, batterStats, innings, gridHeight) {
  const g = svgEl('g', { class: 'batter-stats' });
  const baseX = L.MARGIN_LEFT + innings * L.COL_WIDTH;
  const totals = [0, 0, 0, 0];

  for (let slotIdx = 0; slotIdx < lineup.length; slotIdx++) {
    const slot = lineup[slotIdx];
    for (let pIdx = 0; pIdx < slot.players.length; pIdx++) {
      const stats = batterStats.get(slot.players[pIdx].id);
      if (!stats) continue;
      const y = L.HEADER_HEIGHT + (rowOffsets[slotIdx] + pIdx) * L.ROW_HEIGHT;
      const textY = y + L.ROW_HEIGHT / 2 + 6;
      const values = [stats.ab, stats.r, stats.h, stats.rbi];
      for (let i = 0; i < values.length; i++) {
        totals[i] += values[i] || 0;
        g.appendChild(svgText(String(values[i]), baseX + i * L.STATS_COL_WIDTH + L.STATS_COL_WIDTH / 2, textY, {
          'text-anchor': 'middle', 'font-size': '16', 'font-weight': '700', 'font-family': L.FONT, fill: CLR.text,
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

  return `
    <table class="linescore-table">
      <thead><tr><th></th>${innings.map((_, i) => `<th>${i + 1}</th>`).join('')}<th class="rhe">R</th><th class="rhe">H</th><th class="rhe">E</th></tr></thead>
      <tbody>
        <tr><td class="team-name">${gd.teams.away.abbreviation}</td>${innings.map(inn => `<td>${inn.away.runs ?? ''}</td>`).join('')}<td class="rhe"><strong>${ls.teams.away.runs}</strong></td><td class="rhe">${ls.teams.away.hits}</td><td class="rhe">${ls.teams.away.errors}</td></tr>
        <tr><td class="team-name">${gd.teams.home.abbreviation}</td>${innings.map(inn => `<td>${inn.home.runs ?? ''}</td>`).join('')}<td class="rhe"><strong>${ls.teams.home.runs}</strong></td><td class="rhe">${ls.teams.home.hits}</td><td class="rhe">${ls.teams.home.errors}</td></tr>
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
