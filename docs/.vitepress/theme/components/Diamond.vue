<template>
  <div class="component-preview">
    <div class="preview-render">
      <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
        <!-- Diamond outline -->
        <polygon :points="diamondPoints" fill="none" :stroke="colors.text" stroke-width="2.5"/>

        <!-- HR: solid fill -->
        <template v-if="type === 'hr'">
          <polygon :points="diamondPoints" :fill="colors.text" :stroke="colors.text" stroke-width="2.5"/>
          <text :x="cx" :y="cy" text-anchor="middle" dominant-baseline="central" :fill="colors.bg" font-size="20" font-weight="700" font-family="monospace">HR</text>
        </template>

        <!-- Scored: 3 hatch lines -->
        <template v-if="type === 'scored'">
          <defs>
            <clipPath :id="`hatch-${uid}`">
              <polygon :points="diamondPoints"/>
            </clipPath>
          </defs>
          <g :clip-path="`url(#hatch-${uid})`">
            <line v-for="i in 3" :key="i"
              :x1="cx - R - 5" :y1="cy + (i - 2) * R * 0.5 + R + 5"
              :x2="cx + R + 5" :y2="cy + (i - 2) * R * 0.5 - R - 5"
              :stroke="colors.text" stroke-width="2.5"/>
          </g>
        </template>

        <!-- Base paths -->
        <template v-if="bases > 0 && type !== 'hr'">
          <polyline :points="basePath" fill="none" :stroke="colors.text" stroke-width="3"/>
          <!-- Hash marks -->
          <template v-for="h in bases" :key="h">
            <line
              :x1="hashX(h) - hashLen * 0.707" :y1="hashY(h) - hashLen * 0.707"
              :x2="hashX(h) + hashLen * 0.707" :y2="hashY(h) + hashLen * 0.707"
              :stroke="colors.text" stroke-width="2.5"/>
          </template>
        </template>

        <!-- Out marker -->
        <template v-if="outNumber">
          <circle :cx="outMarkerX" :cy="outMarkerY" r="12" fill="#666"/>
          <text :x="outMarkerX" :y="outMarkerY" text-anchor="middle" dominant-baseline="central" fill="white" font-size="12" font-weight="700">{{ outNumber }}</text>
        </template>
      </svg>
    </div>
    <div class="preview-info">
      <div class="preview-label">{{ label }}</div>
      <div class="preview-desc" v-if="description">{{ description }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, default: 'empty' },
  bases: { type: Number, default: 0 },
  outNumber: { type: Number, default: 0 },
  label: { type: String, default: '' },
  description: { type: String, default: '' },
  size: { type: Number, default: 120 },
})

const uid = Math.random().toString(36).slice(2, 8)
const R = computed(() => props.size * 0.33)
const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)

const colors = {
  text: 'var(--vp-c-text-1)',
  bg: 'var(--vp-c-bg)',
}

const basePoints = computed(() => [
  { x: cx.value, y: cy.value + R.value },           // HP
  { x: cx.value + R.value, y: cy.value },            // 1B
  { x: cx.value, y: cy.value - R.value },            // 2B
  { x: cx.value - R.value, y: cy.value },            // 3B
])

const diamondPoints = computed(() =>
  basePoints.value.map(p => `${p.x},${p.y}`).join(' ')
)

const basePath = computed(() =>
  basePoints.value.slice(0, props.bases + 1).map(p => `${p.x},${p.y}`).join(' ')
)

const hashLen = computed(() => 15.5 * R.value / 67)
const hashSpacing = computed(() => 13.7 * R.value / 67)

function hashX(h) {
  const mid = (basePoints.value[0].x + basePoints.value[1].x) / 2
  const offset = (h - 1 - (props.bases - 1) / 2) * hashSpacing.value
  return mid + offset * 0.707
}

function hashY(h) {
  const mid = (basePoints.value[0].y + basePoints.value[1].y) / 2
  const offset = (h - 1 - (props.bases - 1) / 2) * hashSpacing.value
  return mid - offset * 0.707
}

const outMarkerX = computed(() => cx.value + 2 + 12)
const outMarkerY = computed(() => cy.value - R.value - 2 + 12)
</script>
