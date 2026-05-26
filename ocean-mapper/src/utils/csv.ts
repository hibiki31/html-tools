import type { MapPoint } from '../types/point'
import { makePointId, normalizeDegrees, calculateCoordinate } from './coordinate'

export interface CsvParseResult {
  points: MapPoint[]
  skippedCount: number
  errors: string[]
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function csvNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : ''
}

const CSV_HEADERS = [
  'name', 'color', 'icon', 'created_at', 'distance_m', 'depth_m',
  'bearing_input_deg', 'bearing_mode', 'distance_type',
  'bearing_from_base_deg', 'horizontal_distance_m', 'x_m', 'y_m', 'z_m',
] as const

export function exportPointsToCsv(points: MapPoint[]): string {
  const rows = points.map((p) => [
    p.name,
    p.color,
    p.icon,
    p.createdAt,
    csvNumber(p.distance),
    csvNumber(p.depth),
    csvNumber(p.bearingInput),
    p.bearingMode,
    p.distanceType,
    csvNumber(p.bearingFromBase),
    csvNumber(p.horizontalDistance),
    csvNumber(p.x),
    csvNumber(p.y),
    csvNumber(p.z),
  ])
  return [CSV_HEADERS as unknown as string[], ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n')
}

export function downloadCsv(points: MapPoint[]): void {
  const csv = exportPointsToCsv(points)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `ocean_mapping_history_${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(cell)
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  if (row.some((v) => v !== '')) rows.push(row)
  return rows
}

const VALID_BEARING_MODES = new Set(['toBase', 'fromBase'])
const VALID_DISTANCE_TYPES = new Set(['slant', 'horizontal'])

export function parsePointsCsv(csvText: string): CsvParseResult {
  const text = csvText.replace(/^\uFEFF/, '')
  const rows = parseCsvRows(text)
  if (rows.length < 2) {
    return { points: [], skippedCount: 0, errors: ['CSVにデータ行がありません。'] }
  }

  const header = rows[0].map((h) => h.trim())
  const indexOf = (name: string): number => header.indexOf(name)

  const required = [...CSV_HEADERS]
  const missing = required.filter((name) => indexOf(name) < 0)
  if (missing.length) {
    return { points: [], skippedCount: 0, errors: [`CSV形式が一致しません。不足列: ${missing.join(', ')}`] }
  }

  const points: MapPoint[] = []
  const errors: string[] = []
  let skippedCount = 0

  rows.slice(1).forEach((row, rowIndex) => {
    const get = (name: string): string => row[indexOf(name)] ?? ''
    const num = (name: string): number => Number(get(name))
    const rowNum = rowIndex + 2

    const distance = num('distance_m')
    const depth = num('depth_m')
    const bearingInputRaw = num('bearing_input_deg')
    const bearingMode = get('bearing_mode')
    const distanceType = get('distance_type')

    // Validate enum fields
    if (!VALID_BEARING_MODES.has(bearingMode)) {
      errors.push(`行${rowNum}: bearing_mode「${bearingMode}」が不正です。スキップします。`)
      skippedCount++
      return
    }
    if (!VALID_DISTANCE_TYPES.has(distanceType)) {
      errors.push(`行${rowNum}: distance_type「${distanceType}」が不正です。スキップします。`)
      skippedCount++
      return
    }

    // Validate numeric fields
    if (!Number.isFinite(distance) || distance < 0) {
      errors.push(`行${rowNum}: 距離が不正（${get('distance_m')}）。スキップします。`)
      skippedCount++
      return
    }
    if (!Number.isFinite(depth) || depth < 0) {
      errors.push(`行${rowNum}: 深度が不正（${get('depth_m')}）。スキップします。`)
      skippedCount++
      return
    }
    if (!Number.isFinite(bearingInputRaw)) {
      errors.push(`行${rowNum}: 方角が不正（${get('bearing_input_deg')}）。スキップします。`)
      skippedCount++
      return
    }

    const typedBearingMode = bearingMode as 'toBase' | 'fromBase'
    const typedDistanceType = distanceType as 'slant' | 'horizontal'

    // Validate slant distance constraint
    if (typedDistanceType === 'slant' && distance < depth) {
      errors.push(`行${rowNum}: 斜距離(${distance})が深度(${depth})未満です。スキップします。`)
      skippedCount++
      return
    }

    const bearingInput = normalizeDegrees(bearingInputRaw)
    const x = num('x_m')
    const y = num('y_m')
    const z = num('z_m')

    // If x/y/z are missing or invalid, recalculate from input values
    let finalX = x
    let finalY = y
    let finalZ = z
    let bearingFromBase: number
    let horizontalDistance: number

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      const calcInput = {
        distance,
        depth,
        bearingInput,
        bearingMode: typedBearingMode,
        distanceType: typedDistanceType,
      }
      const calcResult = calculateCoordinate(calcInput)
      if (typeof calcResult === 'string') {
        errors.push(`行${rowNum}: 座標再計算に失敗（${calcResult}）。スキップします。`)
        skippedCount++
        return
      }
      finalX = calcResult.x
      finalY = calcResult.y
      finalZ = calcResult.z
      bearingFromBase = calcResult.bearingFromBase
      horizontalDistance = calcResult.horizontalDistance
    } else {
      bearingFromBase = typedBearingMode === 'toBase'
        ? normalizeDegrees(bearingInput + 180)
        : bearingInput
      horizontalDistance = typedDistanceType === 'slant'
        ? Math.sqrt(distance * distance - depth * depth)
        : distance
    }

    // Use CSV values for bearingFromBase / horizontalDistance if available
    const csvBearingFromBase = num('bearing_from_base_deg')
    const csvHorizontalDistance = num('horizontal_distance_m')
    if (Number.isFinite(csvBearingFromBase)) bearingFromBase = csvBearingFromBase
    if (Number.isFinite(csvHorizontalDistance)) horizontalDistance = csvHorizontalDistance

    const color = get('color') || '#43c6ff'

    points.push({
      id: makePointId(),
      name: get('name') || 'Point',
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#43c6ff',
      icon: get('icon') || '📍',
      createdAt: get('created_at') || new Date().toISOString(),
      distance,
      depth,
      bearingInput,
      bearingMode: typedBearingMode,
      distanceType: typedDistanceType,
      bearingFromBase,
      horizontalDistance,
      x: finalX,
      y: finalY,
      z: finalZ,
    })
  })

  return { points, skippedCount, errors }
}
