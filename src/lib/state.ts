import type { Lang } from '../i18n'
import type { Layer, Standard } from './pcb'

export type Mode = 'width' | 'current' | 'rise'

export interface AppState {
  lang: Lang
  theme: 'auto' | 'light' | 'dark'
  imperial: boolean
  mode: Mode
  standard: Standard
  layer: Layer
  plane: boolean
  current: number // A
  rise: number // °C
  ambient: number // °C
  widthMm: number
  oz: number
  lengthMm: number
  holeMm: number
  platingUm: number
  boardMm: number
  viaCount: number
  voltage: number
  table: string
}

export const DEFAULTS: AppState = {
  lang: 'en',
  theme: 'auto',
  imperial: false,
  mode: 'width',
  standard: '2221',
  layer: 'external',
  plane: false,
  current: 3,
  rise: 10,
  ambient: 25,
  widthMm: 1,
  oz: 1,
  lengthMm: 50,
  holeMm: 0.3,
  platingUm: 25,
  boardMm: 1.6,
  viaCount: 1,
  voltage: 24,
  table: 'B2',
}

export const PRESETS: { name: string; patch: Partial<AppState> }[] = [
  { name: 'Signal 100 mA', patch: { current: 0.1, rise: 10, voltage: 5, lengthMm: 80, mode: 'width' } },
  { name: 'USB 5 V 1 A', patch: { current: 1, rise: 10, voltage: 5, lengthMm: 60, mode: 'width' } },
  { name: 'Motor 5 A', patch: { current: 5, rise: 20, voltage: 24, lengthMm: 40, oz: 2, mode: 'width' } },
  { name: 'Mains-level 230 V', patch: { current: 2, rise: 20, voltage: 325, lengthMm: 40, table: 'B2', mode: 'width' } },
]

const KEY = 'pcb-trace-width:v1'

export function loadState(): AppState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AppState> | null
    const s = { ...DEFAULTS, ...(raw ?? {}) }
    if (s.lang !== 'en' && s.lang !== 'uk') s.lang = 'en'
    return s
  } catch {
    return DEFAULTS
  }
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}
