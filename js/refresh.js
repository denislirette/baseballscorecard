// Auto-refresh controller

let refreshTimer = null;
let lastRefresh = null;

/**
 * Set up refresh control listeners and auto-refresh behavior.
 * @param {Function} refreshFn - The function to call on refresh (e.g., loadGame)
 * @param {Function} getGameState - Returns the current abstractGameState
 */
export function renderRefreshControls(refreshFn, getGameState) {
  const autoRefreshCheckbox = document.getElementById('auto-refresh');
  const intervalInput = document.getElementById('refresh-interval');
  const refreshBtn = document.getElementById('refresh-btn');
  const statusEl = document.getElementById('refresh-status');

  function getInterval() {
    return (parseInt(intervalInput.value, 10) || 1) * 1000;
  }

  function updateStatus() {
    if (lastRefresh) {
      statusEl.textContent = `Last updated: ${lastRefresh.toLocaleTimeString()}`;
    }
  }

  async function doRefresh() {
    statusEl.textContent = 'Refreshing...';
    await refreshFn();
    lastRefresh = new Date();
    updateStatus();

    // Stop auto-refresh if game is final
    const state = getGameState();
    if (state === 'Final') {
      stopAutoRefresh();
      autoRefreshCheckbox.checked = false;
      statusEl.textContent += ' (Game Final - auto-refresh stopped)';
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(doRefresh, getInterval());
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  refreshBtn.addEventListener('click', doRefresh);

  autoRefreshCheckbox.addEventListener('change', () => {
    if (autoRefreshCheckbox.checked) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  intervalInput.addEventListener('change', () => {
    if (autoRefreshCheckbox.checked) {
      startAutoRefresh();
    }
  });

  // Start auto-refresh by default for live games
  // (will be stopped automatically when Final is detected)
  if (autoRefreshCheckbox.checked) {
    startAutoRefresh();
  }
}
