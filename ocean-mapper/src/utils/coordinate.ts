import type { CalcInput } from '../types/point'

export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export interface CalcResult {
  bearingFromBase: number
  horizontalDistance: number
  x: number
  y: number
  z: number
}

export function calculateCoordinate(input: CalcInput): CalcResult | string {
  const { distance, depth, bearingInput, bearingMode, distanceType } = input

  if (!Number.isFinite(distance) || distance < 0) {
    return '距離は0以上の数値で入力してください。'
  }
  if (!Number.isFinite(depth) || depth < 0) {
    return '深度は0以上の数値で入力してください。'
  }
  if (!Number.isFinite(bearingInput)) {
    return '方角は数値で入力してください。例：西向きなら270°付近です。'
  }
  if (distanceType === 'slant' && distance < depth) {
    return '斜距離は深度以上である必要があります。距離の種類を確認してください。'
  }

  const bearingNormalized = normalizeDegrees(bearingInput)
  const bearingFromBase = bearingMode === 'toBase'
    ? normalizeDegrees(bearingNormalized + 180)
    : bearingNormalized

  const horizontalDistance = distanceType === 'slant'
    ? Math.sqrt(distance * distance - depth * depth)
    : distance

  const rad = bearingFromBase * Math.PI / 180
  const x = horizontalDistance * Math.sin(rad)
  const y = horizontalDistance * Math.cos(rad)
  const z = -depth

  return { bearingFromBase, horizontalDistance, x, y, z }
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function directionText(x: number, y: number, z: number): string {
  const eastWest = x >= 0 ? `東へ 約${formatNumber(Math.abs(x), 1)} m` : `西へ 約${formatNumber(Math.abs(x), 1)} m`
  const northSouth = y >= 0 ? `北へ 約${formatNumber(Math.abs(y), 1)} m` : `南へ 約${formatNumber(Math.abs(y), 1)} m`
  const depth = `深さ ${formatNumber(Math.abs(z), 1)} m`
  return `${eastWest}、${northSouth}、${depth}`
}

export interface PointDistanceResult {
  distance3d: number
  distance2d: number
  depthDiff: number
  bearing: number
}

export function calculatePointDistance(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
): PointDistanceResult {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dz = p2.z - p1.z
  const distance2d = Math.sqrt(dx * dx + dy * dy)
  const distance3d = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const depthDiff = Math.abs(dz)
  // Bearing from p1 to p2 (0°=North, 90°=East)
  const bearing = distance2d < 1e-9 ? 0 : normalizeDegrees(Math.atan2(dx, dy) * 180 / Math.PI)
  return { distance3d, distance2d, depthDiff, bearing }
}

export function makePointId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`
}
