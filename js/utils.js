// Utility functions

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date (local timezone).
 * @param {string} str
 * @returns {Date}
 */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format an ISO datetime string to a local time string.
 * @param {string} isoString
 * @returns {string} e.g. "7:05 PM"
 */
export function formatGameTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get a human-readable game status string.
 * @param {Object} status - game.status object from schedule API
 * @param {Object} [linescore] - optional linescore for inning details
 * @returns {string}
 */
export function gameStatusText(status, linescore) {
  const state = status.abstractGameState;
  if (state === 'Final') return status.detailedState;
  if (state === 'Preview') return 'Preview';
  if (state === 'Live') {
    if (linescore) {
      const half = linescore.isTopInning ? 'Top' : 'Bot';
      return `In Progress - ${half} ${linescore.currentInning}`;
    }
    return status.detailedState || 'In Progress';
  }
  return status.detailedState || state;
}
