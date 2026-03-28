<template>
  <div class="component-preview">
    <div class="preview-render">
      <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`">
        <!-- Cell background -->
        <rect x="0" y="0" :width="w" :height="h" :fill="cellBg" :stroke="colors.grid" stroke-width="1"/>

        <!-- PH sub line (left) -->
        <template v-if="ph">
          <rect v-for="i in dotCount" :key="'ph'+i" x="4" :y="4 + (i-1) * 9" width="5" height="5" :fill="colors.sub"/>
        </template>

        <!-- PR sub line (right) -->
        <template v-if="pr">
          <rect v-for="i in dotCount" :key="'pr'+i" :x="w - 9" :y="4 + (i-1) * 9" width="5" height="5" :fill="colors.sub"/>
        </template>

        <!-- Out badge -->
        <template v-if="out">
          <circle cx="24" cy="24" r="12" fill="#666"/>
          <text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="white" font-size="12" font-weight="700">{{ out }}</text>
        </template>

        <!-- Count -->
        <text v-if="count" :x="w/2 + 20" y="18" text-anchor="middle" :fill="colors.text" font-size="12" font-family="monospace">{{ count }}</text>

        <!-- Diamond area -->
        <g :transform="`translate(${w * 0.35}, ${h * 0.42})`">
          <polygon :points="miniDiamond" fill="none" :stroke="colors.text" stroke-width="2"/>

          <!-- HR fill -->
          <template v-if="notation === 'HR'">
            <polygon :points="miniDiamond" :fill="colors.text"/>
            <text x="0" y="0" text-anchor="middle" dominant-baseline="central" :fill="cellBg" font-size="14" font-weight="700" font-family="monospace">HR</text>
          </template>

          <!-- Scored hatch -->
          <template v-if="scored && notation !== 'HR'">
            <defs>
              <clipPath :id="`pc-hatch-${uid}`">
                <polygon :points="miniDiamond"/>
              </clipPath>
            </defs>
            <g :clip-path="`url(#pc-hatch-${uid})`">
              <line v-for="i in 3" :key="i" :x1="-30" :y1="(i-2)*12 + 30" :x2="30" :y2="(i-2)*12 - 30" :stroke="colors.text" stroke-width="2"/>
            </g>
          </template>

          <!-- Base path for hits -->
          <polyline v-if="basePath" :points="basePath" fill="none" :stroke="colors.text" stroke-width="2.5"/>

          <!-- Hash marks -->
          <template v-if="hashes > 0">
            <line v-for="h in hashes" :key="h"
              :x1="hashPt(h).x1" :y1="hashPt(h).y1"
              :x2="hashPt(h).x2" :y2="hashPt(h).y2"
              :stroke="colors.text" stroke-width="2"/>
          </template>
        </g>

        <!-- Notation text (when no diamond needed) -->
        <text v-if="showNotation" :x="w * 0.35" :y="h * 0.48" text-anchor="middle" dominant-baseline="central"
          :fill="colors.text" :font-size="notationSize" :font-weight="notationWeight" font-family="monospace">
          {{ notation }}
        </text>

        <!-- Pitch sequence -->
        <template v-if="pitches.length">
          <text v-for="(p, i) in pitches" :key="i" :x="w - 16" :y="22 + i * 14" text-anchor="end"
            :fill="pitchColor(p)" font-size="10" :font-weight="p.inPlay ? '700' : '400'" font-family="monospace">
            {{ p.speed }} {{ p.type }}
          </text>
        </template>

        <!-- RBI diamonds -->
        <template v-if="rbi">
          <polygon v-for="r in rbi" :key="r"
            :points="`${12 + (r-1)*16},${h-10} ${18 + (r-1)*16},${h-16} ${24 + (r-1)*16},${h-10} ${18 + (r-1)*16},${h-4}`"
            :fill="colors.text"/>
        </template>

        <!-- Pitcher change line -->
        <template v-if="pitcherChange">
          <rect v-for="i in 8" :key="'psub'+i" :x="4 + (i-1) * 9" :y="h - 3" width="5" height="5" :fill="colors.pitcher"/>
        </template>

        <!-- Third out notch -->
        <template v-if="thirdOut">
          <line :x1="w - 16" :y1="h - 4" :x2="w - 4" :y2="h - 16" :stroke="colors.text" stroke-width="2"/>
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
  notation: { type: String, default: '' },
  out: { type: Number, default: 0 },
  count: { type: String, default: '' },
  rbi: { type: Number, default: 0 },
  ph: { type: Boolean, default: false },
  pr: { type: Boolean, default: false },
  scored: { type: Boolean, default: false },
  thirdOut: { type: Boolean, default: false },
  pitcherChange: { type: Boolean, default: false },
  hashes: { type: Number, default: 0 },
  pitches: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  description: { type: String, default: '' },
  w: { type: Number, default: 160 },
  h: { type: Number, default: 160 },
})

const uid = Math.random().toString(36).slice(2, 8)
const R = 24
const dotCount = computed(() => Math.floor((props.h - 8) / 9))

const colors = {
  text: 'var(--vp-c-text-1)',
  grid: 'var(--vp-c-divider)',
  sub: 'var(--vp-c-text-3)',
  pitcher: '#2a6d8d',
}

const cellBg = 'var(--vp-c-bg)'

const miniDiamond = `0,${R} ${R},0 0,${-R} ${-R},0`

const basePoints = [
  { x: 0, y: R },
  { x: R, y: 0 },
  { x: 0, y: -R },
  { x: -R, y: 0 },
]

const basePath = computed(() => {
  if (props.hashes === 0) return null
  return basePoints.slice(0, props.hashes + 1).map(p => `${p.x},${p.y}`).join(' ')
})

function hashPt(h) {
  const mx = (basePoints[0].x + basePoints[1].x) / 2
  const my = (basePoints[0].y + basePoints[1].y) / 2
  const sp = 6
  const len = 7
  const offset = (h - 1 - (props.hashes - 1) / 2) * sp
  const hx = mx + offset * 0.707
  const hy = my - offset * 0.707
  return {
    x1: hx - len * 0.707, y1: hy - len * 0.707,
    x2: hx + len * 0.707, y2: hy + len * 0.707,
  }
}

const showNotation = computed(() => {
  if (!props.notation) return false
  if (props.notation === 'HR') return false
  if (['1B', '2B', '3B'].includes(props.notation)) return false
  return true
})

const notationSize = computed(() => {
  const n = props.notation
  if (['BB', 'IBB', 'HBP'].includes(n)) return '28'
  if (['K'].includes(n)) return '32'
  return '22'
})

const notationWeight = computed(() => {
  const n = props.notation
  if (['BB', 'IBB', 'HBP'].includes(n)) return '900'
  return '400'
})

function pitchColor(p) {
  if (p.inPlay) return '#377049'
  if (p.strike) return '#a04a49'
  return 'var(--vp-c-text-1)'
}
</script>
