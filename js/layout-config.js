// Shared mutable configuration for layout constants.
// Used by svg-renderer.js and svg-thumbnail.js at render time.
// The cell editor updates these via /api/save-layout.

export const DEFAULTS = Object.freeze({
  MARGIN_LEFT: 380,
  COL_WIDTH: 200,
  ROW_HEIGHT: 200,
  HEADER_HEIGHT: 74,
  STATS_COL_WIDTH: 44,
  SUMMARY_ROW_HEIGHT: 36,
  DIAMOND_R: 55,
  PITCH_COL_W: 48,
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
  BASE_PATH_SW: 5.5,         // Base path stroke width
  HASH_SW: 5.5,              // Hash mark stroke width
  DIAMOND_SW: 3.5,           // Diamond outline stroke width
});

export const THUMBNAIL_DEFAULTS = Object.freeze({
  TH_CELL_SIZE: 52,         // cell size (viewBox units)
  TH_DIAMOND_R: 14,         // diamond radius
  TH_PATH_STROKE_W: 2.5,    // base path stroke width
  TH_GRID_STROKE_W: 0.5,    // grid line stroke width
  TH_FONT_SIZE: 20,         // notation font size (no diamond)
  TH_FONT_SIZE_SM: 14,      // smaller font when diamond shown
  TH_DOT_R: 3,              // out dot radius
  TH_GAP: 19,               // gap between away/home grids
  TH_PAD: 4,                // inner cell padding
});

const config = { ...DEFAULTS };
const thumbnailConfig = { ...THUMBNAIL_DEFAULTS };

export function getConfig() {
  return config;
}

export function updateConfig(overrides) {
  Object.assign(config, overrides);
}

export function resetConfig() {
  Object.assign(config, DEFAULTS);
}

export function getThumbnailConfig() {
  return thumbnailConfig;
}

export function updateThumbnailConfig(overrides) {
  Object.assign(thumbnailConfig, overrides);
}

export function resetThumbnailConfig() {
  Object.assign(thumbnailConfig, THUMBNAIL_DEFAULTS);
}
