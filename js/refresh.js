// Auto-refresh controller with presets, custom input, and countdown

let refreshTimer = null;
let countdownTimer = null;
let lastRefresh = null;
let nextRefreshAt = null;

export function renderRefreshControls(refreshFn, getGameState) {
  const presets = document.querySelectorAll('.refresh-preset');
  const customInput = document.getElementById('refresh-custom');
  const countdownEl = document.getElementById('refresh-countdown');
  const statusEl = document.getElementById('refresh-status');
  let intervalMs = 0;

  // Restore saved interval
  const saved = localStorage.getItem('refresh-seconds');
  if (saved) {
    const seconds = parseInt(saved, 10);
    const presetBtn = document.querySelector(`.refresh-preset[data-seconds="${seconds}"]`);
    if (presetBtn) {
      selectPreset(presetBtn);
    } else if (seconds > 0) {
      customInput.value = seconds;
      startCustom(seconds);
    }
  }

  function clearPresets() {
    presets.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
  }

  function selectPreset(btn) {
    clearPresets();
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    customInput.value = '';

    const seconds = parseInt(btn.dataset.seconds, 10);
    localStorage.setItem('refresh-seconds', seconds);

    stop();
    if (seconds > 0) {
      intervalMs = seconds * 1000;
      start();
    }
  }

  function startCustom(seconds) {
    clearPresets();
    localStorage.setItem('refresh-seconds', seconds);
    stop();
    intervalMs = seconds * 1000;
    start();
  }

  function updateCountdown() {
    if (!nextRefreshAt || !countdownEl) return;
    const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
    countdownEl.textContent = remaining > 0 ? `${remaining}s` : '';
  }

  function updateStatus() {
    if (!lastRefresh) return;
    statusEl.textContent = `Updated ${lastRefresh.toLocaleTimeString()}`;
  }

  function updateBar(active) {
    const bar = document.getElementById('refresh-bar');
    if (bar) bar.classList.toggle('refresh-active', active);
  }

  async function doRefresh() {
    await refreshFn();
    lastRefresh = new Date();
    updateStatus();

    const state = getGameState();
    if (state === 'Final') {
      stop();
      const offBtn = document.querySelector('.refresh-preset[data-seconds="0"]');
      if (offBtn) selectPreset(offBtn);
      statusEl.textContent += ' (Final)';
      return;
    }

    nextRefreshAt = Date.now() + intervalMs;
  }

  function start() {
    stop();
    updateBar(true);
    nextRefreshAt = Date.now() + intervalMs;
    refreshTimer = setInterval(doRefresh, intervalMs);
    countdownTimer = setInterval(updateCountdown, 250);
    updateCountdown();
  }

  function stop() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    nextRefreshAt = null;
    if (countdownEl) countdownEl.textContent = '';
    updateBar(false);
  }

  // Preset clicks
  presets.forEach(btn => {
    btn.addEventListener('click', () => selectPreset(btn));
  });

  // Custom input: start on Enter or blur
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = parseInt(customInput.value, 10);
      if (val > 0) startCustom(val);
    }
  });
  customInput.addEventListener('change', () => {
    const val = parseInt(customInput.value, 10);
    if (val > 0) startCustom(val);
  });
  // Clicking into the input clears preset selection
  customInput.addEventListener('focus', () => clearPresets());
}
