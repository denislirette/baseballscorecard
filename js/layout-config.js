// Shared mutable configuration for layout constants.
// Used by svg-renderer.js at render time.
// The styles editor updates these via postMessage.

export const DEFAULTS = Object.freeze({
  // SVG Scorecard
  MARGIN_LEFT: 300,
  COL_WIDTH: 240,
  ROW_HEIGHT: 200,
  HEADER_HEIGHT: 36,
  STATS_COL_WIDTH: 44,
  SUMMARY_ROW_HEIGHT: 28,
  DIAMOND_R: 65,
  PITCH_COL_W: 60,
  PITCH_START_Y: 4,
  PITCH_STEP: 18,
  PITCH_FONT_SIZE: 16,
  SZ_WIDTH: 16,
  SZ_HEIGHT: 26,
});

const config = { ...DEFAULTS };

export function getConfig() {
  return config;
}

export function updateConfig(overrides) {
  Object.assign(config, overrides);
}

export function resetConfig() {
  Object.assign(config, DEFAULTS);
}
