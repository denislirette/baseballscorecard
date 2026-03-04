// Shared mutable configuration for layout constants.
// Used by svg-renderer.js and defensive-chart.js at render time.
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

  // Defensive Chart — inverted V field view
  DC_W: 600,
  DC_H: 420,
  DC_HEADER_H: 36,
  DC_COACH_H: 50,
  DC_DX: 70,
  DC_DY: 65,
  DC_CIRCLE_R: 45,
  DC_HP_Y: 0.62,

  // Defensive Chart — player label positions (X = mult × CX, Y = mult × H)
  DC_POS_LF_X: 0.30,  DC_POS_LF_Y: 0.15,
  DC_POS_CF_X: 1.00,  DC_POS_CF_Y: 0.07,
  DC_POS_RF_X: 1.70,  DC_POS_RF_Y: 0.15,
  DC_POS_SS_X: 0.55,  DC_POS_SS_Y: 0.37,
  DC_POS_2B_X: 1.45,  DC_POS_2B_Y: 0.37,
  DC_POS_3B_X: 0.25,  DC_POS_3B_Y: 0.52,
  DC_POS_1B_X: 1.75,  DC_POS_1B_Y: 0.52,
  DC_POS_C_X: 1.00,   DC_POS_C_Y: 0.76,
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
