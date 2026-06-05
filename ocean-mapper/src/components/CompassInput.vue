<template>
  <div class="compass-input-wrap">
    <div class="compass-label-row">
      <span class="compass-label-text">方角 [°]</span>
      <span class="compass-degree-badge">{{ displayDeg }}°</span>
    </div>

    <div class="compass-svg-wrap">
      <svg
        ref="svgRef"
        :width="SIZE"
        :height="SIZE"
        :viewBox="`0 0 ${SIZE} ${SIZE}`"
        role="img"
        aria-label="方位計入力"
        @mousedown.prevent="onMouseDown"
        @touchstart.prevent="onTouchStart"
        style="cursor: crosshair; user-select: none; touch-action: none;"
      >
        <!-- 外周リング -->
        <circle
          :cx="CX" :cy="CY" :r="R_OUTER"
          fill="rgba(4,17,29,0.72)"
          stroke="rgba(67,198,255,0.35)"
          stroke-width="2"
        />

        <!-- 目盛り（15° 間隔） -->
        <line
          v-for="i in 24"
          :key="i"
          :x1="tickX1(i)"
          :y1="tickY1(i)"
          :x2="tickX2(i)"
          :y2="tickY2(i)"
          :stroke="isCardinal(i) ? 'rgba(67,198,255,0.75)' : 'rgba(255,255,255,0.28)'"
          :stroke-width="isCardinal(i) ? 2 : 1"
        />

        <!-- 45° 刻みのラベル (N/NE/E...) -->
        <text
          v-for="d in CARDINALS"
          :key="d.label"
          :x="labelX(d.deg)"
          :y="labelY(d.deg)"
          text-anchor="middle"
          dominant-baseline="middle"
          :fill="d.deg === 0 ? '#ff6b6b' : 'rgba(159,193,217,0.9)'"
          :font-size="d.deg % 90 === 0 ? 14 : 11"
          :font-weight="d.deg % 90 === 0 ? '700' : '500'"
          font-family="system-ui, sans-serif"
          style="pointer-events: none"
        >{{ d.label }}</text>

        <!-- 内周の薄いリング -->
        <circle
          :cx="CX" :cy="CY" :r="R_INNER - 2"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          stroke-width="1"
        />

        <!-- 中心から針 -->
        <line
          :x1="CX" :y1="CY"
          :x2="needleX" :y2="needleY"
          stroke="#43c6ff"
          stroke-width="3"
          stroke-linecap="round"
          marker-end="url(#compassArrow)"
        />

        <!-- 反対方向のテール（薄い） -->
        <line
          :x1="CX" :y1="CY"
          :x2="tailX" :y2="tailY"
          stroke="rgba(67,198,255,0.3)"
          stroke-width="2"
          stroke-linecap="round"
        />

        <!-- 中心点 -->
        <circle :cx="CX" :cy="CY" r="5" fill="#69f0ae" />

        <!-- 度数テキスト（中央下寄り） -->
        <text
          :x="CX" :y="CY + 28"
          text-anchor="middle"
          fill="#eef7ff"
          font-size="15"
          font-family="ui-monospace, monospace"
          font-weight="700"
          style="pointer-events: none"
        >{{ displayDeg }}°</text>

        <defs>
          <marker id="compassArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#43c6ff" />
          </marker>
        </defs>
      </svg>
    </div>

    <!-- 精密入力 -->
    <div class="compass-number-row">
      <input
        type="number"
        inputmode="decimal"
        min="0"
        max="360"
        step="1"
        :value="roundedValue"
        @input="onNumberInput"
        @change="onNumberChange"
        class="compass-number-input"
        placeholder="0"
      />
      <span class="compass-number-unit">°</span>
    </div>
    <p class="compass-hint">盤面をクリック・ドラッグして方位を設定、または数値を直接入力</p>
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
// SVG 寸法定数
// ────────────────────────────────────────────
const SIZE = 260
const CX = 130
const CY = 130
const R_OUTER = 118   // 外周リング
const R_TICK_OUT = 115 // 目盛り外端
const R_TICK_IN_CARDINAL = 100 // 45° 刻みの内端（長い）
const R_TICK_IN_NORMAL = 107   // その他の内端（短い）
const R_LABEL = 85    // ラベル配置半径
const R_INNER = 70    // 内周リング（参考線）
const R_NEEDLE = 92   // 針の長さ
const R_TAIL = 22     // テールの長さ

// ────────────────────────────────────────────
// 方位ラベル定義
// ────────────────────────────────────────────
const CARDINALS = [
  { deg: 0,   label: 'N'  },
  { deg: 45,  label: 'NE' },
  { deg: 90,  label: 'E'  },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S'  },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W'  },
  { deg: 315, label: 'NW' },
]

// ────────────────────────────────────────────
// 現在の bearing 値（0〜360）
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
// 目盛り座標計算（i: 1〜24 → 0°, 15°, ..., 345°）
// ────────────────────────────────────────────
function degToRad(deg: number) { return (deg - 90) * Math.PI / 180 }

function tickDeg(i: number) { return (i - 1) * 15 }

