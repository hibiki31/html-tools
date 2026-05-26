import type { MapPoint } from '../types/point'

const STORAGE_KEY = 'ocean-mapper-points'

export function savePoints(points: MapPoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadPoints(): MapPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as MapPoint[]
  } catch {
    // Corrupted data — start fresh
    return []
  }
}
