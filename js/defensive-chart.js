// Defensive position chart — inverted V field view
// Foul lines from top corners of rectangle down to HP. Diamond + mound circle.
// Coach box lines near bottom of rect. Coach names below rect.

import { getDefenseWithSubs, extractBaseCoaches, computeTeamRank } from './game-data.js';
import { svgEl, svgText } from './svg-renderer.js';
import { getConfig } from './layout-config.js';

const MONO = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace';

/**
 * Compute all derived geometry from config values.
 */
function computeGeometry() {
  const c = getConfig();
  const W = c.DC_W;
  const H = c.DC_H;
  const HEADER_H = c.DC_HEADER_H;
  const COACH_H = c.DC_COACH_H;
  const DX = c.DC_DX;
  const DY = c.DC_DY;
  const CIRCLE_R = c.DC_CIRCLE_R;
  const HP_RATIO = c.DC_HP_Y;

  const CX = W / 2;

  // Home plate — convergence point of foul lines
  const HP = { x: CX, y: H * HP_RATIO };

  // Diamond vertices
  const B1 = { x: CX + DX, y: HP.y - DY };
  const B2 = { x: CX, y: HP.y - DY * 2 };
  const B3 = { x: CX - DX, y: HP.y - DY };

  // Mound — center of diamond
  const MOUND = { x: CX, y: Math.round((HP.y + B2.y) / 2) };

  // Player label positions (read multipliers from config)
  const POS = {
    LF:   { x: CX * c.DC_POS_LF_X, y: H * c.DC_POS_LF_Y },
    CF:   { x: CX * c.DC_POS_CF_X, y: H * c.DC_POS_CF_Y },
    RF:   { x: CX * c.DC_POS_RF_X, y: H * c.DC_POS_RF_Y },
    SS:   { x: CX * c.DC_POS_SS_X, y: H * c.DC_POS_SS_Y },
    '2B': { x: CX * c.DC_POS_2B_X, y: H * c.DC_POS_2B_Y },
    '3B': { x: CX * c.DC_POS_3B_X, y: H * c.DC_POS_3B_Y },
    '1B': { x: CX * c.DC_POS_1B_X, y: H * c.DC_POS_1B_Y },
    C:    { x: CX * c.DC_POS_C_X,  y: H * c.DC_POS_C_Y },
  };

  return {
    W, H, HEADER_H, COACH_H, CX, DX, DY, CIRCLE_R, HP_RATIO,
    HP, B1, B2, B3, MOUND, POS,
  };
}

/**
 * Render a defensive position chart for one team.
 * Returns a container <div> with the SVG inside.
 */
