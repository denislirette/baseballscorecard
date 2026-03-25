// Scorecard page: main entry point

// MLB team primary colors with accessible text
const MLB_TEAM_COLORS = {
  ARI: { bg: '#A71930', text: '#fff' }, ATL: { bg: '#CE1141', text: '#fff' },
  BAL: { bg: '#DF4601', text: '#000' }, BOS: { bg: '#BD3039', text: '#fff' },
  CHC: { bg: '#0E3386', text: '#fff' }, CWS: { bg: '#27251F', text: '#fff' },
  CIN: { bg: '#C6011F', text: '#fff' }, CLE: { bg: '#00385D', text: '#fff' },
  COL: { bg: '#33006F', text: '#fff' }, DET: { bg: '#0C2340', text: '#fff' },
  HOU: { bg: '#002D62', text: '#fff' }, KC:  { bg: '#004687', text: '#fff' },
  LAA: { bg: '#BA0021', text: '#fff' }, LAD: { bg: '#005A9C', text: '#fff' },
  MIA: { bg: '#00A3E0', text: '#000' }, MIL: { bg: '#FFC52F', text: '#000' },
  MIN: { bg: '#002B5C', text: '#fff' }, NYM: { bg: '#002D72', text: '#fff' },
  NYY: { bg: '#003087', text: '#fff' }, OAK: { bg: '#003831', text: '#fff' },
  PHI: { bg: '#E81828', text: '#fff' }, PIT: { bg: '#27251F', text: '#fff' },
  SD:  { bg: '#2F241D', text: '#fff' }, SF:  { bg: '#FD5A1E', text: '#000' },
  SEA: { bg: '#0C2C56', text: '#fff' }, STL: { bg: '#C41E3A', text: '#fff' },
  TB:  { bg: '#092C5C', text: '#fff' }, TEX: { bg: '#003278', text: '#fff' },
  TOR: { bg: '#134A8E', text: '#fff' }, WSH: { bg: '#AB0003', text: '#fff' },
};

import { updateConfig, resetConfig } from './layout-config.js';
import { fetchLiveFeed, fetchStandings, fetchAllTeamStats, fetchCoaches, fetchTeamSeasonStats } from './api.js';
import { buildTeamLineup, computeLineupTrends, computeTeamRank } from './game-data.js';
import {
  renderTeamScorecard,
  renderPitcherStatsHTML,
  renderGameHeaderHTML,
  renderTeamComparisonHTML,
  renderBenchHTML,
  renderBullpenHTML,
  renderCoachingStaffHTML,
} from './svg-renderer.js';
import { renderRefreshControls } from './refresh.js';

const container = document.getElementById('scorecard-container');
const titleEl = document.getElementById('game-title');

const params = new URLSearchParams(window.location.search);
const gamePk = params.get('gamePk');

let gameData = null;
let standingsData = null;
let allTeamStatsData = null;
let cachedCoaches = null;
let cachedTeamSeasonStats = {};

let isInitialLoad = true;

