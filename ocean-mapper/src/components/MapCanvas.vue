<template>
  <section class="card map-card">
    <h2>マッピング</h2>
    <div class="card-body">
      <div class="map-toolbar">
        <div class="map-meta">{{ mapMeta }}</div>
        <div class="button-row">
          <button class="secondary" @click="fitMap">地図を再描画</button>
          <button class="danger" @click="$emit('clear-history')">履歴を全削除</button>
        </div>
      </div>
      <div class="map-wrap">
        <svg
          ref="svgEl"
          viewBox="0 0 900 560"
          role="img"
          aria-label="ポイントマップ"
          @wheel.prevent="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <!-- Background -->
          <rect x="0" y="0" :width="MAP_W" :height="MAP_H" fill="transparent" />

          <!-- Grid lines -->
          <template v-for="val in gridValues" :key="'g' + val">
            <line
              :x1="sx(val)" :y1="margin"
              :x2="sx(val)" :y2="MAP_H - margin"
              :stroke="gridStrokeColor(val)"
              :stroke-width="gridStrokeWidth(val)"
            />
            <line
              :x1="margin" :y1="sy(val)"
              :x2="MAP_W - margin" :y2="sy(val)"
              :stroke="gridStrokeColor(val)"
              :stroke-width="gridStrokeWidth(val)"
            />
            <template v-if="isLabel(val) && val !== 0">
              <text
                :x="sx(val)" :y="originY + 12 * z"
                fill="rgba(159,193,217,0.55)" :font-size="6.5 * z" text-anchor="middle"
              >{{ val }}</text>
              <text
                :x="originX - 4 * z" :y="sy(val)"
                fill="rgba(159,193,217,0.55)" :font-size="6.5 * z" text-anchor="end" dominant-baseline="middle"
              >{{ val }}</text>
            </template>
          </template>

          <!-- Axes -->
          <line
            :x1="originX" :y1="margin - 10"
            :x2="originX" :y2="MAP_H - margin + 10"
            stroke="rgba(105,240,174,0.45)" :stroke-width="1.5 * z"
          />
          <line
            :x1="margin - 10" :y1="originY"
            :x2="MAP_W - margin + 10" :y2="originY"
            stroke="rgba(67,198,255,0.45)" :stroke-width="1.5 * z"
          />

          <!-- Direction labels -->
          <text :x="originX" :y="margin - 14 * z" fill="#b8ffcf" text-anchor="middle" :font-size="8 * z" font-weight="700">北 / y+</text>
          <text :x="originX" :y="MAP_H - margin + 24 * z" fill="#b8ffcf" text-anchor="middle" :font-size="8 * z" font-weight="700">南 / y-</text>
          <text :x="MAP_W - margin + 24 * z" :y="originY + 3 * z" fill="#8be9fd" text-anchor="middle" :font-size="8 * z" font-weight="700">東 / x+</text>
          <text :x="margin - 24 * z" :y="originY + 3 * z" fill="#8be9fd" text-anchor="middle" :font-size="8 * z" font-weight="700">西 / x-</text>

          <!-- Origin point -->
          <circle :cx="originX" :cy="originY" :r="4 * z" fill="#ffffff" />
          <text :x="originX + 6 * z" :y="originY - 6 * z" fill="#ffffff" :font-size="7.5 * z" font-weight="700">基準点</text>

          <!-- Preview point (dashed) -->
          <template v-if="previewPoint">
            <g :opacity="0.62">
              <text
                :x="sx(previewPoint.x)" :y="sy(previewPoint.y) + 3 * z"
                text-anchor="middle" dominant-baseline="middle" :font-size="10 * z"
              >{{ previewPoint.icon }}</text>
              <text
                :x="sx(previewPoint.x) + 9 * z" :y="sy(previewPoint.y) + 3 * z"
                fill="#eef7ff" :font-size="7.5 * z" font-weight="700" dominant-baseline="middle"
              >{{ previewPoint.name }} [preview]</text>
            </g>
          </template>

          <!-- History points -->
          <g v-for="p in points" :key="p.id">
            <text
              :x="sx(p.x)" :y="sy(p.y) + 3 * z"
              text-anchor="middle" dominant-baseline="middle" :font-size="10 * z"
            >{{ p.icon }}</text>
            <text
              :x="sx(p.x) + 9 * z" :y="sy(p.y) + 3 * z"
              fill="#eef7ff" :font-size="7.5 * z" font-weight="700" dominant-baseline="middle"
            >{{ p.name }}</text>
          </g>

          <!-- Distance measurement line -->
          <template v-if="distanceResult && resolvedA && resolvedB">
            <line
              :x1="sx(resolvedA.x)" :y1="sy(resolvedA.y)"
              :x2="sx(resolvedB.x)" :y2="sy(resolvedB.y)"
              stroke="#ffd166" :stroke-width="2 * z"
              stroke-dasharray="8,5"
              opacity="0.85"
            />
            <circle :cx="sx(resolvedA.x)" :cy="sy(resolvedA.y)" :r="5 * z" fill="#ffd166" opacity="0.7" />
            <circle :cx="sx(resolvedB.x)" :cy="sy(resolvedB.y)" :r="5 * z" fill="#ffd166" opacity="0.7" />
            <rect
              :x="(sx(resolvedA.x) + sx(resolvedB.x)) / 2 - 42 * z"
              :y="(sy(resolvedA.y) + sy(resolvedB.y)) / 2 - 10 * z"
              :width="84 * z" :height="16 * z"
              :rx="4 * z"
              fill="rgba(4,17,29,0.82)" stroke="#ffd166" :stroke-width="0.8 * z"
            />
            <text
              :x="(sx(resolvedA.x) + sx(resolvedB.x)) / 2"
              :y="(sy(resolvedA.y) + sy(resolvedB.y)) / 2 + 1 * z"
              fill="#ffd166" :font-size="7.5 * z" font-weight="700"
              text-anchor="middle" dominant-baseline="middle"
            >{{ formatNumber(distanceResult.distance2d, 1) }} m</text>
          </template>
        </svg>
      </div>

      <!-- Distance measurement panel -->
      <div class="measure-panel">
        <div class="measure-header">
          <p class="measure-title">📏 距離計測</p>
          <button v-if="measureA || measureB" class="secondary measure-reset" @click="resetMeasure">リセット</button>
        </div>
        <div class="measure-selectors">
          <label class="measure-label">
            ポイントA
            <select v-model="measureA">
              <option value="" disabled>選択してください</option>
              <option
                v-for="p in selectablePoints"
                :key="'a-' + p.id"
                :value="p.id"
                :disabled="p.id === measureB"
              >{{ p.icon }} {{ p.name }}</option>
            </select>
          </label>
          <span class="measure-arrow">⟷</span>
          <label class="measure-label">
            ポイントB
            <select v-model="measureB">
              <option value="" disabled>選択してください</option>
              <option
                v-for="p in selectablePoints"
                :key="'b-' + p.id"
                :value="p.id"
                :disabled="p.id === measureA"
              >{{ p.icon }} {{ p.name }}</option>
            </select>
          </label>
        </div>
        <div v-if="distanceResult" class="measure-results">
          <div class="measure-metric">
            <span>3D距離</span>
            <strong>{{ formatNumber(distanceResult.distance3d) }} m</strong>
          </div>
          <div class="measure-metric">
            <span>水平距離</span>
            <strong>{{ formatNumber(distanceResult.distance2d) }} m</strong>
          </div>
          <div class="measure-metric">
            <span>深度差</span>
            <strong>{{ formatNumber(distanceResult.depthDiff) }} m</strong>
          </div>
          <div class="measure-metric">
            <span>方位角 (A→B)</span>
            <strong>{{ formatNumber(distanceResult.bearing) }}°</strong>
          </div>
        </div>
        <div v-else-if="measureA && measureB && measureA === measureB" class="measure-hint">
          異なるポイントを選択してください。
        </div>
        <div v-else class="measure-hint">
          2つのポイントを選択すると距離を計測します。
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { MapPoint } from '../types/point'
import { formatNumber, calculatePointDistance } from '../utils/coordinate'

