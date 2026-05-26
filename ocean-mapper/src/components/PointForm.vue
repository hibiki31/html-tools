<template>
  <section class="card">
    <h2>入力</h2>
    <div class="card-body">
      <div class="form-grid">
        <p class="section-title">ポイント情報</p>

        <label>
          ポイント名称
          <input
            v-model="form.name"
            type="text"
            maxlength="80"
            placeholder="例：岩礁A / 調査点01 / Anchor"
          />
        </label>

        <label>
          アイコン
          <select v-model="form.icon">
            <option
              v-for="opt in ICON_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >{{ opt.label }}</option>
          </select>
        </label>

        <p class="section-title">測定値</p>

        <div class="input-row">
          <label>
            距離 [m]
            <input
              v-model.number="form.distance"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
            />
          </label>
          <label>
            深度 [m]
            <input
              v-model.number="form.depth"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
            />
          </label>
        </div>

        <label>
          方角 [°]
          <input
            v-model.number="form.bearing"
            type="number"
            inputmode="decimal"
            min="0"
            max="360"
            step="0.01"
          />
        </label>

        <label>
          方角の意味
          <select v-model="form.bearingMode">
            <option value="toBase">マッピング地点から基準点への方角</option>
            <option value="fromBase">基準点からマッピング地点への方角</option>
          </select>
        </label>

        <label>
          距離の種類
          <select v-model="form.distanceType">
            <option value="slant">斜距離：深度を使って水平距離を計算</option>
            <option value="horizontal">水平距離：距離をそのまま水平距離として使う</option>
          </select>
        </label>

        <p class="hint">
          通常、ソナー・ケーブル長・直線距離なら「斜距離」、地図上の平面距離なら「水平距離」を選んでください。
        </p>

        <div class="button-row">
          <button class="primary" @click="calculate">計算する</button>
          <button class="success" @click="$emit('add-point', preview)">履歴と地図へ追加</button>
          <button class="secondary" @click="copyResult">結果をコピー</button>
          <button class="secondary" @click="resetForm">入力リセット</button>
        </div>
      </div>

      <div class="preset-row">
        <button class="preset" @click="applyPreset('A')">
          例1：距離1400m / 深度178m / 西 275°
        </button>
        <button class="preset" @click="applyPreset('B')">
          例2：距離1291m / 深度128m / 西 268°
        </button>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>計算結果</h2>
    <div class="card-body">
      <div v-if="errorMsg" class="summary error">{{ errorMsg }}</div>
      <div v-else-if="preview" class="summary">
        <strong>{{ preview.icon }} {{ preview.name }}</strong>：基準点から見て、
        <strong>{{ dirText }}</strong> の位置です。
      </div>
      <div v-else class="summary">入力値をもとに計算します。</div>

      <div class="results">
        <div class="metric">
          <span>x：東西方向</span>
          <strong class="east">{{ preview ? fmtNum(preview.x) + ' m' : '--' }}</strong>
        </div>
        <div class="metric">
          <span>y：南北方向</span>
          <strong class="north">{{ preview ? fmtNum(preview.y) + ' m' : '--' }}</strong>
        </div>
        <div class="metric">
          <span>z：深度方向</span>
          <strong class="depth">{{ preview ? fmtNum(preview.z) + ' m' : '--' }}</strong>
        </div>
      </div>

      <div class="detail-grid">
        <pre class="steps">{{ stepsText }}</pre>
        <div class="compass-box">
          <svg viewBox="0 0 220 220" role="img" aria-label="方角表示">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#43c6ff" />
              </marker>
            </defs>
            <circle cx="110" cy="110" r="88" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
            <line x1="110" y1="18" x2="110" y2="202" stroke="rgba(255,255,255,0.15)" />
            <line x1="18" y1="110" x2="202" y2="110" stroke="rgba(255,255,255,0.15)" />
            <text x="110" y="15" text-anchor="middle" fill="#9fc1d9" font-size="14">N</text>
            <text x="110" y="215" text-anchor="middle" fill="#9fc1d9" font-size="14">S</text>
            <text x="207" y="115" text-anchor="middle" fill="#9fc1d9" font-size="14">E</text>
            <text x="13" y="115" text-anchor="middle" fill="#9fc1d9" font-size="14">W</text>
            <line
              :x1="110" :y1="110"
              :x2="arrowX2" :y2="arrowY2"
              stroke="#43c6ff" stroke-width="5" stroke-linecap="round"
              marker-end="url(#arrow)"
            />
            <circle cx="110" cy="110" r="5" fill="#69f0ae" />
            <text x="110" y="136" text-anchor="middle" fill="#eef7ff" font-size="13" font-family="ui-monospace, monospace">
              {{ compassLabel }}
            </text>
          </svg>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import type { MapPoint } from '../types/point'
import { COLOR_PALETTE, ICON_OPTIONS } from '../types/point'
import {
  calculateCoordinate,
  formatNumber,
  directionText,
  makePointId,
  normalizeDegrees,
} from '../utils/coordinate'

const emit = defineEmits<{
  (event: 'add-point', point: MapPoint | null): void
  (event: 'preview-update', point: MapPoint | null): void
  (event: 'copy-result', success: boolean): void
}>()

const props = defineProps<{
  historyLength: number
}>()

const form = reactive({
  name: 'Point-001',
  icon: '📍',
  distance: 1291 as number | '',
  depth: 128 as number | '',
  bearing: 268 as number | '',
  bearingMode: 'toBase' as 'toBase' | 'fromBase',
  distanceType: 'slant' as 'slant' | 'horizontal',
})

const errorMsg = ref('')
const preview = ref<MapPoint | null>(null)

const fmtNum = formatNumber

