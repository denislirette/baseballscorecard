// Scorecard page - main entry point

import { updateConfig, resetConfig } from './layout-config.js';
import { fetchLiveFeed, fetchStandings, fetchAllTeamStats, fetchCoaches } from './api.js';
import {
  renderTeamScorecard,
  renderLinescoreHTML,
  renderPitcherStatsHTML,
  renderGameHeaderHTML,
  renderStartingPitcherHTML,
  renderUmpiresHTML,
} from './svg-renderer.js';
import { renderStandingsHTML } from './standings.js';
import { renderDefensiveChart } from './defensive-chart.js';
import { renderRefreshControls } from './refresh.js';

const container = document.getElementById('scorecard-container');
const titleEl = document.getElementById('game-title');

const params = new URLSearchParams(window.location.search);
const gamePk = params.get('gamePk');

let gameData = null;
let standingsData = null;
let allTeamStatsData = null;
let awayCoachData = null;
let homeCoachData = null;

async function loadGame() {
  if (!gamePk) {
    container.innerHTML = '<p class="error">No game specified.</p>';
    return;
  }

  try {
    // Phase 1: Fetch GUMBO first to get the game season
    const gumbo = await fetchLiveFeed(gamePk);
    gameData = gumbo;

    // Derive season from game data (not current year — fixtures may differ)
    const officialDate = gumbo.gameData?.datetime?.officialDate || '';
    const season = officialDate ? parseInt(officialDate.split('-')[0], 10) : new Date().getFullYear();

    // Phase 2: Fetch standings + team stats + coaches in parallel
    const awayId = gumbo.gameData.teams.away.id;
    const homeId = gumbo.gameData.teams.home.id;
    const [standings, allTeamStats, awayCoaches, homeCoaches] = await Promise.all([
      fetchStandings(season).catch(() => null),
      fetchAllTeamStats(season).catch(() => null),
      fetchCoaches(awayId, season).catch(() => null),
      fetchCoaches(homeId, season).catch(() => null),
    ]);
    standingsData = standings;
    allTeamStatsData = allTeamStats;
    awayCoachData = awayCoaches;
    homeCoachData = homeCoaches;

    renderGame(gameData, standingsData, allTeamStatsData, awayCoachData, homeCoachData);
  } catch (err) {
    container.innerHTML = `<p class="error">Failed to load game: ${err.message}</p>`;
    console.error(err);
  }
}

