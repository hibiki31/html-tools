<template>
  <div class="compass-tape-wrap">
    <!-- ヘッダー -->
    <div class="tape-header">
      <span class="tape-label">方角 [°]</span>
      <span class="tape-badge">{{ displayDeg }}°</span>
    </div>

    <!-- テープ本体 -->
    <div
      class="tape-svg-wrap"
      @mousedown.prevent="onMouseDown"
      @touchstart.prevent="onTouchStart"
      style="cursor: ew-resize; user-select: none; touch-action: none;"
    >
      <svg
        ref="svgRef"
        viewBox="0 0 480 88"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="方位計テープ"
        style="display: block; width: 100%; height: auto;"
      >
        <defs>
          <!-- テープ内コンテンツのクリップ -->
          <clipPath id="tapeClip">
            <rect x="0" y="16" width="480" height="72" />
          </clipPath>
        </defs>

        <!-- 背景 -->
        <rect width="480" height="88" rx="14" fill="rgba(4,17,29,0.82)" />

        <!-- クリップされたコンテンツ群 -->
        <g clip-path="url(#tapeClip)">
          <!-- 目盛り線 -->
          <line
            v-for="t in tickData"
            :key="`tick-${t.rawDeg}`"
            :x1="t.x" :x2="t.x"
            :y1="TICK_TOP"
            :y2="t.tickBottom"
            :stroke="t.isCardinal ? 'rgba(67,198,255,0.9)' : (t.is30 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)')"
            :stroke-width="t.isCardinal ? 2 : 1"
          />

          <!-- 方位ラベル（日本語、45° 刻み） -->
          <text
            v-for="t in cardinalTicks"
            :key="`lbl-${t.rawDeg}`"
            :x="t.x"
            :y="CARDINAL_Y"
            text-anchor="middle"
            dominant-baseline="middle"
            :fill="t.normDeg === 0 ? '#ff8585' : 'rgba(220,240,255,0.92)'"
            :font-size="t.normDeg % 90 === 0 ? 14 : 12"
            :font-weight="t.normDeg % 90 === 0 ? '700' : '500'"
            font-family="system-ui, sans-serif"
            style="pointer-events: none"
          >{{ t.cardinalLabel }}</text>

          <!-- 度数ラベル（15° 刻み、45° 以外） -->
          <text
            v-for="t in nonCardinalTicks"
            :key="`num-${t.rawDeg}`"
            :x="t.x"
            :y="DEG_Y"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="rgba(159,193,217,0.75)"
            font-size="11"
            font-family="ui-monospace, monospace"
            style="pointer-events: none"
          >{{ t.normDeg }}</text>
        </g>

        <!-- 上部区切り線 -->
        <line x1="0" y1="16" x2="480" y2="16" stroke="rgba(67,198,255,0.3)" stroke-width="1" />

        <!-- 中央の薄いガイドライン -->
        <line x1="240" y1="16" x2="240" y2="88"
          stroke="rgba(67,198,255,0.18)" stroke-width="1" stroke-dasharray="4,4" />

        <!-- ポインター三角▼（固定・最前面） -->
        <polygon points="232,1 248,1 240,13" fill="#43c6ff" />
        <line x1="240" y1="1" x2="240" y2="16" stroke="#43c6ff" stroke-width="1.5" />
      </svg>
    </div>

    <!-- 精密入力 -->
    <div class="tape-number-row">
      <input
        type="number"
        inputmode="decimal"
        min="0"
        max="360"
        step="1"
        :value="roundedValue"
        @input="onNumberInput"
        @change="onNumberChange"
        class="tape-number-input"
        placeholder="0"
      />
      <span class="tape-unit">°</span>
    </div>
    <p class="tape-hint">テープを左右にドラッグして方位を設定、または数値を直接入力</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

// ────────────────────────────────────────────
// Props / Emits
// ────────────────────────────────────────────
const props = defineProps<{ modelValue: number | '' }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

// ────────────────────────────────────────────
// SVG レイアウト定数
// ────────────────────────────────────────────
const SVG_W = 480
const CX = SVG_W / 2           // 240
const PX_PER_DEG = 4            // 480px ÷ 120° = 4px/°
const VISIBLE_HALF = 60         // 中心から ±60°（計 120°）

const TICK_TOP = 16
const CARDINAL_TICK_BOTTOM = 44 // 45° 刻み（長い目盛り）
const DEG30_TICK_BOTTOM = 34    // 30° 刻み（中程度）
const DEG15_TICK_BOTTOM = 25    // 15° 刻み（短い）
const CARDINAL_Y = 59           // 方位ラベルの Y
const DEG_Y = 77                // 度数ラベルの Y

// ────────────────────────────────────────────
// 方位名（日本語）
// ────────────────────────────────────────────
const CARDINAL_LABELS: Record<number, string> = {
  0: '北', 45: '北東', 90: '東', 135: '南東',
  180: '南', 225: '南西', 270: '西', 315: '北西',
}

// ────────────────────────────────────────────
// 現在の方位（0〜360）
// ────────────────────────────────────────────
const currentDeg = computed<number>(() => {
  const v = props.modelValue
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return 0
  return ((Number(v) % 360) + 360) % 360
})

