// Scorecard page: main entry point

// Team logo helper: returns <img> with light/dark source swap via CSS
function teamLogoHTML(teamId, teamName, size = '1.2em') {
  return `<img class="team-logo team-logo-light" src="/img/logos/light/${teamId}.svg" alt="${teamName}" style="height:${size};width:auto;vertical-align:middle;"><img class="team-logo team-logo-dark" src="/img/logos/dark/${teamId}.svg" alt="" style="height:${size};width:auto;vertical-align:middle;">`;
}

import { updateConfig, resetConfig } from './layout-config.js';
import { fetchLiveFeed, fetchStandings, fetchAllTeamStats, fetchCoaches, fetchTeamSeasonStats, fetchPitchArsenals } from './api.js';
import { filterPlaysByDelay, filterLinescoreByDelay, getDelay } from './time-delay.js';
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

const container = document.getElementById('scorecard-container');
const titleEl = document.getElementById('game-title');

const params = new URLSearchParams(window.location.search);
const gamePk = params.get('gamePk');

let gameData = null;
let standingsData = null;
let allTeamStatsData = null;
let cachedCoaches = null;
const cachedTeamSeasonStats = {};

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

    // Apply stream delay: filter plays to only show what happened before (now - delay)
    const delay = getDelay();
    if (delay > 0) {
      gumbo.liveData.plays.allPlays = filterPlaysByDelay(gumbo.liveData.plays.allPlays);
      gumbo.liveData.linescore = filterLinescoreByDelay(gumbo.liveData.linescore, gumbo.liveData.plays.allPlays);
    }

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
    // Fetch pitch arsenals on first load (non-blocking)
    if (isInitialLoad) {
      const boxscore = gumbo.liveData.boxscore;
      const allPitcherIds = [
        ...(boxscore.teams.away.pitchers || []),
        ...(boxscore.teams.away.bullpen || []),
        ...(boxscore.teams.home.pitchers || []),
        ...(boxscore.teams.home.bullpen || []),
      ];
      const uniqueIds = [...new Set(allPitcherIds)];
      fetchPitchArsenals(uniqueIds, season).then(arsenals => {
        gameData._arsenals = arsenals;
        renderGame(gameData, standingsData, allTeamStatsData);
      }).catch(() => {});
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

  // Top row: W-L comparison + linescore side by side on desktop
  const header = renderGameHeaderHTML(data);
  const topRow = document.createElement('div');
  topRow.className = 'game-top-row';
  topRow.innerHTML = renderTeamComparisonHTML(data, standings) + header.linescore;
  _target.appendChild(topRow);

  // Game info row: date, weather, umpires spread across
  const infoRow = document.createElement('div');
  infoRow.innerHTML = header.gameInfo;
  _target.appendChild(infoRow);

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
  // Spring Training / Exhibition use accordions (large rosters); Regular season shows tables directly
  const gameType = data.gameData.game?.type || 'R';
  const useAccordion = gameType === 'S' || gameType === 'E';

  const section = document.createElement('div');
  section.className = 'scorecard-section';

  // Team header row: name + season stats side by side on desktop
  const headerRow = document.createElement('div');
  headerRow.className = 'team-header-row';

  const header = document.createElement('div');
  header.className = 'scorecard-section-header';
  const logo = teamLogoHTML(team.id, team.name, '2.25em');
  header.innerHTML = `<h2>${logo} ${team.name}</h2><span class="team-label">${label}</span>`;
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
      </div>`;

  }

  // Coaching staff — append into the stats grid if it exists, otherwise standalone
  const coachesHTML = renderCoachingStaffHTML(data, side, team.teamName);
  if (coachesHTML) {
    const existingGrid = teamStatsPlaceholder.querySelector('.team-stats-grid');
    if (existingGrid) {
      existingGrid.insertAdjacentHTML('beforeend', coachesHTML);
    } else {
      const coachesDiv = document.createElement('div');
      coachesDiv.className = 'team-stats-grid';
      coachesDiv.innerHTML = coachesHTML;
      section.appendChild(coachesDiv);
    }
  }

  // This team's bench (grouped with coaching staff above)
  const benchHTML = renderBenchHTML(data, side, team.teamName, { useAccordion });
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
  const bullpenHTML = renderBullpenHTML(data, oppSide, oppTeam.teamName, { useAccordion });
  if (bullpenHTML) {
    const bullpenDiv = document.createElement('div');
    bullpenDiv.className = 'pitcher-stats-section';
    bullpenDiv.innerHTML = bullpenHTML;
    section.appendChild(bullpenDiv);
  }

  return section;
}

// Stream delay: nav button triggers reload
window._delayChanged = () => loadGame();

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