const props = defineProps<{
  points: MapPoint[]
  previewPoint: MapPoint | null
}>()

defineEmits<{
  'clear-history': []
}>()

const MAP_W = 900
const MAP_H = 560
const margin = 60

const svgEl = ref<SVGSVGElement | null>(null)

// Pan/zoom state
const mapView = ref({ x: 0, y: 0, w: MAP_W, h: MAP_H })
const panState = ref({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })
const pinchDist0 = ref<number | null>(null)
const pinchView0 = ref<{ x: number; y: number; w: number; h: number } | null>(null)

// Computed map scale
const allPoints = computed(() => {
  const list = [...props.points]
  if (props.previewPoint) {
    list.push(props.previewPoint)
  }
  return list
})

const maxAbs = computed(() => {
  return Math.max(
    100,
    ...allPoints.value.map((p) => Math.abs(p.x) || 0),
    ...allPoints.value.map((p) => Math.abs(p.y) || 0),
  )
})

const range = computed(() => maxAbs.value * 1.18)
const plotW = MAP_W - margin * 2
const plotH = MAP_H - margin * 2
const scale = computed(() => Math.min(plotW / (range.value * 2), plotH / (range.value * 2)))
const originX = MAP_W / 2
const originY = MAP_H / 2

const labelStep = 200
const majorStep = 100
const minorStep = 10
const axisMax = computed(() => Math.ceil(range.value / labelStep) * labelStep)