async function loadGame() {
  if (!gamePk) {
    container.innerHTML = '<p class="error">No game specified.</p>';
    return;
  }

  // Only show progress bar on initial load (not auto-refresh)
  if (isInitialLoad) window.showProgress?.();

  try {
    // Phase 1: Fetch GUMBO feed
    const gumbo = await fetchLiveFeed(gamePk);
    gameData = gumbo;

    const officialDate = gumbo.gameData?.datetime?.officialDate || '';
    const season = officialDate ? parseInt(officialDate.split('-')[0], 10) : new Date().getFullYear();

    if (isInitialLoad) {
      // First load: fetch standings, coaches, team stats in parallel
      const awayId = gumbo.gameData?.teams?.away?.id;
      const homeId = gumbo.gameData?.teams?.home?.id;
      const [standings, allTeamStats, awayCoaches, homeCoaches, awaySeasonStats, homeSeasonStats] = await Promise.all([
        fetchStandings(season).catch(() => null),
        fetchAllTeamStats(season).catch(() => null),
        awayId ? fetchCoaches(awayId) : null,
        homeId ? fetchCoaches(homeId) : null,
        awayId ? fetchTeamSeasonStats(awayId, season).catch(() => ({})) : {},
        homeId ? fetchTeamSeasonStats(homeId, season).catch(() => ({})) : {},
      ]);
      standingsData = standings;
      allTeamStatsData = allTeamStats;
      cachedCoaches = { away: awayCoaches, home: homeCoaches };
      if (awayId) cachedTeamSeasonStats[awayId] = awaySeasonStats;
      if (homeId) cachedTeamSeasonStats[homeId] = homeSeasonStats;
    }
    // Always apply cached data to fresh gumbo object
    gameData._coaches = cachedCoaches || {};

    // Preserve scroll position during auto-refresh
    const scrollY = isInitialLoad ? 0 : window.scrollY;

    renderGame(gameData, standingsData, allTeamStatsData);

    // Restore scroll position after DOM swap
    if (!isInitialLoad) {
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }

    if (isInitialLoad) {
      // Async trend computation, re-renders when done
      const boxscore = gumbo.liveData.boxscore;
      const awayLineup = buildTeamLineup(boxscore, 'away');
      const homeLineup = buildTeamLineup(boxscore, 'home');
      Promise.all([
        computeLineupTrends(awayLineup, officialDate, season).catch(() => {}),
        computeLineupTrends(homeLineup, officialDate, season).catch(() => {}),
      ]).then(() => {
        if (!gameData._trends) gameData._trends = {};
        gameData._trends.away = awayLineup;
        gameData._trends.home = homeLineup;
        renderGame(gameData, standingsData, allTeamStatsData);
      });
    }

    if (isInitialLoad) window.hideProgress?.();
    isInitialLoad = false;
  } catch (err) {
    container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = `Failed to load game: ${err.message}`;
    container.appendChild(p);
    console.error(err);
    window.hideProgress?.();
  }
}

function renderGame(data, standings, allTeamStats) {
  const gd = data.gameData;
  const away = gd.teams.away;
  const home = gd.teams.home;

  // Update page title
  titleEl.textContent = `${away.abbreviation} @ ${home.abbreviation}`;
  document.title = `${away.abbreviation} @ ${home.abbreviation} - Scorecard`;

  // Build new content offscreen to prevent flash on auto-refresh
  const _target = document.createElement('div');

  // Pitch legend removed; see Legend overlay for full reference

  // Team comparison table
  const comparisonSection = document.createElement('div');
  comparisonSection.innerHTML = renderTeamComparisonHTML(data, standings);
  _target.appendChild(comparisonSection);

  // Game header with linescore, game info, umpires
  const headerSection = document.createElement('div');
  headerSection.innerHTML = renderGameHeaderHTML(data);
  _target.appendChild(headerSection);

  // Render both team sections
  _target.appendChild(renderTeamSection(data, 'away', allTeamStats));
  _target.appendChild(renderTeamSection(data, 'home', allTeamStats));

  // Swap content in one operation to prevent flash
  container.replaceChildren(..._target.childNodes);

  // Restore and persist <details> open/closed state
  restoreDetailsState();

}