export function renderDefensiveChart(data, side, allTeamStats, offensiveCoachData) {
  const G = computeGeometry();
  const boxscore = data.liveData.boxscore;
  const teamData = data.gameData.teams[side];
  const teamId = String(teamData.id);
  const defense = getDefenseWithSubs(boxscore, side);
  const coaches = offensiveCoachData ? extractBaseCoaches(offensiveCoachData) : {};

  const teamStats = allTeamStats?.[teamId];
  const dpCount  = teamStats?.doublePlays ?? '\u2014';
  const eCount   = teamStats?.errors ?? '\u2014';
  const fldPct   = teamStats?.fielding ?? '\u2014';
  const teamEra  = teamStats?.era ?? '\u2014';
  const dpRank   = allTeamStats ? computeTeamRank(teamId, 'doublePlays', allTeamStats, false) : 0;
  const eRank    = allTeamStats ? computeTeamRank(teamId, 'errors', allTeamStats, true) : 0;
  const fldRank  = allTeamStats ? computeTeamRank(teamId, 'fielding', allTeamStats, false) : 0;
  const eraRank  = allTeamStats ? computeTeamRank(teamId, 'era', allTeamStats, true) : 0;

  const totalH = G.HEADER_H + G.H + G.COACH_H;
  const container = document.createElement('div');
  container.className = 'defensive-chart-container';

  const svg = svgEl('svg', {
    viewBox: `0 0 ${G.W} ${totalH}`,
    width: '100%',
    class: 'defensive-chart-svg',
    role: 'img',
    'aria-label': `${teamData.name} defensive alignment`,
  });

  // ── Stats header ABOVE the rectangle ────────────────────────
  svg.appendChild(svgText(`${dpCount} DP / #${dpRank}`, 18, G.HEADER_H - 10, {
    'font-size': '16', 'font-weight': '700', 'font-family': MONO, fill: 'currentColor',
  }));
  svg.appendChild(svgText(`${fldPct} DEF / #${fldRank}`, G.W / 2, G.HEADER_H - 10, {
    'text-anchor': 'middle', 'font-size': '16', 'font-weight': '700', 'font-family': MONO, fill: 'currentColor',
  }));
  svg.appendChild(svgText(`${eCount} E / #${eRank}`, G.W - 18, G.HEADER_H - 10, {
    'text-anchor': 'end', 'font-size': '16', 'font-weight': '700', 'font-family': MONO, fill: 'currentColor',
  }));

  // ── Field area (translated below header) ────────────────────
  const g = svgEl('g', { transform: `translate(0, ${G.HEADER_H})` });

  // Rectangle border — thick, slightly rounded corners
  g.appendChild(svgEl('rect', {
    x: 0, y: 0, width: G.W, height: G.H, rx: 4,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
  }));

  // Foul lines — from TOP CORNERS down to HP (inverted V)
  g.appendChild(svgEl('line', {
    x1: 0, y1: 0, x2: G.HP.x, y2: G.HP.y,
    stroke: 'currentColor', 'stroke-width': 2,
  }));
  g.appendChild(svgEl('line', {
    x1: G.W, y1: 0, x2: G.HP.x, y2: G.HP.y,
    stroke: 'currentColor', 'stroke-width': 2,
  }));

  // Full diamond — all 4 basepaths as a polygon
  const diamondPts = `${G.HP.x},${G.HP.y} ${G.B1.x},${G.B1.y} ${G.B2.x},${G.B2.y} ${G.B3.x},${G.B3.y}`;
  g.appendChild(svgEl('polygon', {
    points: diamondPts,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
  }));

  // Large mound circle with ERA
  g.appendChild(svgEl('circle', {
    cx: G.MOUND.x, cy: G.MOUND.y, r: G.CIRCLE_R,
    fill: 'var(--card-bg, #fff)', stroke: 'currentColor', 'stroke-width': 2,
  }));
  g.appendChild(svgText(String(teamEra), G.MOUND.x, G.MOUND.y - 4, {
    'text-anchor': 'middle', 'font-size': '22', 'font-weight': '800', 'font-family': MONO, fill: 'currentColor',
  }));
  g.appendChild(svgText(`#${eraRank}`, G.MOUND.x, G.MOUND.y + 18, {
    'text-anchor': 'middle', 'font-size': '16', 'font-weight': '400', 'font-family': MONO, fill: 'currentColor',
  }));

  // Coach box lines inside rect (near bottom, left and right)
  const coachLineY = G.H * 0.82;
  const coachLineW = G.W * 0.16;
  g.appendChild(svgEl('line', {
    x1: G.W * 0.08, y1: coachLineY, x2: G.W * 0.08 + coachLineW, y2: coachLineY,
    stroke: 'currentColor', 'stroke-width': 2,
  }));
  g.appendChild(svgEl('line', {
    x1: G.W - G.W * 0.08 - coachLineW, y1: coachLineY, x2: G.W - G.W * 0.08, y2: coachLineY,
    stroke: 'currentColor', 'stroke-width': 2,
  }));

  // ── Player labels — single-line "NAME #N" with sub stacking ─
  const STACK_STEP = 24;

  for (const [pos, coords] of Object.entries(G.POS)) {
    const posData = defense[pos];
    if (!posData) continue;

    const replaced = posData.replaced || [];

    // Replaced players stacked ABOVE active, single line with strikethrough
    for (let i = 0; i < replaced.length; i++) {
      const rp = replaced[i];
      const ry = coords.y - (replaced.length - i) * STACK_STEP;
      const label = `${rp.name} #${rp.jerseyNumber}`;

      g.appendChild(svgText(label, coords.x, ry, {
        'text-anchor': 'middle', 'font-size': '16', 'font-weight': '400', 'font-family': MONO,
        fill: 'var(--text-secondary, #888)',
      }));

      // Strikethrough line
      const textW = label.length * 9.6;
      g.appendChild(svgEl('line', {
        x1: coords.x - textW / 2, y1: ry - 4,
        x2: coords.x + textW / 2, y2: ry - 4,
        stroke: 'var(--text-secondary, #888)', 'stroke-width': 1,
      }));
    }

    // Active player — single line, bold
    const active = posData.active;
    g.appendChild(svgText(`${active.name} #${active.jerseyNumber}`, coords.x, coords.y, {
      'text-anchor': 'middle', 'font-size': '16', 'font-weight': '700', 'font-family': MONO,
      fill: 'currentColor',
    }));
  }

  svg.appendChild(g);

  // ── Coaches BELOW the rectangle — name + thick underline ────
  const cg = svgEl('g', { transform: `translate(0, ${G.HEADER_H + G.H})` });

  if (coaches.thirdBase) {
    const lastName = coaches.thirdBase.split(' ').slice(-1)[0].toUpperCase();
    cg.appendChild(svgText(lastName, 18, 28, {
      'text-anchor': 'start', 'font-size': '16', 'font-weight': '700', 'font-family': MONO,
      fill: 'currentColor',
    }));
    const textW = lastName.length * 9.6;
    cg.appendChild(svgEl('line', {
      x1: 18, y1: 34,
      x2: 18 + textW, y2: 34,
      stroke: 'currentColor', 'stroke-width': 2,
    }));
  }

  if (coaches.firstBase) {
    const lastName = coaches.firstBase.split(' ').slice(-1)[0].toUpperCase();
    cg.appendChild(svgText(lastName, G.W - 18, 28, {
      'text-anchor': 'end', 'font-size': '16', 'font-weight': '700', 'font-family': MONO,
      fill: 'currentColor',
    }));
    const textW = lastName.length * 9.6;
    cg.appendChild(svgEl('line', {
      x1: G.W - 18 - textW, y1: 34,
      x2: G.W - 18, y2: 34,
      stroke: 'currentColor', 'stroke-width': 2,
    }));
  }

  svg.appendChild(cg);
  container.appendChild(svg);
  return container;
}