const gridValues = computed(() => {
  const vals: number[] = []
  const ax = axisMax.value
  for (let i = -ax; i <= ax + minorStep / 2; i += minorStep) {
    vals.push(Math.round(i))
  }
  return vals
})

function sx(x: number): number {
  return originX + x * scale.value
}

function sy(y: number): number {
  return originY - y * scale.value
}

function isOrigin(val: number): boolean { return val === 0 }
function isMajor(val: number): boolean { return val % majorStep === 0 }
function isLabel(val: number): boolean { return val % labelStep === 0 }

function gridStrokeColor(val: number): string {
  if (isOrigin(val)) return 'rgba(255,255,255,0.32)'
  if (isMajor(val)) return 'rgba(255,255,255,0.16)'
  return 'rgba(255,255,255,0.05)'
}

function gridStrokeWidth(val: number): number {
  const z = zoomRatio.value
  if (isOrigin(val)) return 1.5 * z
  if (isMajor(val)) return 0.7 * z
  return 0.3 * z
}

// Zoom ratio: scales down SVG element sizes when zoomed in so they stay visually constant
const zoomRatio = computed(() => mapView.value.w / MAP_W)
const z = computed(() => zoomRatio.value)

const mapMeta = computed(() => {
  return `表示範囲：±${formatNumber(axisMax.value, 0)} m　ポイント：${props.points.length}　細線：${minorStep} m / 太線：${majorStep} m / ラベル：${labelStep} m　ホイール/ドラッグで操作`
})