function renderTeamSection(data, side, allTeamStats) {
  const team = data.gameData.teams[side];
  const oppSide = side === 'away' ? 'home' : 'away';
  const oppTeam = data.gameData.teams[oppSide];
  const label = side === 'away' ? 'Away' : 'Home';

  const section = document.createElement('div');
  section.className = 'scorecard-section';

  // Team header row: name + season stats side by side on desktop
  const headerRow = document.createElement('div');
  headerRow.className = 'team-header-row';

  const header = document.createElement('div');
  header.className = 'scorecard-section-header';
  const abbr = team.abbreviation || '';
  const colors = MLB_TEAM_COLORS[abbr];
  if (colors) {
    header.innerHTML = `<h2><span class="team-name-color" style="background:${colors.bg};color:${colors.text};padding:4px 12px;">${team.name}</span></h2><span class="team-label">${label}</span>`;
  } else {
    header.innerHTML = `<h2>${team.name}</h2><span class="team-label">${label}</span>`;
  }
  headerRow.appendChild(header);

  const teamStatsPlaceholder = document.createElement('div');
  teamStatsPlaceholder.className = 'team-season-stats';
  headerRow.appendChild(teamStatsPlaceholder);

  section.appendChild(headerRow);
  const season = parseInt(data.gameData.game?.season || new Date().getFullYear());
  // Use cached team season stats (fetched on initial load) for synchronous rendering
  const stats = cachedTeamSeasonStats[team.id];
  if (stats?.batting && stats?.pitching) {
    const b = stats.batting;
    const p = stats.pitching;
    const f = stats.fielding;
    const yr = stats.season || season;

    // wOBA calculation using 2025 FanGraphs linear weights (keep in sync with WOBA_WEIGHTS in svg-renderer.js)
    const W = { bb: 0.691, hbp: 0.722, s1b: 0.882, s2b: 1.252, s3b: 1.584, hr: 2.037 };
    const ubb = (b.baseOnBalls ?? 0) - (b.intentionalWalks ?? 0);
    const hbp = b.hitByPitch ?? 0;
    const singles = (b.hits ?? 0) - (b.doubles ?? 0) - (b.triples ?? 0) - (b.homeRuns ?? 0);
    const wobaDenom = (b.atBats ?? 0) + ubb + (b.intentionalWalks ?? 0) + (b.sacFlies ?? 0) + hbp;
    const woba = wobaDenom > 0 ? (W.bb * ubb + W.hbp * hbp + W.s1b * singles + W.s2b * (b.doubles ?? 0) + W.s3b * (b.triples ?? 0) + W.hr * (b.homeRuns ?? 0)) / wobaDenom : 0;

    // wRC+ calculation
    const lgwOBA = 0.313;
    const wOBAScale = 1.232;
    const lgRPA = 0.118;
    const pa = b.plateAppearances ?? 0;
    const wrcPlus = pa > 0 ? Math.round((((woba - lgwOBA) / wOBAScale + lgRPA) / lgRPA) * 100) : '-';

    const rs = b.runs ?? 0;
    const ra = p.runs ?? 0;
    const seasonLabel = yr !== season ? `${yr} Season` : 'Season';

    // Compute rankings if allTeamStats available
    const ordinal = (n) => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const rankHtml = (statKey, lowerIsBetter) => {
      if (!allTeamStats) return '';
      const r = computeTeamRank(team.id, statKey, allTeamStats, lowerIsBetter);
      return r ? `<span class="team-rank">${ordinal(r)}</span>` : '';
    };

    teamStatsPlaceholder.innerHTML = `
      <div class="team-stats-grid">
        <table class="team-season-table">
          <thead><tr><th>AVG</th><th>OPS</th><th>wOBA</th><th>wRC+</th><th>HR</th><th>SB</th><th>RS</th></tr></thead>
          <tbody><tr>
            <td>${b.avg ?? '-'}${rankHtml('avg', false)}</td>
            <td>${b.ops ?? '-'}${rankHtml('ops', false)}</td>
            <td>${woba.toFixed(3)}</td>
            <td>${wrcPlus}</td>
            <td>${b.homeRuns ?? 0}${rankHtml('homeRuns', false)}</td>
            <td>${b.stolenBases ?? 0}${rankHtml('stolenBases', false)}</td>
            <td>${rs}${rankHtml('runs', false)}</td>
          </tr></tbody>
        </table>
        <table class="team-season-table">
          <thead><tr><th>ERA</th><th>RA</th><th>FLD%</th><th>DP</th><th>E</th><th>CS</th></tr></thead>
          <tbody><tr>
            <td>${p.era ?? '-'}${rankHtml('era', true)}</td>
            <td>${ra}${rankHtml('runsAllowed', true)}</td>
            <td>${f?.fielding ?? '-'}${rankHtml('fielding', false)}</td>
            <td>${f?.doublePlays ?? '-'}${rankHtml('doublePlays', false)}</td>
            <td>${f?.errors ?? '-'}${rankHtml('errors', true)}</td>
            <td>${b.caughtStealing ?? 0}</td>
          </tr></tbody>
        </table>
      </div>
      <div class="team-season-caption">${seasonLabel} Stats</div>`;
  }

  // Coaching staff — aligned with stat tables
  const coachesHTML = renderCoachingStaffHTML(data, side, team.teamName);
  if (coachesHTML) {
    const coachesDiv = document.createElement('div');
    coachesDiv.className = 'team-stats-grid';
    coachesDiv.innerHTML = coachesHTML;
    section.appendChild(coachesDiv);
  }

  // This team's bench (grouped with coaching staff above)
  const benchHTML = renderBenchHTML(data, side, team.teamName);
  if (benchHTML) {
    const benchDiv = document.createElement('div');
    benchDiv.className = 'pitcher-stats-section';
    benchDiv.innerHTML = benchHTML;
    section.appendChild(benchDiv);
  }

  // Scorecard grid (this team's batting)
  const scroll = document.createElement('div');
  scroll.className = 'scorecard-scroll';
  scroll.appendChild(renderTeamScorecard(data, side));
  section.appendChild(scroll);

  // Opposing pitcher game stats
  const pitchersDiv = document.createElement('div');
  pitchersDiv.className = 'pitcher-stats-section';
  pitchersDiv.innerHTML = renderPitcherStatsHTML(data, oppSide, oppTeam.teamName);
  section.appendChild(pitchersDiv);

  // Opposing bullpen
  const bullpenHTML = renderBullpenHTML(data, oppSide, oppTeam.teamName);
  if (bullpenHTML) {
    const bullpenDiv = document.createElement('div');
    bullpenDiv.className = 'pitcher-stats-section';
    bullpenDiv.innerHTML = bullpenHTML;
    section.appendChild(bullpenDiv);
  }

  return section;
}