const dirText = computed(() => {
  if (!preview.value) return ''
  return directionText(preview.value.x, preview.value.y, preview.value.z)
})

const compassBearing = computed(() => preview.value?.bearingFromBase ?? 0)

const arrowX2 = computed(() => {
  const rad = compassBearing.value * Math.PI / 180
  return (110 + 70 * Math.sin(rad)).toFixed(2)
})

const arrowY2 = computed(() => {
  const rad = compassBearing.value * Math.PI / 180
  return (110 - 70 * Math.cos(rad)).toFixed(2)
})

const compassLabel = computed(() => `${formatNumber(compassBearing.value)}°`)

const stepsText = computed(() => {
  if (!preview.value) return 'ここに計算式を表示します。'
  const p = preview.value
  const distKind = p.distanceType === 'slant' ? '斜距離' : '水平距離'
  const bModeText = p.bearingMode === 'toBase'
    ? 'マッピング地点から基準点への方角'
    : '基準点からマッピング地点への方角'
  const bNorm = normalizeDegrees(p.bearingInput)
  const lines = [
    `ポイント = ${p.icon} ${p.name}`,
    `入力距離 = ${formatNumber(p.distance)} m (${distKind})`,
    `深度 = ${formatNumber(p.depth)} m`,
    `入力方角 = ${formatNumber(bNorm)}° (${bModeText})`,
    p.bearingMode === 'toBase'
      ? `基準点から対象地点への方角 = (${formatNumber(bNorm)} + 180) mod 360 = ${formatNumber(p.bearingFromBase)}°`
      : `基準点から対象地点への方角 = ${formatNumber(p.bearingFromBase)}°`,
    p.distanceType === 'slant'
      ? `水平距離 = √(${formatNumber(p.distance)}² - ${formatNumber(p.depth)}²) = ${formatNumber(p.horizontalDistance)} m`
      : `水平距離 = ${formatNumber(p.horizontalDistance)} m`,
    `x = 水平距離 × sin(${formatNumber(p.bearingFromBase)}°) = ${formatNumber(p.x)} m`,
    `y = 水平距離 × cos(${formatNumber(p.bearingFromBase)}°) = ${formatNumber(p.y)} m`,
    `z = -深度 = ${formatNumber(p.z)} m`,
  ]
  return lines.join('\n')
})

function doCalc(): void {
  const dist = Number(form.distance)
  const dep = Number(form.depth)
  const bear = Number(form.bearing)

  const input = {
    distance: dist,
    depth: dep,
    bearingInput: bear,
    bearingMode: form.bearingMode,
    distanceType: form.distanceType,
  }

  const result = calculateCoordinate(input)
  if (typeof result === 'string') {
    errorMsg.value = result
    preview.value = null
    emit('preview-update', null)
    return
  }

  errorMsg.value = ''
  const name = form.name?.trim() || `Point-${String(props.historyLength + 1).padStart(3, '0')}`
  const color = COLOR_PALETTE[props.historyLength % COLOR_PALETTE.length]

  preview.value = {
    id: '__preview__',
    name,
    color,
    icon: form.icon || '📍',
    createdAt: new Date().toISOString(),
    distance: dist,
    depth: dep,
    bearingInput: normalizeDegrees(bear),
    bearingMode: form.bearingMode,
    distanceType: form.distanceType,
    bearingFromBase: result.bearingFromBase,
    horizontalDistance: result.horizontalDistance,
    x: result.x,
    y: result.y,
    z: result.z,
  }
  emit('preview-update', preview.value)
}

function calculate(): void {
  doCalc()
}

function resetForm(): void {
  form.name = `Point-${String(props.historyLength + 1).padStart(3, '0')}`
  form.icon = '📍'
  form.distance = ''
  form.depth = ''
  form.bearing = ''
  form.bearingMode = 'toBase'
  form.distanceType = 'slant'
  errorMsg.value = ''
  preview.value = null
  emit('preview-update', null)
}

function applyPreset(id: 'A' | 'B'): void {
  if (id === 'A') {
    form.name = '調査点-A'
    form.icon = '📍'
    form.distance = 1400
    form.depth = 178
    form.bearing = 275
  } else {
    form.name = '調査点-B'
    form.icon = '⚓'
    form.distance = 1291
    form.depth = 128
    form.bearing = 268
  }
  form.bearingMode = 'toBase'
  form.distanceType = 'slant'
  doCalc()
}

async function copyResult(): Promise<void> {
  if (!preview.value) {
    doCalc()
  }
  if (!preview.value) return
  const p = preview.value
  const distKind = p.distanceType === 'slant' ? '斜距離' : '水平距離'
  const bNorm = normalizeDegrees(p.bearingInput)
  const text = [
    '海洋マッピング座標計算結果',
    `ポイント: ${p.icon} ${p.name}`,
    `色: ${p.color}`,
    `距離: ${formatNumber(p.distance)} m (${distKind})`,
    `深度: ${formatNumber(p.depth)} m`,
    `入力方角: ${formatNumber(bNorm)}°`,
    `基準点から対象地点への方角: ${formatNumber(p.bearingFromBase)}°`,
    `水平距離: ${formatNumber(p.horizontalDistance)} m`,
    `x: ${formatNumber(p.x)} m`,
    `y: ${formatNumber(p.y)} m`,
    `z: ${formatNumber(p.z)} m`,
    directionText(p.x, p.y, p.z),
  ].join('\n')

  try {
    await navigator.clipboard.writeText(text)
    emit('copy-result', true)
  } catch {
    emit('copy-result', false)
  }
}

// Auto-calculate on input change
watch(
  () => [form.distance, form.depth, form.bearing, form.bearingMode, form.distanceType, form.name, form.icon],
  () => doCalc(),
  { deep: true },
)

// Initial calculation
doCalc()
</script>