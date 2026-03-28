<template>
  <div class="swatch-row">
    <div class="swatch-box" :style="{ background: hex, border: light ? '1px solid var(--vp-c-divider)' : 'none' }"></div>
    <div class="swatch-info">
      <div class="swatch-name">{{ name }}</div>
      <code class="swatch-hex">{{ hex }}</code>
      <span class="swatch-token" v-if="token">{{ token }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  name: String,
  hex: String,
  token: { type: String, default: '' },
  light: { type: Boolean, default: false },
})
</script>

<style scoped>
.swatch-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.swatch-box { width: 48px; height: 48px; border-radius: 6px; flex-shrink: 0; }
.swatch-info { display: flex; flex-direction: column; gap: 2px; }
.swatch-name { font-weight: 600; font-size: 0.95em; }
.swatch-hex { font-size: 0.8em; }
.swatch-token { font-size: 0.75em; color: var(--vp-c-text-3); }
</style>
