<template>
  <header>
    <h1>海洋マッピング座標計算ツール</h1>
    <p>
      基準点を <code>(0, 0, 0)</code> とし、xを東西方向、yを南北方向、zを深度方向として計算します。
      方角は <code>0°=北 / 90°=東 / 180°=南 / 270°=西</code> です。
    </p>
  </header>

  <main>
    <PointForm
      :history-length="points.length"
      @add-point="onAddPoint"
      @preview-update="onPreviewUpdate"
    />

    <MapCanvas
      :points="points"
      :preview-point="previewPoint"
      @clear-history="onClearHistory"
    />

    <PointTable
      :points="points"
      @delete-point="onDeletePoint"
      @download-csv="onDownloadCsv"
      @load-csv="onLoadCsv"
    />
  </main>

  <footer>
    <p>
      座標系：<code>x+</code> は東、<code>x-</code> は西、<code>y+</code> は北、<code>y-</code> は南、<code>z</code> は海面を0mとして深度を負の値で表示します。
      このHTMLは単一ファイルで動作し、外部ライブラリは使用していません。
    </p>
  </footer>

  <div :class="['toast', { show: toastVisible }]">{{ toastMessage }}</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { MapPoint } from './types/point'
import { COLOR_PALETTE } from './types/point'
import { makePointId } from './utils/coordinate'
import PointForm from './components/PointForm.vue'
import PointTable from './components/PointTable.vue'
import MapCanvas from './components/MapCanvas.vue'
import { downloadCsv, parsePointsCsv } from './utils/csv'

const points = ref<MapPoint[]>([])
const previewPoint = ref<MapPoint | null>(null)
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string): void {
  toastMessage.value = message
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

function onPreviewUpdate(point: MapPoint | null): void {
  previewPoint.value = point
}

function onAddPoint(point: MapPoint | null): void {
  if (!point) return
  const newPoint: MapPoint = {
    ...point,
    id: makePointId(),
    color: COLOR_PALETTE[points.value.length % COLOR_PALETTE.length],
    createdAt: new Date().toISOString(),
  }
  points.value.unshift(newPoint)
  showToast('履歴と地図へ追加しました')
}

function onDeletePoint(index: number): void {
  points.value.splice(index, 1)
  showToast('ポイントを削除しました')
}

function onClearHistory(): void {
  if (!confirm('計算履歴と地図上のポイントをすべて削除しますか？')) return
  points.value = []
  showToast('履歴を全削除しました')
}

function onDownloadCsv(): void {
  if (points.value.length === 0) {
    showToast('エクスポートするポイントがありません')
    return
  }
  downloadCsv(points.value)
  showToast('CSVを保存しました')
}

function onLoadCsv(): void {
  // Trigger the file input in PointTable via custom event
  const tableComponent = document.querySelector('.file-input') as HTMLInputElement | null
  if (tableComponent) {
    tableComponent.click()
  }
}

function handleCsvLoaded(event: Event): void {
  const customEvent = event as CustomEvent
  const text = customEvent.detail as string
  if (!text) {
    showToast('CSVファイルを読み込めませんでした')
    return
  }
  try {
    const imported = parsePointsCsv(text)
    if (imported.length === 0) throw new Error('読み込めるポイントがありませんでした。')
    points.value = [...imported, ...points.value]
    showToast(`${imported.length}件のポイントを読み込みました`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'CSV読み込みに失敗しました')
  }
}

onMounted(() => {
  window.addEventListener('csv-file-loaded', handleCsvLoaded)
})

onUnmounted(() => {
  window.removeEventListener('csv-file-loaded', handleCsvLoaded)
})
</script>