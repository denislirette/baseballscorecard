// Styles Editor — live CSS/layout editor for the scorecard preview

import { DEFAULTS } from './layout-config.js';

// ── Control Registry ─────────────────────────────────────────────────
// Each group has a title and array of controls.
// type: 'color' | 'range' | 'toggle'
// key: CSS variable name (--xxx) or layout constant name (UPPER_CASE)

const CONTROL_GROUPS = [
  {
    title: 'Theme',
    controls: [
      { type: 'toggle', key: '_darkMode', label: 'Dark Mode' },
    ],
  },
  {
    title: 'Page Colors',
    controls: [
      { type: 'color', key: '--bg', label: 'Background' },
      { type: 'color', key: '--text', label: 'Text' },
      { type: 'color', key: '--text-secondary', label: 'Text Secondary' },
      { type: 'color', key: '--grid-line', label: 'Grid Line' },
      { type: 'color', key: '--surface', label: 'Surface' },
      { type: 'color', key: '--card-bg', label: 'Card Background' },
    ],
  },
  {
    title: 'Scorecard Colors',
    controls: [
      { type: 'color', key: '--sc-text', label: 'SC Text' },
      { type: 'color', key: '--sc-text-light', label: 'SC Text Light' },
      { type: 'color', key: '--sc-text-muted', label: 'SC Text Muted' },
      { type: 'color', key: '--sc-grid', label: 'SC Grid' },
      { type: 'color', key: '--sc-grid-bold', label: 'SC Grid Bold' },
      { type: 'color', key: '--sc-diamond', label: 'SC Diamond' },
      { type: 'color', key: '--sc-reached', label: 'SC Reached Base' },
      { type: 'color', key: '--sc-scored', label: 'SC Scored' },
      { type: 'color', key: '--sc-out', label: 'SC Out' },
      { type: 'color', key: '--sc-hit', label: 'SC Hit' },
      { type: 'color', key: '--sc-sub', label: 'SC Substitution' },
      { type: 'color', key: '--sc-bg', label: 'SC Background' },
      { type: 'color', key: '--sc-cell-bg', label: 'SC Cell Background' },
      { type: 'color', key: '--sc-header-bg', label: 'SC Header Background' },
    ],
  },
  {
    title: 'Pitch Colors',
    controls: [
      { type: 'color', key: '--sc-pitch-ball', label: 'Ball' },
      { type: 'color', key: '--sc-pitch-strike', label: 'Strike' },
      { type: 'color', key: '--sc-pitch-in-play', label: 'In Play' },
      { type: 'color', key: '--sc-pitch-hbp', label: 'Hit By Pitch' },
    ],
  },
  {
    title: 'Scorecard Grid',
    controls: [
      { type: 'range', key: 'MARGIN_LEFT', label: 'Left Margin', min: 100, max: 500, step: 10 },
      { type: 'range', key: 'COL_WIDTH', label: 'Column Width', min: 100, max: 400, step: 10 },
      { type: 'range', key: 'ROW_HEIGHT', label: 'Row Height', min: 100, max: 400, step: 10 },
      { type: 'range', key: 'HEADER_HEIGHT', label: 'Header Height', min: 20, max: 60, step: 2 },
      { type: 'range', key: 'STATS_COL_WIDTH', label: 'Stats Column Width', min: 20, max: 80, step: 2 },
      { type: 'range', key: 'SUMMARY_ROW_HEIGHT', label: 'Summary Row Height', min: 16, max: 50, step: 2 },
    ],
  },
  {
    title: 'Diamond',
    controls: [
      { type: 'range', key: 'DIAMOND_R', label: 'Diamond Radius', min: 30, max: 120, step: 5 },
    ],
  },
  {
    title: 'Pitch Sequence',
    controls: [
      { type: 'range', key: 'PITCH_COL_W', label: 'Pitch Column Width', min: 30, max: 100, step: 5 },
      { type: 'range', key: 'PITCH_START_Y', label: 'Pitch Start Y', min: 0, max: 20, step: 1 },
      { type: 'range', key: 'PITCH_STEP', label: 'Pitch Step', min: 10, max: 30, step: 1 },
      { type: 'range', key: 'PITCH_FONT_SIZE', label: 'Pitch Font Size', min: 8, max: 24, step: 1 },
      { type: 'range', key: 'SZ_WIDTH', label: 'Strike Zone Width', min: 8, max: 32, step: 2 },
      { type: 'range', key: 'SZ_HEIGHT', label: 'Strike Zone Height', min: 12, max: 50, step: 2 },
    ],
  },
];

