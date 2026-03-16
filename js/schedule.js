// Game Picker page logic

import { fetchSchedule, fetchLiveFeed, getGames, isDevMode } from './api.js';
import { formatDate, parseDate, formatGameTime, gameStatusText } from './utils.js';
import { renderThumbnail, renderEmptyGrid } from './svg-thumbnail.js';
import { DatePicker } from './datepicker.js';

const gamesGrid = document.getElementById('games-grid');
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

const picker = new DatePicker(document.getElementById('date-picker'), (date) => {
  setDate(date);
});

function setDate(date) {
  currentDate = date;
  picker.setDate(date);
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

    // Sort: active/finished games first, then by start time
    games.sort((a, b) => {
      const aActive = isGameActive(a);
      const bActive = isGameActive(b);
      if (aActive !== bActive) return bActive - aActive;
      return new Date(a.gameDate) - new Date(b.gameDate);
    });

    gamesGrid.innerHTML = '';
    const cards = [];
    for (const game of games) {
      const card = renderGameCard(game, dateStr);
      gamesGrid.appendChild(card);
      cards.push({ game, card });
    }

    // Load thumbnails for completed/live games
    loadThumbnails(cards);
  } catch (err) {
    gamesGrid.innerHTML = `<p class="error">Failed to load games: ${err.message}</p>`;
  }
}

function renderGameCard(game, dateStr) {
  const away = game.teams.away;
  const home = game.teams.home;
  const status = game.status;
  const isFinal = status.abstractGameState === 'Final';
  const isLive = status.abstractGameState === 'Live';
  const isInPlay = isLive && status.detailedState !== 'Warmup' && status.detailedState !== 'Pre-Game';
  const showScore = isFinal || isInPlay;

  const awayRecord = away.leagueRecord ? ` (${away.leagueRecord.wins}-${away.leagueRecord.losses})` : '';
  const homeRecord = home.leagueRecord ? ` (${home.leagueRecord.wins}-${home.leagueRecord.losses})` : '';

  const a = document.createElement('a');
  a.className = 'game-card';
  a.href = `/game.html?gamePk=${game.gamePk}&date=${dateStr}${devParam()}`;

  a.innerHTML = `
    <div class="game-card-header">
      <div class="game-card-status ${isInPlay ? 'status-live' : 'status-final'}">
        ${showScore ? gameStatusText(status) : formatGameTime(game.gameDate)}
      </div>
      <div class="game-card-teams">
        <div class="game-card-team">
          <span class="team-name">${away.team.name}<span class="team-record">${awayRecord}</span></span>
          ${showScore ? `<span class="team-score">${away.score ?? ''}</span>` : ''}
        </div>
        <div class="game-card-team">
          <span class="team-name">${home.team.name}<span class="team-record">${homeRecord}</span></span>
          ${showScore ? `<span class="team-score">${home.score ?? ''}</span>` : ''}
        </div>
      </div>
    </div>
    ${showScore ? '<div class="thumbnail-container"></div>' : ''}
    ${!showScore ? renderPitchers(away, home) : ''}
  `;

  // Render empty grid placeholder for live/final games only
  if (showScore) {
    const container = a.querySelector('.thumbnail-container');
    container.appendChild(renderEmptyGrid());
  }

  return a;
}

function renderPitchers(away, home) {
  const awayP = away.probablePitcher?.fullName;
  const homeP = home.probablePitcher?.fullName;
  if (!awayP && !homeP) return '';
  return `<div class="game-card-pitchers">${awayP || 'TBD'} vs ${homeP || 'TBD'}</div>`;
}

/** Game is actively in play (not warmup) or finished */
function isGameActive(game) {
  const state = game.status.abstractGameState;
  const detail = game.status.detailedState;
  if (state === 'Final') return true;
  if (state === 'Live' && detail !== 'Warmup' && detail !== 'Pre-Game') return true;
  return false;
}

async function loadThumbnails(cards) {
  const toLoad = cards.filter(({ game }) => isGameActive(game));

  // Fetch with concurrency limit
  const CONCURRENT = 4;
  for (let i = 0; i < toLoad.length; i += CONCURRENT) {
    const batch = toLoad.slice(i, i + CONCURRENT);
    await Promise.allSettled(batch.map(async ({ game, card }) => {
      try {
        const data = await fetchLiveFeed(game.gamePk);
        const container = card.querySelector('.thumbnail-container');
        if (container) {
          container.innerHTML = '';
          container.appendChild(renderThumbnail(data));
        }
      } catch {
        // Keep empty grid placeholder on failure
      }
    }));
  }
}

// Initialize
setDate(currentDate);
