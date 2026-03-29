// Global time delay for syncing with delayed live streams.
// Filters play-by-play data to only show plays before (now - delay).

const STORAGE_KEY = 'stream-delay-seconds';

/**
 * Get the current delay in seconds (0 = no delay).
 */
export function getDelay() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
}

/**
 * Set the delay in seconds.
 */
export function setDelay(seconds) {
  localStorage.setItem(STORAGE_KEY, String(Math.max(0, seconds)));
}

/**
 * Get the cutoff time (now - delay). Plays after this time are hidden.
 * Returns null if no delay is set.
 */
export function getCutoffTime() {
  const delay = getDelay();
  if (delay <= 0) return null;
  return new Date(Date.now() - delay * 1000);
}

/**
 * Filter allPlays to only include plays that completed before the cutoff time.
 * Returns the full array if no delay is set.
 */
export function filterPlaysByDelay(allPlays) {
  const cutoff = getCutoffTime();
  if (!cutoff) return allPlays;
  const cutoffISO = cutoff.toISOString();
  return allPlays.filter(play => {
    const endTime = play.about?.endTime;
    if (!endTime) return true; // include plays without timestamps (pre-game)
    return endTime <= cutoffISO;
  });
}

/**
 * Filter linescore innings to match the delayed plays.
 * Recalculates R/H/E from the filtered plays.
 */
export function filterLinescoreByDelay(linescore, allPlays) {
  const cutoff = getCutoffTime();
  if (!cutoff) return linescore;

  const cutoffISO = cutoff.toISOString();
  const filtered = { ...linescore, innings: [], teams: { away: { ...linescore.teams?.away }, home: { ...linescore.teams?.home } } };

  // Find the last completed inning based on play timestamps
  let lastVisibleInning = 0;
  let lastVisibleHalf = 'top';
  for (const play of allPlays) {
    const endTime = play.about?.endTime;
    if (!endTime || endTime > cutoffISO) continue;
    if (play.about.inning > lastVisibleInning || (play.about.inning === lastVisibleInning && play.about.halfInning === 'bottom')) {
      lastVisibleInning = play.about.inning;
      lastVisibleHalf = play.about.halfInning;
    }
  }

  // Include innings up to the last visible one
  if (linescore.innings) {
    for (let i = 0; i < linescore.innings.length; i++) {
      const inn = linescore.innings[i];
      const innNum = i + 1;
      if (innNum > lastVisibleInning) break;
      if (innNum === lastVisibleInning && lastVisibleHalf === 'top') {
        // Only show top half
        filtered.innings.push({ ...inn, home: {} });
      } else {
        filtered.innings.push({ ...inn });
      }
    }
  }

  return filtered;
}

/**
 * Render the delay control UI. Call once on page load.
 */
export function renderDelayControl(container, onChange) {
  const delay = getDelay();

  const wrapper = document.createElement('div');
  wrapper.className = 'delay-control';
  wrapper.innerHTML = `
    <label class="delay-label">Stream delay</label>
    <div class="delay-presets">
      <button class="delay-preset${delay === 0 ? ' active' : ''}" data-seconds="0">Live</button>
      <button class="delay-preset${delay === 30 ? ' active' : ''}" data-seconds="30">30s</button>
      <button class="delay-preset${delay === 60 ? ' active' : ''}" data-seconds="60">1m</button>
      <button class="delay-preset${delay === 120 ? ' active' : ''}" data-seconds="120">2m</button>
      <button class="delay-preset${delay === 300 ? ' active' : ''}" data-seconds="300">5m</button>
    </div>
    <input type="number" class="delay-custom" value="${delay > 0 && ![30,60,120,300].includes(delay) ? delay : ''}" min="0" max="600" placeholder="s" aria-label="Custom delay seconds">
  `;

  const presets = wrapper.querySelectorAll('.delay-preset');
  const custom = wrapper.querySelector('.delay-custom');

  function activate(seconds) {
    setDelay(seconds);
    presets.forEach(b => b.classList.toggle('active', parseInt(b.dataset.seconds) === seconds));
    if (![0, 30, 60, 120, 300].includes(seconds)) {
      presets.forEach(b => b.classList.remove('active'));
      custom.value = seconds;
    } else {
      custom.value = '';
    }
    if (onChange) onChange(seconds);
  }

  presets.forEach(btn => {
    btn.addEventListener('click', () => activate(parseInt(btn.dataset.seconds)));
  });

  custom.addEventListener('change', () => {
    const val = parseInt(custom.value, 10);
    if (val >= 0) activate(val);
  });
  custom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = parseInt(custom.value, 10);
      if (val >= 0) activate(val);
    }
  });

  container.appendChild(wrapper);
}
