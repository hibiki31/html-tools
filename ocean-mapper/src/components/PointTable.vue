<template>
  <section class="card history">
    <h2>計算履歴 / CSV</h2>
    <div class="card-body">
      <div class="map-toolbar">
        <div class="map-meta">
          CSVはポイント名・色・アイコン・入力値・計算結果を保存します。読み込み時は現在の履歴に追加されます。
        </div>
        <div class="button-row">
          <button class="secondary" @click="$emit('download-csv')">CSV保存</button>
          <button class="secondary" @click="$emit('load-csv')">CSV読み込み</button>
          <input
            ref="fileInput"
            type="file"
            accept=".csv,text/csv"
            class="file-input"
            @change="onFileChange"
          />
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ポイント</th>
              <th>時刻</th>
              <th>距離</th>
              <th>深度</th>
              <th>入力方角</th>
              <th>基準点からの方角</th>
              <th>水平距離</th>
              <th>x</th>
              <th>y</th>
              <th>z</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="points.length === 0">
              <td colspan="11" style="text-align:left;color:var(--muted);">まだ履歴はありません。</td>
            </tr>
            <tr v-for="(row, index) in points" :key="row.id">
              <td>
                <span class="point-chip">
                  <span class="color-dot" :style="{ background: row.color }"></span>
                  <span>{{ row.icon }} {{ row.name }}</span>
                </span>
              </td>
              <td>{{ formatDate(row.createdAt) }}</td>
              <td>{{ fmtNum(row.distance) }} m</td>
              <td>{{ fmtNum(row.depth) }} m</td>
              <td>{{ fmtNum(row.bearingInput) }}°</td>
              <td>{{ fmtNum(row.bearingFromBase) }}°</td>
              <td>{{ fmtNum(row.horizontalDistance) }} m</td>
              <td>{{ fmtNum(row.x) }} m</td>
              <td>{{ fmtNum(row.y) }} m</td>
              <td>{{ fmtNum(row.z) }} m</td>
              <td><button class="secondary" @click="$emit('delete-point', index)">削除</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { MapPoint } from '../types/point'
import { formatNumber } from '../utils/coordinate'

defineProps<{
  points: MapPoint[]
}>()

const emit = defineEmits<{
  'delete-point': [index: number]
  'download-csv': []
  'load-csv': []
  'csv-loaded': [text: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const fmtNum = formatNumber

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}

function triggerFileInput(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      emit('csv-loaded', text)
    }
    reader.onerror = () => {
      emit('csv-loaded', '')
    }
    reader.readAsText(file, 'utf-8')
    target.value = ''
  }
}

defineExpose({ triggerFileInput })
</script>