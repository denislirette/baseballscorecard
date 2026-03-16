// Scorecard page: main entry point

import { updateConfig, resetConfig } from './layout-config.js';
import { fetchLiveFeed, fetchStandings, fetchAllTeamStats } from './api.js';
import { buildTeamLineup, computeLineupTrends } from './game-data.js';
import {
  renderTeamScorecard,
  renderPitcherStatsHTML,
  renderGameHeaderHTML,
  renderTeamComparisonHTML,
  renderBenchHTML,
  renderBullpenHTML,
} from './svg-renderer.js';
// standings now rendered on its own page
import { renderRefreshControls } from './refresh.js';

const container = document.getElementById('scorecard-container');
const titleEl = document.getElementById('game-title');

const params = new URLSearchParams(window.location.search);
const gamePk = params.get('gamePk');

let gameData = null;
let standingsData = null;
let allTeamStatsData = null;

async function loadGame() {
  if (!gamePk) {
    container.innerHTML = '<p class="error">No game specified.</p>';
    return;
  }

  window.showProgress?.();

  try {
    // Phase 1: Fetch GUMBO first to get the game season
    const gumbo = await fetchLiveFeed(gamePk);
    gameData = gumbo;

    // Derive season from game data (not current year; fixtures may differ)
    const officialDate = gumbo.gameData?.datetime?.officialDate || '';
    const season = officialDate ? parseInt(officialDate.split('-')[0], 10) : new Date().getFullYear();

    // Phase 2: Fetch standings + team stats in parallel
    const [standings, allTeamStats] = await Promise.all([
      fetchStandings(season).catch(() => null),
      fetchAllTeamStats(season).catch(() => null),
    ]);
    standingsData = standings;
    allTeamStatsData = allTeamStats;

    // Render immediately, then compute trends and re-render
    renderGame(gameData, standingsData, allTeamStatsData);

    // Async trend computation, re-renders when done
    const boxscore = gumbo.liveData.boxscore;
    const awayLineup = buildTeamLineup(boxscore, 'away');
    const homeLineup = buildTeamLineup(boxscore, 'home');
    Promise.all([
      computeLineupTrends(awayLineup, officialDate, season).catch(() => {}),
      computeLineupTrends(homeLineup, officialDate, season).catch(() => {}),
    ]).then(() => {
      // Store trends on gameData so renderTeamScorecard can access them
      if (!gameData._trends) gameData._trends = {};
      gameData._trends.away = awayLineup;
      gameData._trends.home = homeLineup;
      renderGame(gameData, standingsData, allTeamStatsData);
    });
  } catch (err) {
    container.innerHTML = `<p class="error">Failed to load game: ${err.message}</p>`;
    console.error(err);
  } finally {
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

  container.innerHTML = '';

  // Pitch legend removed; see Legend overlay for full reference

  // Team comparison table
  const comparisonSection = document.createElement('div');
  comparisonSection.innerHTML = renderTeamComparisonHTML(data, standings);
  container.appendChild(comparisonSection);

  // Game header with linescore, game info, umpires
  const headerSection = document.createElement('div');
  headerSection.innerHTML = renderGameHeaderHTML(data);
  container.appendChild(headerSection);

  // Render both team sections
  container.appendChild(renderTeamSection(data, 'away'));
  container.appendChild(renderTeamSection(data, 'home'));

  // Restore and persist <details> open/closed state
  restoreDetailsState();
}

function renderTeamSection(data, side) {
  const team = data.gameData.teams[side];
  const oppSide = side === 'away' ? 'home' : 'away';
  const oppTeam = data.gameData.teams[oppSide];
  const label = side === 'away' ? 'Away' : 'Home';

  const section = document.createElement('div');
  section.className = 'scorecard-section';

  // Team header (larger)
  const header = document.createElement('div');
  header.className = 'scorecard-section-header';
  header.innerHTML = `<h2>${team.name} (${label})</h2>`;
  section.appendChild(header);

  // Scorecard grid (this team's batting)
  const scroll = document.createElement('div');
  scroll.className = 'scorecard-scroll';
  scroll.appendChild(renderTeamScorecard(data, side));
  section.appendChild(scroll);

  // Opposing pitcher game stats
  const pitchersDiv = document.createElement('div');
  pitchersDiv.className = 'pitcher-stats-section';
  pitchersDiv.innerHTML = renderPitcherStatsHTML(data, oppSide, oppTeam.abbreviation);
  section.appendChild(pitchersDiv);

  // Opposing bullpen
  const bullpenHTML = renderBullpenHTML(data, oppSide, oppTeam.abbreviation);
  if (bullpenHTML) {
    const bullpenDiv = document.createElement('div');
    bullpenDiv.className = 'pitcher-stats-section';
    bullpenDiv.innerHTML = bullpenHTML;
    section.appendChild(bullpenDiv);
  }

  // This team's bench
  const benchHTML = renderBenchHTML(data, side, team.abbreviation);
  if (benchHTML) {
    const benchDiv = document.createElement('div');
    benchDiv.className = 'pitcher-stats-section';
    benchDiv.innerHTML = benchHTML;
    section.appendChild(benchDiv);
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

// Persist <details> open/closed state across refreshes
const DETAILS_KEY = 'detailsState';

function getDetailsState() {
  try { return JSON.parse(localStorage.getItem(DETAILS_KEY)) || {}; } catch { return {}; }
}

function restoreDetailsState() {
  const state = getDetailsState();
  for (const el of document.querySelectorAll('details[data-section]')) {
    const key = el.dataset.section;
    if (state[key]) el.open = true;
    el.addEventListener('toggle', () => {
      const s = getDetailsState();
      if (el.open) s[key] = true; else delete s[key];
      localStorage.setItem(DETAILS_KEY, JSON.stringify(s));
    });
  }
}

// Initial load
loadGame().then(() => {
  // Signal to parent (styles editor) that we're ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
  }
});
