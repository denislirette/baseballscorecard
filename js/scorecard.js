// Scorecard page - main entry point

import { updateConfig, resetConfig } from './layout-config.js';
import { fetchLiveFeed, fetchStandings, fetchAllTeamStats } from './api.js';
import {
  renderTeamScorecard,
  renderLinescoreHTML,
  renderPitcherStatsHTML,
  renderGameHeaderHTML,
  renderStartingPitcherHTML,
  renderUmpiresHTML,
  renderBenchHTML,
  renderBullpenHTML,
} from './svg-renderer.js';
import { renderStandingsHTML } from './standings.js';
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

  try {
    // Phase 1: Fetch GUMBO first to get the game season
    const gumbo = await fetchLiveFeed(gamePk);
    gameData = gumbo;

    // Derive season from game data (not current year — fixtures may differ)
    const officialDate = gumbo.gameData?.datetime?.officialDate || '';
    const season = officialDate ? parseInt(officialDate.split('-')[0], 10) : new Date().getFullYear();

    // Phase 2: Fetch standings + team stats in parallel
    const [standings, allTeamStats] = await Promise.all([
      fetchStandings(season).catch(() => null),
      fetchAllTeamStats(season).catch(() => null),
    ]);
    standingsData = standings;
    allTeamStatsData = allTeamStats;

    renderGame(gameData, standingsData, allTeamStatsData);
  } catch (err) {
    container.innerHTML = `<p class="error">Failed to load game: ${err.message}</p>`;
    console.error(err);
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

  // Standings — render into the overlay (not inline)
  if (standings) {
    const standingsHTML = renderStandingsHTML(standings, away.id, home.id);
    if (standingsHTML) {
      const overlay = document.getElementById('standings-overlay');
      if (overlay) {
        const content = overlay.querySelector('.standings-overlay-content');
        if (content) content.innerHTML = standingsHTML;
      }
    }
  }

  // Render both team sections
  container.appendChild(renderTeamSection(data, 'away'));
  container.appendChild(renderTeamSection(data, 'home'));
}

function renderTeamSection(data, side) {
  const team = data.gameData.teams[side];
  const label = side === 'away' ? 'Away' : 'Home';

  const section = document.createElement('div');
  section.className = 'scorecard-section';

  // Team header (larger)
  const header = document.createElement('div');
  header.className = 'scorecard-section-header';
  header.innerHTML = `<img src="https://www.mlbstatic.com/team-logos/${team.id}.svg" alt="${team.abbreviation}"><h2>${team.name} (${label})</h2>`;
  section.appendChild(header);

  // Starting pitcher — full width
  const spDiv = document.createElement('div');
  spDiv.innerHTML = renderStartingPitcherHTML(data, side);
  section.appendChild(spDiv);

  // Pitcher stats (game) + Bullpen together
  const pitchersDiv = document.createElement('div');
  pitchersDiv.className = 'pitcher-stats-section';
  pitchersDiv.innerHTML = renderPitcherStatsHTML(data, side);
  section.appendChild(pitchersDiv);

  const bullpenHTML = renderBullpenHTML(data, side);
  if (bullpenHTML) {
    const bullpenDiv = document.createElement('div');
    bullpenDiv.className = 'pitcher-stats-section';
    bullpenDiv.innerHTML = bullpenHTML;
    section.appendChild(bullpenDiv);
  }

  // Scorecard grid
  const scroll = document.createElement('div');
  scroll.className = 'scorecard-scroll';
  scroll.appendChild(renderTeamScorecard(data, side));
  section.appendChild(scroll);

  // Bench at bottom
  const benchHTML = renderBenchHTML(data, side);
  if (benchHTML) {
    const benchDiv = document.createElement('div');
    benchDiv.className = 'pitcher-stats-section';
    benchDiv.innerHTML = benchHTML;
    section.appendChild(benchDiv);
  }

  return section;
}

// Standings overlay toggle
const standingsBtn = document.getElementById('standings-btn');
const standingsOverlay = document.getElementById('standings-overlay');

if (standingsBtn && standingsOverlay) {
  standingsBtn.addEventListener('click', () => {
    standingsOverlay.classList.toggle('visible');
  });

  // Click backdrop to dismiss
  standingsOverlay.addEventListener('click', (e) => {
    if (e.target === standingsOverlay) {
      standingsOverlay.classList.remove('visible');
    }
  });

  // Escape to dismiss
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && standingsOverlay.classList.contains('visible')) {
      standingsOverlay.classList.remove('visible');
    }
  });
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

// Initial load
loadGame().then(() => {
  // Signal to parent (styles editor) that we're ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
  }
});
