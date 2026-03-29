// Stream delay: syncs the scorecard with a delayed live stream.
// Filters play-by-play data to show the game as it was X seconds ago.

const STORAGE_KEY = 'stream-delay-seconds';
const ENABLED_KEY = 'stream-delay-enabled';
let clockTimer = null;

/**
 * Get the current delay in seconds.
 */
export function getDelay() {
  if (localStorage.getItem(ENABLED_KEY) !== 'true') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
}

/**
 * Get the cutoff time (now - delay).
 * Returns null if delay is off or 0.
 */
export function getCutoffTime() {
  const delay = getDelay();
  if (delay <= 0) return null;
  return new Date(Date.now() - delay * 1000);
}

/**
 * Filter allPlays to only include plays completed before the cutoff.
 */
export function filterPlaysByDelay(allPlays) {
  const cutoff = getCutoffTime();
  if (!cutoff) return allPlays;
  const cutoffISO = cutoff.toISOString();
  return allPlays.filter(play => {
    const endTime = play.about?.endTime;
    if (!endTime) return true;
    return endTime <= cutoffISO;
  });
}

/**
 * Filter linescore to match delayed plays.
 */
export function filterLinescoreByDelay(linescore, allPlays) {
  const cutoff = getCutoffTime();
  if (!cutoff) return linescore;
  const cutoffISO = cutoff.toISOString();

  const filtered = {
    ...linescore,
    innings: [],
    teams: {
      away: { ...linescore.teams?.away },
      home: { ...linescore.teams?.home },
    },
  };

  let lastInning = 0;
  let lastHalf = 'top';
  for (const play of allPlays) {
    const endTime = play.about?.endTime;
    if (!endTime || endTime > cutoffISO) continue;
    if (play.about.inning > lastInning || (play.about.inning === lastInning && play.about.halfInning === 'bottom')) {
      lastInning = play.about.inning;
      lastHalf = play.about.halfInning;
    }
  }

  if (linescore.innings) {
    for (let i = 0; i < linescore.innings.length; i++) {
      const innNum = i + 1;
      if (innNum > lastInning) break;
      if (innNum === lastInning && lastHalf === 'top') {
        filtered.innings.push({ ...linescore.innings[i], home: {} });
      } else {
        filtered.innings.push({ ...linescore.innings[i] });
      }
    }
  }

  return filtered;
}

/**
 * Initialize the delay control. Call once per page.
 * @param {Function} onChange - called when delay changes (should trigger re-render)
 */
export function initDelayControl(onChange) {
  const input = document.getElementById('delay-seconds');
  const toggle = document.getElementById('delay-toggle');
  const timeDisplay = document.getElementById('delay-time');
  const bar = document.getElementById('delay-bar');
  if (!input || !toggle) return;

  // Restore saved state
  const savedDelay = localStorage.getItem(STORAGE_KEY) || '0';
  const savedEnabled = localStorage.getItem(ENABLED_KEY) === 'true';
  input.value = savedDelay;

  function updateUI(enabled) {
    toggle.textContent = enabled ? 'On' : 'Off';
    toggle.classList.toggle('delay-on', enabled);
    bar.classList.toggle('delay-active', enabled);

    if (enabled && parseInt(input.value) > 0) {
      startClock();
    } else {
      stopClock();
      if (timeDisplay) timeDisplay.textContent = '';
    }
  }

  function startClock() {
    stopClock();
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
  }

  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  function tickClock() {
    if (!timeDisplay) return;
    const delay = parseInt(input.value, 10) || 0;
    if (delay <= 0) { timeDisplay.textContent = ''; return; }
    const delayed = new Date(Date.now() - delay * 1000);
    timeDisplay.textContent = delayed.toLocaleTimeString();
  }

  function apply() {
    const seconds = parseInt(input.value, 10) || 0;
    const enabled = localStorage.getItem(ENABLED_KEY) === 'true';
    localStorage.setItem(STORAGE_KEY, String(seconds));
    updateUI(enabled);
    if (onChange) onChange();
  }

  // Toggle on/off
  toggle.addEventListener('click', () => {
    const nowEnabled = localStorage.getItem(ENABLED_KEY) !== 'true';
    localStorage.setItem(ENABLED_KEY, nowEnabled ? 'true' : 'false');
    updateUI(nowEnabled);
    if (onChange) onChange();
  });

  // Value change
  input.addEventListener('change', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); apply(); }
  });

  // Initial state
  updateUI(savedEnabled);
}