// Setup refresh controls
renderRefreshControls(loadGame, () => gameData?.gameData?.status?.abstractGameState);

// Listen for style editor messages (when embedded in iframe)
function rerender() {
  if (gameData) renderGame(gameData, standingsData, allTeamStatsData);
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'layout-update') {
    updateConfig(msg.constants);
    rerender();
  } else if (msg.type === 'rerender') {
    rerender();
  } else if (msg.type === 'set-theme') {
    if (msg.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    rerender();
  } else if (msg.type === 'reset-layout') {
    resetConfig();
    rerender();
  }
});

// Persist <details> open/closed state per game
function getGameDetailsKey() {
  const params = new URLSearchParams(window.location.search);
  const gamePk = params.get('gamePk') || 'unknown';
  return `detailsState-${gamePk}`;
}

function getDetailsState() {
  try { return JSON.parse(localStorage.getItem(getGameDetailsKey())) || {}; } catch { return {}; }
}

function restoreDetailsState() {
  const state = getDetailsState();
  for (const el of document.querySelectorAll('details[data-section]')) {
    const key = el.dataset.section;
    if (state[key]) el.open = true;
    el.addEventListener('toggle', () => {
      const s = getDetailsState();
      if (el.open) s[key] = true; else delete s[key];
      localStorage.setItem(getGameDetailsKey(), JSON.stringify(s));
    });
    // Arrow keys open/close accordions
    el.querySelector('summary').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && !el.open) { el.open = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft' && el.open) { el.open = false; e.preventDefault(); }
    });
  }
}

// Clean up old global details state
localStorage.removeItem('detailsState');

// Initial load
loadGame().then(() => {
  // Signal to parent (styles editor) that we're ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
  }
});