// ── CSS variable defaults (light mode) ───────────────────────────────
const CSS_DEFAULTS_LIGHT = {
  '--bg': '#FFFFFF', '--text': '#000000', '--text-secondary': '#444444',
  '--grid-line': '#BBBBBB', '--surface': '#F5F5F5', '--card-bg': '#FFFFFF',
  '--sc-text': '#000000', '--sc-text-light': '#333333', '--sc-text-muted': '#555555',
  '--sc-grid': '#777777', '--sc-grid-bold': '#000000', '--sc-diamond': '#333333',
  '--sc-reached': '#000000', '--sc-scored': '#006600', '--sc-out': '#CC0000',
  '--sc-hit': '#006600', '--sc-sub': '#0000CC', '--sc-bg': '#FFFFFF',
  '--sc-cell-bg': '#FFFFFF', '--sc-header-bg': '#EEEEEE',
  '--sc-pitch-ball': '#000000', '--sc-pitch-strike': '#CC0000',
  '--sc-pitch-in-play': '#0000CC', '--sc-pitch-hbp': '#000000',
};

const CSS_DEFAULTS_DARK = {
  '--bg': '#1A1A1A', '--text': '#EEEEEE', '--text-secondary': '#BBBBBB',
  '--grid-line': '#555555', '--surface': '#2A2A2A', '--card-bg': '#2A2A2A',
  '--sc-text': '#EEEEEE', '--sc-text-light': '#CCCCCC', '--sc-text-muted': '#AAAAAA',
  '--sc-grid': '#666666', '--sc-grid-bold': '#DDDDDD', '--sc-diamond': '#BBBBBB',
  '--sc-reached': '#EEEEEE', '--sc-scored': '#44DD44', '--sc-out': '#FF5555',
  '--sc-hit': '#44DD44', '--sc-sub': '#7799FF', '--sc-bg': '#222222',
  '--sc-cell-bg': '#2A2A2A', '--sc-header-bg': '#333333',
  '--sc-pitch-ball': '#EEEEEE', '--sc-pitch-strike': '#FF5555',
  '--sc-pitch-in-play': '#7799FF', '--sc-pitch-hbp': '#EEEEEE',
};

// ── State ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'scorecard-styles';
let isDark = false;
let cssOverrides = {};    // key → color hex
let layoutOverrides = {}; // key → number
let iframe = null;
let previewReady = false;
let pendingUpdates = null; // for RAF throttling

// ── Init ─────────────────────────────────────────────────────────────

function init() {
  iframe = document.getElementById('preview-iframe');

  // Load saved state
  loadFromStorage();

  // Build controls
  buildControls();

  // Wire toolbar
  document.getElementById('btn-reset').addEventListener('click', resetAll);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importJSON);

  // Viewport presets
  document.querySelectorAll('.viewport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = btn.dataset.width;
      if (w === '100%') {
        iframe.style.width = 'calc(100% - 16px)';
        iframe.style.left = '8px';
      } else {
        iframe.style.width = w;
        iframe.style.left = '50%';
        iframe.style.transform = `translateX(-50%)`;
      }
      if (w === '100%') {
        iframe.style.transform = '';
      }
    });
  });

  // Listen for preview ready
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'preview-ready') {
      previewReady = true;
      document.getElementById('preview-status').textContent = 'Preview ready';
      applyAllToPreview();
    }
  });

  // If iframe loads but doesn't send ready (fallback)
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      if (!previewReady) {
        previewReady = true;
        document.getElementById('preview-status').textContent = 'Preview ready';
        applyAllToPreview();
      }
    }, 1000);
  });
}

// ── Build control DOM ────────────────────────────────────────────────