function isCardinal(i: number) { return (tickDeg(i) % 45 === 0) }

function tickX1(i: number) {
  const rad = degToRad(tickDeg(i))
  return (CX + R_TICK_OUT * Math.cos(rad)).toFixed(2)
}
function tickY1(i: number) {
  const rad = degToRad(tickDeg(i))
  return (CY + R_TICK_OUT * Math.sin(rad)).toFixed(2)
}
function tickX2(i: number) {
  const r = isCardinal(i) ? R_TICK_IN_CARDINAL : R_TICK_IN_NORMAL
  const rad = degToRad(tickDeg(i))
  return (CX + r * Math.cos(rad)).toFixed(2)
}
function tickY2(i: number) {
  const r = isCardinal(i) ? R_TICK_IN_CARDINAL : R_TICK_IN_NORMAL
  const rad = degToRad(tickDeg(i))
  return (CY + r * Math.sin(rad)).toFixed(2)
}

function labelX(deg: number) {
  const rad = degToRad(deg)
  return (CX + R_LABEL * Math.cos(rad)).toFixed(2)
}
function labelY(deg: number) {
  const rad = degToRad(deg)
  return (CY + R_LABEL * Math.sin(rad)).toFixed(2)
}

// ────────────────────────────────────────────
// 針の座標
// ────────────────────────────────────────────
const needleX = computed(() => {
  const rad = degToRad(currentDeg.value)
  return (CX + R_NEEDLE * Math.cos(rad)).toFixed(2)
})
const needleY = computed(() => {
  const rad = degToRad(currentDeg.value)
  return (CY + R_NEEDLE * Math.sin(rad)).toFixed(2)
})
const tailX = computed(() => {
  const rad = degToRad(currentDeg.value + 180)
  return (CX + R_TAIL * Math.cos(rad)).toFixed(2)
})
const tailY = computed(() => {
  const rad = degToRad(currentDeg.value + 180)
  return (CY + R_TAIL * Math.sin(rad)).toFixed(2)
})

// ────────────────────────────────────────────
// マウス / タッチ操作
// ────────────────────────────────────────────
const svgRef = ref<SVGSVGElement | null>(null)
const isDragging = ref(false)

function getAngleFromEvent(clientX: number, clientY: number): number {
  const svg = svgRef.value
  if (!svg) return 0
  const rect = svg.getBoundingClientRect()
  const x = clientX - rect.left - (rect.width / 2)
  const y = clientY - rect.top - (rect.height / 2)
  // atan2 で角度計算（北=0°、時計回り）
  let deg = Math.atan2(x, -y) * 180 / Math.PI
  if (deg < 0) deg += 360
  return deg
}

function emitAngle(clientX: number, clientY: number) {
  const deg = getAngleFromEvent(clientX, clientY)
  emit('update:modelValue', Math.round(deg * 10) / 10)
}

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  emitAngle(e.clientX, e.clientY)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  emitAngle(e.clientX, e.clientY)
}
function onMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length < 1) return
  isDragging.value = true
  emitAngle(e.touches[0].clientX, e.touches[0].clientY)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
}
function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!isDragging.value || e.touches.length < 1) return
  emitAngle(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchEnd() {
  isDragging.value = false
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
// 数値入力
// ────────────────────────────────────────────
function onNumberInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val === '' || val === null) return
  const n = Number(val)
  if (!isNaN(n)) emit('update:modelValue', n)
}
function onNumberChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val === '' || val === null) return
  const n = parseFloat(val)
  if (!isNaN(n)) {
    const clamped = Math.max(0, Math.min(360, n))
    emit('update:modelValue', Math.round(clamped * 10) / 10)
  }
}
</script>

<style scoped>
.compass-input-wrap {
  display: grid;
  gap: 8px;
}

.compass-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.compass-label-text {
  color: var(--muted);
  font-size: 0.92rem;
}

.compass-degree-badge {
  font-family: var(--mono, monospace);
  font-size: 1.1rem;
  font-weight: 700;
  color: #43c6ff;
  background: rgba(67, 198, 255, 0.12);
  border: 1px solid rgba(67, 198, 255, 0.3);
  border-radius: 999px;
  padding: 3px 12px;
}

.compass-svg-wrap {
  display: flex;
  justify-content: center;
}

.compass-svg-wrap svg {
  width: 100%;
  max-width: 260px;
  height: auto;
  border-radius: 50%;
  border: 1px solid rgba(67, 198, 255, 0.2);
  background: rgba(4, 17, 29, 0.55);
  box-shadow: 0 0 24px rgba(67, 198, 255, 0.08);
}

.compass-number-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compass-number-input {
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

.compass-number-input:focus {
  border-color: rgba(67, 198, 255, 0.85);
  box-shadow: 0 0 0 4px rgba(67, 198, 255, 0.13);
}

.compass-number-unit {
  color: var(--muted, #9fc1d9);
  font-size: 1rem;
  padding-right: 4px;
}

.compass-hint {
  margin: 0;
  color: var(--muted, #9fc1d9);
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
