// Stream delay: syncs the scorecard with a delayed live stream.
// Filters play-by-play data to show the game as it was X seconds ago.

const STORAGE_KEY = 'stream-delay-seconds';
const ENABLED_KEY = 'stream-delay-enabled';

export function getDelay() {
  if (localStorage.getItem(ENABLED_KEY) !== 'true') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEY) || '15', 10);
}

export function getCutoffTime() {
  const delay = getDelay();
  if (delay <= 0) return null;
  return new Date(Date.now() - delay * 1000);
}

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

export function filterLinescoreByDelay(linescore, allPlays) {
  const cutoff = getCutoffTime();
  if (!cutoff) return linescore;
  const cutoffISO = cutoff.toISOString();

  const filtered = {
    ...linescore,
    innings: [],
    teams: { away: { ...linescore.teams?.away }, home: { ...linescore.teams?.home } },
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

export function initDelayControl(onChange) {
  const toggle = document.getElementById('delay-toggle');
  const input = document.getElementById('delay-seconds');
  const minus = document.getElementById('delay-minus');
  const plus = document.getElementById('delay-plus');
  if (!toggle || !input) return;

  const savedDelay = parseInt(localStorage.getItem(STORAGE_KEY) || '15', 10);
  const savedEnabled = localStorage.getItem(ENABLED_KEY) === 'true';

  function getVal() {
    return parseInt(input.value, 10) || 0;
  }
  function setVal(v) {
    input.value = v + 's';
  }
  setVal(savedDelay);

  function updateUI(enabled) {
    toggle.textContent = enabled ? 'Delay On' : 'Delay Off';
    toggle.classList.toggle('delay-on', enabled);
  }

  function apply() {
    const val = getVal();
    localStorage.setItem(STORAGE_KEY, String(Math.max(0, val)));
    setVal(val);
    if (onChange) onChange();
  }

  toggle.addEventListener('click', () => {
    const nowEnabled = localStorage.getItem(ENABLED_KEY) !== 'true';
    localStorage.setItem(ENABLED_KEY, nowEnabled ? 'true' : 'false');
    updateUI(nowEnabled);
    if (onChange) onChange();
  });

  if (minus) {
    minus.addEventListener('click', () => {
      setVal(Math.max(0, getVal() - 5));
      apply();
    });
  }

  if (plus) {
    plus.addEventListener('click', () => {
      setVal(Math.min(600, getVal() + 5));
      apply();
    });
  }

  input.addEventListener('focus', () => { input.value = String(getVal()); input.select(); });
  input.addEventListener('blur', () => { apply(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });

  updateUI(savedEnabled);
}
