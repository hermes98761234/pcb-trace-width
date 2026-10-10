/** PCB trace maths. Everything is SI-ish: millimetres, micrometres, amps, volts, °C. */

export const MIL_MM = 0.0254
/** Thickness of 1 oz/ft² copper, µm (1.37 mil). */
export const OZ_UM = 34.8
export const ozToUm = (oz: number) => oz * OZ_UM
export const umToOz = (um: number) => um / OZ_UM

export type Standard = '2221' | '2152'
export type Layer = 'external' | 'internal'

export interface TraceParams {
  standard: Standard
  layer: Layer
  /** Copper thickness, µm. */
  thicknessUm: number
  /** A copper plane adjacent to the trace (IPC-2152 approximation only). */
  plane: boolean
}

const B = 0.44 // temperature-rise exponent
const C = 0.725 // area exponent
/** Boost for a nearby copper plane, an approximation of the IPC-2152 plane benefit. */
export const PLANE_FACTOR = 1.25

/**
 * k in I = k * dT^0.44 * A^0.725 (A in mil², dT in °C).
 * IPC-2221: 0.048 external, 0.024 internal (internal is deliberately conservative).
 * IPC-2152 (approximation): internal traces carry about the same as external ones in the
 * published test data, so both use 0.048, and an adjacent plane adds PLANE_FACTOR.
 */
export function kFactor(p: Pick<TraceParams, 'standard' | 'layer' | 'plane'>): number {
  if (p.standard === '2221') return p.layer === 'external' ? 0.048 : 0.024
  return 0.048 * (p.plane ? PLANE_FACTOR : 1)
}

const areaMil2 = (widthMm: number, thicknessUm: number) => (widthMm / MIL_MM) * (thicknessUm / 1000 / MIL_MM)

/** Cross-section needed for current `i` at temperature rise `dT`, in mil². */
export function requiredAreaMil2(i: number, dT: number, k: number): number {
  return (i / (k * dT ** B)) ** (1 / C)
}

/** Minimum trace width in mm for a current and temperature rise. */
export function widthForCurrent(i: number, dT: number, p: TraceParams): number {
  const a = requiredAreaMil2(i, dT, kFactor(p))
  return (a / (p.thicknessUm / 1000 / MIL_MM)) * MIL_MM
}

/** Maximum current in A for a trace width and temperature rise. */
export function currentForWidth(widthMm: number, dT: number, p: TraceParams): number {
  return kFactor(p) * dT ** B * areaMil2(widthMm, p.thicknessUm) ** C
}

/** Temperature rise in °C for a current flowing in a trace of the given width. */
export function riseForCurrent(i: number, widthMm: number, p: TraceParams): number {
  return (i / (kFactor(p) * areaMil2(widthMm, p.thicknessUm) ** C)) ** (1 / B)
}

export const RHO_20 = 1.724e-8 // Ω·m, annealed copper
export const ALPHA_CU = 0.00393 // 1/°C

/** Copper resistivity (Ω·m) at temperature tC. */
export const resistivity = (tC: number) => RHO_20 * (1 + ALPHA_CU * (tC - 20))

/** DC resistance in Ω of a straight trace. */
export function traceResistance(lengthMm: number, widthMm: number, thicknessUm: number, tC = 20): number {
  return (resistivity(tC) * (lengthMm / 1000)) / ((widthMm / 1000) * (thicknessUm / 1e6))
}

export interface ViaParams {
  /** Finished hole diameter, mm. */
  holeMm: number
  /** Barrel plating thickness, µm. */
  platingUm: number
  /** Barrel length (board thickness), mm. */
  lengthMm: number
  count: number
}

/** Plated barrel cross-section in mil² (one via): pi*(D+t)*t for finished hole D and plating t. */
export function viaAreaMil2(v: ViaParams): number {
  const d = v.holeMm / MIL_MM
  const t = v.platingUm / 1000 / MIL_MM
  return Math.PI * (d + t) * t
}

/** Maximum current of a via group at a temperature rise (IPC-2221 external curve on the barrel area). */
export function viaCurrent(v: ViaParams, dT: number): number {
  return v.count * 0.048 * dT ** B * viaAreaMil2(v) ** C
}

/** Resistance of the via group in Ω at temperature tC. */
export function viaResistance(v: ViaParams, tC = 20): number {
  const aM2 = (viaAreaMil2(v) * MIL_MM ** 2) / 1e6 // mil² to m²
  return resistivity(tC) * (v.lengthMm / 1000) / aM2 / v.count
}

export interface SpacingTable {
  id: string
  /** Upper voltage bound of each band (V, DC or AC peak) and the minimum spacing in mm. */
  mm: number[]
  /** Extra mm per volt above 500 V. */
  perVolt: number
}

export const VOLTAGE_BANDS = [15, 30, 50, 100, 150, 170, 250, 300, 500] as const

/** IPC-2221 Table 6-1, minimum conductor spacing in mm. */
export const SPACING_TABLES: SpacingTable[] = [
  { id: 'B1', mm: [0.05, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.2, 0.25], perVolt: 0.0025 },
  { id: 'B2', mm: [0.1, 0.1, 0.6, 0.6, 0.6, 1.25, 1.25, 1.25, 2.5], perVolt: 0.005 },
  { id: 'B3', mm: [0.1, 0.1, 0.6, 1.5, 3.2, 3.2, 6.4, 12.5, 12.5], perVolt: 0.025 },
  { id: 'B4', mm: [0.05, 0.1, 0.13, 0.13, 0.4, 0.4, 0.4, 0.4, 0.8], perVolt: 0.00305 },
  { id: 'A5', mm: [0.13, 0.13, 0.13, 0.13, 0.4, 0.4, 0.4, 0.4, 0.8], perVolt: 0.00305 },
  { id: 'A6', mm: [0.13, 0.25, 0.4, 0.5, 0.8, 0.8, 0.8, 0.8, 1.5], perVolt: 0.00305 },
]

/** Minimum spacing in mm for a voltage between conductors. */
export function minSpacing(voltage: number, tableId: string): number {
  const tbl = SPACING_TABLES.find((x) => x.id === tableId) ?? SPACING_TABLES[0]
  const v = Math.abs(voltage)
  const i = VOLTAGE_BANDS.findIndex((b) => v <= b)
  if (i >= 0) return tbl.mm[i]
  return tbl.mm[tbl.mm.length - 1] + (v - 500) * tbl.perVolt
}

/** Chart series: max current vs trace width for one copper thickness. */
export function currentCurve(widthsMm: number[], dT: number, p: TraceParams): number[] {
  return widthsMm.map((w) => currentForWidth(w, dT, p))
}
