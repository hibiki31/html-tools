export interface MapPoint {
  id: string
  name: string
  color: string
  icon: string
  createdAt: string
  distance: number
  depth: number
  bearingInput: number
  bearingMode: 'toBase' | 'fromBase'
  distanceType: 'slant' | 'horizontal'
  bearingFromBase: number
  horizontalDistance: number
  x: number
  y: number
  z: number
}

export interface CalcInput {
  distance: number
  depth: number
  bearingInput: number
  bearingMode: 'toBase' | 'fromBase'
  distanceType: 'slant' | 'horizontal'
}

export const COLOR_PALETTE: readonly string[] = [
  '#43c6ff', '#69f0ae', '#ffd166', '#ff6b9d', '#c77dff',
  '#ff9f1c', '#06d6a0', '#ef476f', '#118ab2', '#ffd700',
] as const

export const ICON_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '📍', label: '📍 ピン' },
  { value: '⚓', label: '⚓ アンカー' },
  { value: '🌊', label: '🌊 波' },
  { value: '🐟', label: '🐟 魚' },
  { value: '🦑', label: '🦑 イカ' },
  { value: '🐚', label: '🐚 貝殻' },
  { value: '🪸', label: '🪸 サンゴ' },
  { value: '🪝', label: '🪝 釣り針' },
  { value: '🚢', label: '🚢 船' },
  { value: '🧭', label: '🧭 コンパス' },
  { value: '🗺️', label: '🗺️ 地図' },
  { value: '💎', label: '💎 宝石' },
  { value: '💀', label: '💀 どくろ' },
  { value: '⭐', label: '⭐ 星' },
  { value: '❗', label: '❗ 警告' },
] as const