function renderGame(data, standings, allTeamStats, awayCoaches, homeCoaches) {
  const gd = data.gameData;
  const away = gd.teams.away;
  const home = gd.teams.home;

  // Update page title
  titleEl.textContent = `${away.abbreviation} @ ${home.abbreviation}`;
  document.title = `${away.abbreviation} @ ${home.abbreviation} - Scorecard`;

  container.innerHTML = '';

  // Pitch legend (top of page)
  const legend = document.createElement('div');
  legend.className = 'pitch-legend';
  legend.innerHTML = `
    <span class="pitch-legend-item"><span class="pitch-legend-swatch ball"></span> Ball</span>
    <span class="pitch-legend-item"><span class="pitch-legend-swatch strike"></span> Strike/Foul</span>
    <span class="pitch-legend-item"><span class="pitch-legend-swatch in-play"></span> In Play</span>
    <span class="pitch-legend-types">FF=4-Seam, SL=Slider, CH=Change, CU=Curve, SI=Sinker, FC=Cutter, FS=Split, KC=K-Curve</span>
  `;
  container.appendChild(legend);

  // Game header with R/H/E box, decisions, venue, weather
  const headerSection = document.createElement('div');
  headerSection.innerHTML = renderGameHeaderHTML(data);
  container.appendChild(headerSection);

  // Linescore
  const linescoreSection = document.createElement('div');
  linescoreSection.id = 'linescore-section';
  linescoreSection.innerHTML = renderLinescoreHTML(data);
  container.appendChild(linescoreSection);

  // Umpires
  const umpiresHTML = renderUmpiresHTML(data);
  if (umpiresHTML) {
    const umpiresSection = document.createElement('div');
    umpiresSection.innerHTML = umpiresHTML;
    container.appendChild(umpiresSection);
  }

  // Standings
  if (standings) {
    const standingsHTML = renderStandingsHTML(standings, away.id, home.id);
    if (standingsHTML) {
      const standingsSection = document.createElement('div');
      standingsSection.innerHTML = standingsHTML;
      container.appendChild(standingsSection);
    }
  }

  // Away team section
  const awaySection = document.createElement('div');
  awaySection.className = 'scorecard-section';

  const awayHeader = document.createElement('div');
  awayHeader.className = 'scorecard-section-header';
  awayHeader.innerHTML = `<img src="https://www.mlbstatic.com/team-logos/${away.id}.svg" alt="${away.abbreviation}"><h2>${away.name} (Away)</h2>`;
  awaySection.appendChild(awayHeader);

  // Companion row: defensive chart + SP info + pitcher stats side-by-side
  const awayCompanion = document.createElement('div');
  awayCompanion.className = 'companion-row';

  const awayDefChart = renderDefensiveChart(data, 'away', allTeamStats, homeCoaches);
  awayCompanion.appendChild(awayDefChart);

  const awaySP = document.createElement('div');
  awaySP.className = 'companion-item';
  awaySP.innerHTML = renderStartingPitcherHTML(data, 'away');
  awayCompanion.appendChild(awaySP);

  const awayPitchers = document.createElement('div');
  awayPitchers.className = 'companion-item pitcher-stats-section';
  awayPitchers.innerHTML = renderPitcherStatsHTML(data, 'away');
  awayCompanion.appendChild(awayPitchers);

  awaySection.appendChild(awayCompanion);

  const awayScroll = document.createElement('div');
  awayScroll.className = 'scorecard-scroll';
  awayScroll.appendChild(renderTeamScorecard(data, 'away'));
  awaySection.appendChild(awayScroll);

  container.appendChild(awaySection);

  // Home team section
  const homeSection = document.createElement('div');
  homeSection.className = 'scorecard-section';

  const homeHeader = document.createElement('div');
  homeHeader.className = 'scorecard-section-header';
  homeHeader.innerHTML = `<img src="https://www.mlbstatic.com/team-logos/${home.id}.svg" alt="${home.abbreviation}"><h2>${home.name} (Home)</h2>`;
  homeSection.appendChild(homeHeader);

  // Companion row: defensive chart + SP info + pitcher stats side-by-side
  const homeCompanion = document.createElement('div');
  homeCompanion.className = 'companion-row';

  const homeDefChart = renderDefensiveChart(data, 'home', allTeamStats, awayCoaches);
  homeCompanion.appendChild(homeDefChart);

  const homeSP = document.createElement('div');
  homeSP.className = 'companion-item';
  homeSP.innerHTML = renderStartingPitcherHTML(data, 'home');
  homeCompanion.appendChild(homeSP);

  const homePitchers = document.createElement('div');
  homePitchers.className = 'companion-item pitcher-stats-section';
  homePitchers.innerHTML = renderPitcherStatsHTML(data, 'home');
  homeCompanion.appendChild(homePitchers);

  homeSection.appendChild(homeCompanion);

  const homeScroll = document.createElement('div');
  homeScroll.className = 'scorecard-scroll';
  homeScroll.appendChild(renderTeamScorecard(data, 'home'));
  homeSection.appendChild(homeScroll);

  container.appendChild(homeSection);
}

// Setup refresh controls
renderRefreshControls(loadGame, () => gameData?.gameData?.status?.abstractGameState);

// Listen for style editor messages (when embedded in iframe)
function rerender() {
  if (gameData) renderGame(gameData, standingsData, allTeamStatsData, awayCoachData, homeCoachData);
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

// Initial load
loadGame().then(() => {
  // Signal to parent (styles editor) that we're ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
  }
});
