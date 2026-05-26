import type { MapPoint } from '../types/point'
import { makePointId, normalizeDegrees } from './coordinate'

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

export function parsePointsCsv(csvText: string): MapPoint[] {
  const text = csvText.replace(/^\uFEFF/, '')
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error('CSVにデータ行がありません。')

  const header = rows[0].map((h) => h.trim())
  const indexOf = (name: string): number => header.indexOf(name)

  const required = [...CSV_HEADERS]
  const missing = required.filter((name) => indexOf(name) < 0)
  if (missing.length) throw new Error(`CSV形式が一致しません。不足列: ${missing.join(', ')}`)

  return rows.slice(1).map((row): MapPoint | null => {
    const get = (name: string): string => row[indexOf(name)] ?? ''
    const num = (name: string): number => Number(get(name))

    const color = get('color') || '#43c6ff'
    const distance = num('distance_m')
    const depth = num('depth_m')
    const bearingInput = normalizeDegrees(num('bearing_input_deg'))
    const bearingMode = get('bearing_mode') as 'toBase' | 'fromBase'
    const distanceType = get('distance_type') as 'slant' | 'horizontal'
    const x = num('x_m')
    const y = num('y_m')
    const z = num('z_m')

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null

    const bearingFromBase = bearingMode === 'toBase'
      ? normalizeDegrees(bearingInput + 180)
      : bearingInput
    const horizontalDistance = distanceType === 'slant'
      ? Math.sqrt(distance * distance - depth * depth)
      : distance

    return {
      id: makePointId(),
      name: get('name') || 'Point',
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#43c6ff',
      icon: get('icon') || '📍',
      createdAt: get('created_at') || new Date().toISOString(),
      distance,
      depth,
      bearingInput,
      bearingMode,
      distanceType,
      bearingFromBase: Number.isFinite(num('bearing_from_base_deg'))
        ? num('bearing_from_base_deg')
        : bearingFromBase,
      horizontalDistance: Number.isFinite(num('horizontal_distance_m'))
        ? num('horizontal_distance_m')
        : horizontalDistance,
      x,
      y,
      z,
    }
  }).filter((p): p is MapPoint => p !== null)
}