// Apply viewBox to SVG element
function applyViewBox(): void {
  if (svgEl.value) {
    const v = mapView.value
    svgEl.value.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`)
  }
}

function fitMap(): void {
  mapView.value = { x: 0, y: 0, w: MAP_W, h: MAP_H }
  applyViewBox()
}

function svgPoint(clientX: number, clientY: number): { x: number; y: number } {
  const rect = svgEl.value!.getBoundingClientRect()
  return {
    x: mapView.value.x + (clientX - rect.left) / rect.width * mapView.value.w,
    y: mapView.value.y + (clientY - rect.top) / rect.height * mapView.value.h,
  }
}

function zoomMapAt(clientX: number, clientY: number, factor: number): void {
  const minW = 80
  const maxW = MAP_W * 12
  const newW = Math.min(Math.max(mapView.value.w * factor, minW), maxW)
  const newH = newW * (MAP_H / MAP_W)
  const pt = svgPoint(clientX, clientY)
  mapView.value.x = pt.x - (pt.x - mapView.value.x) * (newW / mapView.value.w)
  mapView.value.y = pt.y - (pt.y - mapView.value.y) * (newH / mapView.value.h)
  mapView.value.w = newW
  mapView.value.h = newH
  applyViewBox()
}

// Wheel zoom
function onWheel(e: WheelEvent): void {
  const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18
  zoomMapAt(e.clientX, e.clientY, factor)
}

// Pointer pan (mouse only)
function onPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'touch') return
  panState.value = {
    active: true,
    startX: e.clientX,
    startY: e.clientY,
    originX: mapView.value.x,
    originY: mapView.value.y,
  }
  svgEl.value?.setPointerCapture(e.pointerId)
  svgEl.value?.classList.add('panning')
}

function onPointerMove(e: PointerEvent): void {
  if (!panState.value.active) return
  const rect = svgEl.value!.getBoundingClientRect()
  const dx = (e.clientX - panState.value.startX) / rect.width * mapView.value.w
  const dy = (e.clientY - panState.value.startY) / rect.height * mapView.value.h
  mapView.value.x = panState.value.originX - dx
  mapView.value.y = panState.value.originY - dy
  applyViewBox()
}

function onPointerUp(): void {
  panState.value.active = false
  svgEl.value?.classList.remove('panning')
}

// Touch: pinch zoom + pan
function touchDist(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 1) {
    panState.value = {
      active: true,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      originX: mapView.value.x,
      originY: mapView.value.y,
    }
    pinchDist0.value = null
  } else if (e.touches.length === 2) {
    panState.value.active = false
    pinchDist0.value = touchDist(e.touches)
    pinchView0.value = { ...mapView.value }
  }
}

function onTouchMove(e: TouchEvent): void {
  if (e.touches.length === 1 && panState.value.active) {
    const rect = svgEl.value!.getBoundingClientRect()
    const dx = (e.touches[0].clientX - panState.value.startX) / rect.width * mapView.value.w
    const dy = (e.touches[0].clientY - panState.value.startY) / rect.height * mapView.value.h
    mapView.value.x = panState.value.originX - dx
    mapView.value.y = panState.value.originY - dy
    applyViewBox()
  } else if (e.touches.length === 2 && pinchDist0.value !== null && pinchView0.value !== null) {
    const dist = touchDist(e.touches)
    const factor = pinchDist0.value / dist
    const minW = 80
    const maxW = MAP_W * 12
    const newW = Math.min(Math.max(pinchView0.value.w * factor, minW), maxW)
    const newH = newW * (MAP_H / MAP_W)
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
    const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
    const rect = svgEl.value!.getBoundingClientRect()
    const ptX = pinchView0.value.x + (cx - rect.left) / rect.width * pinchView0.value.w
    const ptY = pinchView0.value.y + (cy - rect.top) / rect.height * pinchView0.value.h
    mapView.value.x = ptX - (ptX - pinchView0.value.x) * (newW / pinchView0.value.w)
    mapView.value.y = ptY - (ptY - pinchView0.value.y) * (newH / pinchView0.value.h)
    mapView.value.w = newW
    mapView.value.h = newH
    applyViewBox()
  }
}

function onTouchEnd(): void {
  panState.value.active = false
  pinchDist0.value = null
}

// ── Distance measurement ──
const ORIGIN_POINT = { id: '__origin__', name: '基準点', icon: '⊕', x: 0, y: 0, z: 0 }

const measureA = ref<string>('')
const measureB = ref<string>('')

function resetMeasure(): void {
  measureA.value = ''
  measureB.value = ''
}

const selectablePoints = computed(() => {
  return [ORIGIN_POINT, ...props.points]
})

const resolvedA = computed(() => selectablePoints.value.find(p => p.id === measureA.value) ?? null)
const resolvedB = computed(() => selectablePoints.value.find(p => p.id === measureB.value) ?? null)

const distanceResult = computed(() => {
  if (!resolvedA.value || !resolvedB.value) return null
  if (resolvedA.value.id === resolvedB.value.id) return null
  return calculatePointDistance(resolvedA.value, resolvedB.value)
})

// Auto-clear selection when points change
watch(() => props.points, () => {
  if (measureA.value && measureA.value !== ORIGIN_POINT.id && !props.points.find(p => p.id === measureA.value)) {
    measureA.value = ORIGIN_POINT.id
  }
  if (measureB.value && measureB.value !== ORIGIN_POINT.id && !props.points.find(p => p.id === measureB.value)) {
    measureB.value = ''
  }
}, { deep: true })

// Reapply viewBox when points change
watch(allPoints, () => {
  applyViewBox()
})

onMounted(() => {
  applyViewBox()
})
</script>

<style scoped>
svg {
  width: 100%;
  min-height: 520px;
  display: block;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background:
    radial-gradient(circle at 50% 50%, rgba(67, 198, 255, 0.06), transparent 32%),
    rgba(1, 10, 18, 0.28);
}

svg.panning {
  cursor: grabbing;
}

/* ── Distance measurement panel ── */
.measure-panel {
  margin-top: 16px;
  background: rgba(4, 17, 29, 0.48);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px 20px;
}

.measure-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.measure-title {
  margin: 0;
  font-weight: 800;
  font-size: 1rem;
  color: #ffd166;
  letter-spacing: 0.02em;
}

.measure-selectors {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
}

.measure-label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 0.9rem;
  flex: 1;
  min-width: 140px;
}

.measure-arrow {
  color: var(--muted);
  font-size: 1.4rem;
  padding-bottom: 10px;
  flex: none;
}

.measure-results {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.measure-metric {
  background: rgba(255, 209, 102, 0.08);
  border: 1px solid rgba(255, 209, 102, 0.22);
  border-radius: 12px;
  padding: 14px;
  display: grid;
  gap: 6px;
}

.measure-metric span {
  color: var(--muted);
  font-size: 0.84rem;
}

.measure-metric strong {
  font-family: var(--mono);
  font-size: clamp(1rem, 2vw, 1.35rem);
  color: #ffd166;
  line-height: 1.2;
}

.measure-hint {
  margin-top: 14px;
  color: var(--muted);
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  svg {
    min-height: 420px;
  }

  .measure-selectors {
    flex-direction: column;
    align-items: stretch;
  }

  .measure-arrow {
    text-align: center;
    padding-bottom: 0;
  }

  .measure-results {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