function buildControls() {
  const container = document.getElementById('controls-container');
  container.innerHTML = '';

  for (const group of CONTROL_GROUPS) {
    const details = document.createElement('details');
    details.className = 'control-section';
    // Open first two sections by default
    if (group.title === 'Theme' || group.title === 'Page Colors') {
      details.open = true;
    }

    const summary = document.createElement('summary');
    summary.textContent = group.title;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'control-section-body';

    for (const ctrl of group.controls) {
      body.appendChild(buildControl(ctrl));
    }

    details.appendChild(body);
    container.appendChild(details);
  }
}

function buildControl(ctrl) {
  const row = document.createElement('div');
  row.className = 'control-row';

  const label = document.createElement('span');
  label.className = 'control-label';
  label.textContent = ctrl.label;
  row.appendChild(label);

  if (ctrl.type === 'toggle') {
    row.appendChild(buildToggle(ctrl));
  } else if (ctrl.type === 'color') {
    row.appendChild(buildColorPicker(ctrl));
  } else if (ctrl.type === 'range') {
    row.appendChild(buildRangeSlider(ctrl));
  }

  return row;
}

function buildToggle(ctrl) {
  const wrapper = document.createElement('label');
  wrapper.className = 'control-toggle';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = isDark;
  input.dataset.key = ctrl.key;

  input.addEventListener('change', () => {
    isDark = input.checked;
    onThemeChange();
  });

  const track = document.createElement('span');
  track.className = 'toggle-track';

  wrapper.appendChild(input);
  wrapper.appendChild(track);
  return wrapper;
}

function buildColorPicker(ctrl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'control-color';

  const currentDefaults = isDark ? CSS_DEFAULTS_DARK : CSS_DEFAULTS_LIGHT;
  const currentValue = cssOverrides[ctrl.key] || currentDefaults[ctrl.key] || '#000000';

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = currentValue;
  picker.dataset.key = ctrl.key;

  const text = document.createElement('input');
  text.type = 'text';
  text.value = currentValue;
  text.dataset.key = ctrl.key;

  picker.addEventListener('input', () => {
    text.value = picker.value;
    cssOverrides[ctrl.key] = picker.value;
    scheduleUpdate('css');
  });

  text.addEventListener('change', () => {
    let v = text.value.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
      picker.value = v.length === 4
        ? '#' + v[1]+v[1]+v[2]+v[2]+v[3]+v[3]
        : v;
      cssOverrides[ctrl.key] = picker.value;
      scheduleUpdate('css');
    }
  });

  wrapper.appendChild(picker);
  wrapper.appendChild(text);
  return wrapper;
}

function buildRangeSlider(ctrl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'control-range';

  const currentValue = layoutOverrides[ctrl.key] ?? DEFAULTS[ctrl.key];

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = ctrl.min;
  slider.max = ctrl.max;
  slider.step = ctrl.step;
  slider.value = currentValue;
  slider.dataset.key = ctrl.key;

  const readout = document.createElement('span');
  readout.className = 'range-value';
  readout.textContent = currentValue;

  slider.addEventListener('input', () => {
    readout.textContent = slider.value;
    layoutOverrides[ctrl.key] = Number(slider.value);
    scheduleUpdate('layout');
  });

  wrapper.appendChild(slider);
  wrapper.appendChild(readout);
  return wrapper;
}

// ── Update scheduling (RAF throttle) ─────────────────────────────────

function scheduleUpdate(type) {
  if (!pendingUpdates) {
    pendingUpdates = new Set();
    requestAnimationFrame(flushUpdates);
  }
  pendingUpdates.add(type);
}

function flushUpdates() {
  const types = pendingUpdates;
  pendingUpdates = null;

  if (!previewReady) return;

  if (types.has('css')) {
    applyCSSToPreview();
  }
  if (types.has('layout')) {
    applyLayoutToPreview();
  }

  saveToStorage();
}

// ── Apply to preview iframe ──────────────────────────────────────────

function applyCSSToPreview() {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const root = doc.documentElement;

    // Apply all CSS overrides
    for (const [key, value] of Object.entries(cssOverrides)) {
      root.style.setProperty(key, value);
    }

    // SVG uses inline attrs from getColors(), need re-render
    iframe.contentWindow.postMessage({ type: 'rerender' }, '*');
  } catch (e) {
    // Cross-origin — fall back to postMessage only
    iframe.contentWindow.postMessage({ type: 'rerender' }, '*');
  }
}

