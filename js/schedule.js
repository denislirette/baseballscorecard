// Game Picker page logic

import { fetchSchedule, getGames, teamLogoUrl, isDevMode } from './api.js';
import { formatDate, parseDate, formatGameTime, gameStatusText } from './utils.js';

const gamesGrid = document.getElementById('games-grid');
const datePicker = document.getElementById('date-picker');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');

const devMode = isDevMode();

let currentDate = new Date();

// Check for date in URL params, or default to fixture date in dev mode
const params = new URLSearchParams(window.location.search);
if (params.has('date')) {
  currentDate = parseDate(params.get('date'));
} else if (devMode) {
  currentDate = parseDate('2025-07-04');
}

function devParam() {
  return devMode ? '&dev' : '';
}

function setDate(date) {
  currentDate = date;
  datePicker.value = formatDate(date);
  loadGames();
}

prevBtn.addEventListener('click', () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() - 1);
  setDate(d);
});

nextBtn.addEventListener('click', () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + 1);
  setDate(d);
});

datePicker.addEventListener('change', () => {
  setDate(parseDate(datePicker.value));
});

async function loadGames() {
  const dateStr = formatDate(currentDate);
  gamesGrid.innerHTML = '<p class="loading">Loading games...</p>';

  try {
    const data = await fetchSchedule(dateStr);
    const games = getGames(data);

    if (games.length === 0) {
      gamesGrid.innerHTML = '<p class="loading">No games scheduled for this date.</p>';
      return;
    }

    gamesGrid.innerHTML = '';
    for (const game of games) {
      gamesGrid.appendChild(renderGameCard(game, dateStr));
    }
  } catch (err) {
    gamesGrid.innerHTML = `<p class="error">Failed to load games: ${err.message}</p>`;
  }
}

function renderGameCard(game, dateStr) {
  const away = game.teams.away;
  const home = game.teams.home;
  const status = game.status;
  const isLive = status.abstractGameState === 'Live';
  const isFinal = status.abstractGameState === 'Final';
  const showScore = isLive || isFinal;

  const a = document.createElement('a');
  a.className = 'game-card';
  a.href = `/game.html?gamePk=${game.gamePk}&date=${dateStr}${devParam()}`;

  a.innerHTML = `
    <div class="game-card-teams">
      <div class="game-card-team">
        <img class="team-logo" src="${teamLogoUrl(away.team.id)}" alt="${away.team.name}" loading="lazy">
        <span class="team-name">${away.team.name}</span>
        ${showScore ? `<span class="team-score">${away.score ?? ''}</span>` : ''}
      </div>
      <div class="game-card-team">
        <img class="team-logo" src="${teamLogoUrl(home.team.id)}" alt="${home.team.name}" loading="lazy">
        <span class="team-name">${home.team.name}</span>
        ${showScore ? `<span class="team-score">${home.score ?? ''}</span>` : ''}
      </div>
    </div>
    <div class="game-card-status ${isLive ? 'status-live' : 'status-final'}">
      ${showScore ? gameStatusText(status) : formatGameTime(game.gameDate)}
    </div>
    ${renderPitchers(away, home)}
  `;

  return a;
}

function renderPitchers(away, home) {
  const awayP = away.probablePitcher?.fullName;
  const homeP = home.probablePitcher?.fullName;
  if (!awayP && !homeP) return '';
  return `<div class="game-card-pitchers">${awayP || 'TBD'} vs ${homeP || 'TBD'}</div>`;
}

// Initialize
setDate(currentDate);
