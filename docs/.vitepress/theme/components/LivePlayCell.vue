<template>
  <div class="live-cell-wrapper">
    <div ref="cellContainer" class="live-cell-container"></div>
    <div class="live-cell-label" v-if="label">{{ label }}</div>
    <div class="live-cell-desc" v-if="description">{{ description }}</div>
    <div class="live-cell-error" v-if="error">{{ error }}</div>
  </div>
</template>

<script>
export default {
  props: {
    notation: { type: String, default: '' },
    out: { type: Number, default: 0 },
    rbi: { type: Number, default: 0 },
    runners: { type: Array, default: () => [] },
    pitches: { type: Array, default: () => [] },
    label: { type: String, default: '' },
    description: { type: String, default: '' },
    size: { type: Number, default: 200 },
  },
  data() {
    return { error: null }
  },
  mounted() {
    this.render()
    this._observer = new MutationObserver(() => this.render())
    this._observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  },
  beforeUnmount() {
    if (this._observer) this._observer.disconnect()
  },
  methods: {
    async render() {
      if (!this.$refs.cellContainer) return
      try {
        const mod = await import('@scorecard/svg-renderer.js')
        const { drawAtBatCell, getColors, refreshLayout } = mod

        const L = refreshLayout()
        const CLR = getColors()
        const W = L.COL_WIDTH
        const H = L.ROW_HEIGHT

        const ab = {
          batterId: 1,
          notation: this.notation,
          outNumber: this.out || null,
          pitchSequence: this.pitches.map(p => ({
            callCode: p.call || 'X',
            speed: p.speed,
            typeCode: p.type,
          })),
          cumulativeRunners: this.runners,
          result: { rbi: this.rbi },
        }

        const ns = 'http://www.w3.org/2000/svg'
        const svg = document.createElementNS(ns, 'svg')
        svg.setAttribute('width', this.size)
        svg.setAttribute('height', this.size)
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`)

        const rect = document.createElementNS(ns, 'rect')
        rect.setAttribute('width', W)
        rect.setAttribute('height', H)
        rect.setAttribute('fill', CLR.cellBg)
        rect.setAttribute('stroke', CLR.grid)
        rect.setAttribute('stroke-width', '1')
        svg.appendChild(rect)

        drawAtBatCell(svg, CLR, ab, 0, 0, false)

        this.$refs.cellContainer.innerHTML = ''
        this.$refs.cellContainer.appendChild(svg)
        this.error = null
      } catch (e) {
        this.error = e.message
        console.error('LivePlayCell:', e)
      }
    }
  }
}
</script>

<style scoped>
.live-cell-wrapper { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.live-cell-container { border: 1px solid var(--vp-c-divider); border-radius: 4px; overflow: hidden; line-height: 0; }
.live-cell-label { font-weight: 600; font-size: 0.85em; }
.live-cell-desc { font-size: 0.75em; color: var(--vp-c-text-3); max-width: 180px; text-align: center; }
.live-cell-error { font-size: 0.7em; color: red; max-width: 200px; word-break: break-all; }
</style>