function applyLayoutToPreview() {
  const constants = { ...layoutOverrides };
  iframe.contentWindow.postMessage({ type: 'layout-update', constants }, '*');
}

function applyAllToPreview() {
  if (!previewReady) return;

  // Set theme first
  iframe.contentWindow.postMessage({
    type: 'set-theme',
    theme: isDark ? 'dark' : 'light',
  }, '*');

  // Apply CSS overrides
  setTimeout(() => {
    applyCSSToPreview();
    if (Object.keys(layoutOverrides).length > 0) {
      applyLayoutToPreview();
    }
  }, 50);
}

// ── Theme change ─────────────────────────────────────────────────────

function onThemeChange() {
  // Reset CSS overrides when switching theme (defaults differ)
  cssOverrides = {};

  // Update all color pickers to show new theme defaults
  const defaults = isDark ? CSS_DEFAULTS_DARK : CSS_DEFAULTS_LIGHT;
  document.querySelectorAll('.control-color input[type="color"]').forEach(picker => {
    const key = picker.dataset.key;
    const val = defaults[key] || '#000000';
    picker.value = val;
    const text = picker.parentElement.querySelector('input[type="text"]');
    if (text) text.value = val;
  });

  if (previewReady) {
    iframe.contentWindow.postMessage({
      type: 'set-theme',
      theme: isDark ? 'dark' : 'light',
    }, '*');
  }

  saveToStorage();
}

// ── Reset ────────────────────────────────────────────────────────────

function resetAll() {
  isDark = false;
  cssOverrides = {};
  layoutOverrides = {};

  // Reset UI
  const themeToggle = document.querySelector('[data-key="_darkMode"]');
  if (themeToggle) themeToggle.checked = false;

  // Reset color pickers
  const defaults = CSS_DEFAULTS_LIGHT;
  document.querySelectorAll('.control-color input[type="color"]').forEach(picker => {
    const key = picker.dataset.key;
    const val = defaults[key] || '#000000';
    picker.value = val;
    const text = picker.parentElement.querySelector('input[type="text"]');
    if (text) text.value = val;
  });

  // Reset sliders
  document.querySelectorAll('.control-range input[type="range"]').forEach(slider => {
    const key = slider.dataset.key;
    const val = DEFAULTS[key];
    slider.value = val;
    slider.parentElement.querySelector('.range-value').textContent = val;
  });

  if (previewReady) {
    iframe.contentWindow.postMessage({ type: 'set-theme', theme: 'light' }, '*');
    iframe.contentWindow.postMessage({ type: 'reset-layout' }, '*');

    // Clear inline CSS overrides
    try {
      const root = iframe.contentDocument?.documentElement;
      if (root) root.removeAttribute('style');
    } catch (e) { /* cross-origin */ }

    iframe.contentWindow.postMessage({ type: 'rerender' }, '*');
  }

  localStorage.removeItem(STORAGE_KEY);
}

// ── Persistence ──────────────────────────────────────────────────────

function saveToStorage() {
  const state = { isDark, cssOverrides, layoutOverrides };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.isDark !== undefined) isDark = state.isDark;
    if (state.cssOverrides) cssOverrides = state.cssOverrides;
    if (state.layoutOverrides) layoutOverrides = state.layoutOverrides;
  } catch (e) {
    // Ignore corrupt storage
  }
}

// ── Export / Import ──────────────────────────────────────────────────

function exportJSON() {
  const state = { isDark, cssOverrides, layoutOverrides };
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scorecard-styles.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const state = JSON.parse(reader.result);
      if (state.isDark !== undefined) isDark = state.isDark;
      if (state.cssOverrides) cssOverrides = state.cssOverrides;
      if (state.layoutOverrides) layoutOverrides = state.layoutOverrides;

      // Rebuild controls with new values
      buildControls();
      applyAllToPreview();
      saveToStorage();
    } catch (e) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
  // Reset file input so same file can be re-imported
  event.target.value = '';
}

// ── Boot ─────────────────────────────────────────────────────────────

init();
