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

// Arrow key shortcuts for date navigation (only when no input/button is focused)
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (document.activeElement?.getAttribute('role') === 'dialog') return;
  if (picker.isOpen) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevBtn.click();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextBtn.click();
  }
});

async function loadGames() {
  const dateStr = formatDate(currentDate);
  gamesGrid.innerHTML = '<p class="loading">Loading games...</p>';
  window.showProgress?.();

  try {
    const data = await fetchSchedule(dateStr);
    const games = getGames(data);

    if (games.length === 0) {
      gamesGrid.innerHTML = '<p class="loading">No games scheduled for this date.</p>';
      return;
    }

    // Separate games into groups
    const cancelled = games.filter(g => /cancel|postpone|suspend/i.test(g.status.detailedState));
    const remaining = games.filter(g => !cancelled.includes(g));
    const wbc = remaining.filter(g => g._isWBC);
    const springTraining = remaining.filter(g => !g._isWBC && g.gameType === 'S');
    const active = remaining.filter(g => !g._isWBC && g.gameType !== 'S');

    // Sort: active/finished games first, then by start time
    const sortGames = (arr) => arr.sort((a, b) => {
      const aActive = isGameActive(a);
      const bActive = isGameActive(b);
      if (aActive !== bActive) return bActive - aActive;
      return new Date(a.gameDate) - new Date(b.gameDate);
    });
    sortGames(active);
    sortGames(wbc);
    sortGames(springTraining);

    gamesGrid.innerHTML = '';
    const cards = [];

    // Helper to render a group of games with a heading
    function renderGroup(groupGames, title, useSmallGrid) {
      if (groupGames.length === 0) return;
      const section = document.createElement('div');
      section.className = 'cancelled-section';
      const heading = document.createElement('h3');
      heading.className = 'cancelled-heading';
      heading.textContent = title;
      section.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = useSmallGrid ? 'cancelled-grid' : 'games-grid';
      for (const game of groupGames) {
        const card = renderGameCard(game, dateStr);
        grid.appendChild(card);
        if (!useSmallGrid) cards.push({ game, card });
      }
      section.appendChild(grid);
      gamesGrid.appendChild(section);
    }

    // Regular season games (no heading)
    for (const game of active) {
      const card = renderGameCard(game, dateStr);
      gamesGrid.appendChild(card);
      cards.push({ game, card });
    }

    // Spring Training
    renderGroup(springTraining, 'Spring Training', false);

    // WBC
    const wbcTitle = wbc.length > 0 ? (wbc[0].seriesDescription || 'World Baseball Classic') : '';
    renderGroup(wbc, wbcTitle, false);

    // Cancelled/postponed games at the bottom (smaller cards)
    renderGroup(cancelled, 'Cancelled / Postponed', true);

    // Load thumbnails for completed/live games
    loadThumbnails(cards);
  } catch (err) {
    gamesGrid.innerHTML = `<p class="error">Failed to load games: ${err.message}</p>`;
  } finally {
    window.hideProgress?.();
  }
}

function renderGameCard(game, dateStr) {
  const away = game.teams.away;
  const home = game.teams.home;
  const status = game.status;
  const isFinal = status.abstractGameState === 'Final';
  const isLive = status.abstractGameState === 'Live';
  const isInPlay = isLive && status.detailedState !== 'Warmup' && status.detailedState !== 'Pre-Game';
  const isCancelled = /cancel|postpone|suspend/i.test(status.detailedState);
  const showScore = (isFinal || isInPlay) && !isCancelled;

  const awayRecord = away.leagueRecord ? ` (${away.leagueRecord.wins}-${away.leagueRecord.losses})` : '';
  const homeRecord = home.leagueRecord ? ` (${home.leagueRecord.wins}-${home.leagueRecord.losses})` : '';

  const a = document.createElement('a');
  a.className = `game-card${!showScore && !isCancelled ? ' game-card-compact' : ''}`;
  a.href = `/game.html?gamePk=${game.gamePk}&date=${dateStr}${devParam()}`;

  a.innerHTML = `
    <div class="game-card-header">
      <div class="game-card-status ${isCancelled ? 'status-cancelled' : isInPlay ? 'status-live' : 'status-final'}">
        ${isCancelled ? status.detailedState : showScore ? gameStatusText(status) : formatGameTime(game.gameDate)}
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
          // Widen the card for extra-inning games so cells stay full size
          const innings = data.liveData.linescore.innings?.length || 9;
          if (innings > 9) {
            card.style.minWidth = `${Math.round(280 * innings / 9)}px`;
          }
        }
      } catch (e) {
        console.error('Thumbnail load error for gamePk', game.gamePk, e);
      }
    }));
  }
}

// Initialize
setDate(currentDate);
