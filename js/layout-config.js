// Shared mutable configuration for layout constants.
// Used by svg-renderer.js at render time.
// The styles editor updates these via postMessage.

export const DEFAULTS = Object.freeze({
  // Synced from design-tokens.json
  MARGIN_LEFT: 380,
  COL_WIDTH: 200,
  ROW_HEIGHT: 200,
  HEADER_HEIGHT: 36,
  STATS_COL_WIDTH: 44,
  SUMMARY_ROW_HEIGHT: 36,
  DIAMOND_R: 55,
  PITCH_COL_W: 66,
  PITCH_START_Y: 4,
  PITCH_STEP: 18,
  PITCH_FONT_SIZE: 16,
  SZ_WIDTH: 16,
  SZ_HEIGHT: 26,
  SUB_CIRCLE_POS: 0.08,    // Sub circle position (fraction of MARGIN_LEFT)
  SUB_TEXT_POS: 0.05,       // Sub player text position (fraction of MARGIN_LEFT)
  SUB_CIRCLE_R: 10,         // Sub circle radius
  SUB_LINE_W: 5,            // Sub indicator line width
  SUB_CIRCLE_VPOS: 0.75,    // Sub circle vertical position on play cell bar (fraction of ROW_HEIGHT)
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