const displayDeg = computed(() => {
  const v = props.modelValue
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return '---'
  return Number(v).toFixed(1)
})

const roundedValue = computed(() => {
  const v = props.modelValue
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return ''
  return Number(v)
})

// ────────────────────────────────────────────
// 表示するティックデータを計算
// ────────────────────────────────────────────
interface TickInfo {
  rawDeg: number    // アンラップ済み角度（負値や360超も有り）
  normDeg: number   // 正規化 0〜359
  x: number         // SVG X 座標
  tickBottom: number
  isCardinal: boolean
  is30: boolean
  cardinalLabel: string
}

const tickData = computed<TickInfo[]>(() => {
  const bearing = currentDeg.value
  const minDeg = bearing - VISIBLE_HALF
  const maxDeg = bearing + VISIBLE_HALF

  // 表示範囲内の 15° 倍数を列挙
  const startTick = Math.ceil(minDeg / 15) * 15
  const ticks: TickInfo[] = []

  for (let d = startTick; d <= maxDeg; d += 15) {
    const norm = ((d % 360) + 360) % 360
    const isCardinal = norm % 45 === 0
    const is30 = norm % 30 === 0

    ticks.push({
      rawDeg: d,
      normDeg: norm,
      x: CX + (d - bearing) * PX_PER_DEG,
      tickBottom: isCardinal ? CARDINAL_TICK_BOTTOM : (is30 ? DEG30_TICK_BOTTOM : DEG15_TICK_BOTTOM),
      isCardinal,
      is30,
      cardinalLabel: CARDINAL_LABELS[norm] ?? '',
    })
  }
  return ticks
})

const cardinalTicks = computed(() => tickData.value.filter(t => t.isCardinal))
const nonCardinalTicks = computed(() => tickData.value.filter(t => !t.isCardinal))

// ────────────────────────────────────────────
// マウス / タッチ操作
// ────────────────────────────────────────────
const svgRef = ref<SVGSVGElement | null>(null)
let dragStartX = 0
let dragStartBearing = 0
let isDragging = false

/** スクリーン px → SVG px の比率を求める */
function svgScale(): number {
  const el = svgRef.value
  if (!el) return 1
  const rect = el.getBoundingClientRect()
  return SVG_W / (rect.width || SVG_W)
}

function applyDrag(clientX: number) {
  const dx = clientX - dragStartX
  const dBearing = -(dx * svgScale()) / PX_PER_DEG
  let newBearing = dragStartBearing + dBearing
  newBearing = ((newBearing % 360) + 360) % 360
  emit('update:modelValue', Math.round(newBearing * 10) / 10)
}

function onMouseDown(e: MouseEvent) {
  isDragging = true
  dragStartX = e.clientX
  dragStartBearing = currentDeg.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
function onMouseMove(e: MouseEvent) {
  if (!isDragging) return
  applyDrag(e.clientX)
}
function onMouseUp() {
  isDragging = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length < 1) return
  isDragging = true
  dragStartX = e.touches[0].clientX
  dragStartBearing = currentDeg.value
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
}
function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!isDragging || e.touches.length < 1) return
  applyDrag(e.touches[0].clientX)
}
function onTouchEnd() {
  isDragging = false
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
})

// ────────────────────────────────────────────
// 数値直接入力
// ────────────────────────────────────────────
function onNumberInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val === '') return
  const n = Number(val)
  if (!isNaN(n)) emit('update:modelValue', n)
}
function onNumberChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val === '') return
  const n = parseFloat(val)
  if (!isNaN(n)) {
    const clamped = Math.max(0, Math.min(360, n))
    emit('update:modelValue', Math.round(clamped * 10) / 10)
  }
}
</script>

<style scoped>
.compass-tape-wrap {
  display: grid;
  gap: 8px;
}

.tape-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tape-label {
  color: var(--muted, #9fc1d9);
  font-size: 0.92rem;
}

.tape-badge {
  font-family: var(--mono, monospace);
  font-size: 1.1rem;
  font-weight: 700;
  color: #43c6ff;
  background: rgba(67, 198, 255, 0.12);
  border: 1px solid rgba(67, 198, 255, 0.3);
  border-radius: 999px;
  padding: 3px 12px;
}

.tape-svg-wrap {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(67, 198, 255, 0.22);
  box-shadow: 0 0 18px rgba(67, 198, 255, 0.07);
}

.tape-number-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tape-number-input {
  flex: 1;
  border: 1px solid var(--border, rgba(255,255,255,0.13));
  background: rgba(5, 18, 30, 0.78);
  color: var(--text, #eef7ff);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.tape-number-input:focus {
  border-color: rgba(67, 198, 255, 0.85);
  box-shadow: 0 0 0 4px rgba(67, 198, 255, 0.13);
}

.tape-unit {
  color: var(--muted, #9fc1d9);
  font-size: 1rem;
  padding-right: 4px;
}

.tape-hint {
  margin: 0;
  color: var(--muted, #9fc1d9);
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
