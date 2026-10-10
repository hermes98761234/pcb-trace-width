import { describe, expect, it } from 'vitest'
import {
  currentForWidth, kFactor, minSpacing, ozToUm, resistivity, riseForCurrent, traceResistance,
  viaAreaMil2, viaCurrent, viaResistance, widthForCurrent, type TraceParams,
} from './pcb'

const ext1oz: TraceParams = { standard: '2221', layer: 'external', thicknessUm: ozToUm(1), plane: false }
const int1oz: TraceParams = { ...ext1oz, layer: 'internal' }

describe('IPC-2221 trace width', () => {
  it('1 A, 10 C rise, 1 oz external is about 11.8 mil (0.30 mm)', () => {
    const w = widthForCurrent(1, 10, ext1oz)
    expect(w / 0.0254).toBeCloseTo(11.8, 0)
    expect(w).toBeCloseTo(0.30, 2)
  })
  it('internal layers need twice-ish the area', () => {
    const e = widthForCurrent(1, 10, ext1oz)
    const i = widthForCurrent(1, 10, int1oz)
    expect(i / e).toBeCloseTo(2 ** (1 / 0.725), 6)
  })
  it('3 A, 20 C rise, 1 oz external is about 1.2 mm wide', () => {
    expect(widthForCurrent(3, 20, ext1oz)).toBeGreaterThan(0.9)
    expect(widthForCurrent(3, 20, ext1oz)).toBeLessThan(1.3)
  })
  it('width, current and rise are consistent inverses', () => {
    const w = widthForCurrent(2.5, 15, int1oz)
    expect(currentForWidth(w, 15, int1oz)).toBeCloseTo(2.5, 9)
    expect(riseForCurrent(2.5, w, int1oz)).toBeCloseTo(15, 6)
  })
  it('thicker copper gives a narrower trace', () => {
    expect(widthForCurrent(2, 10, { ...ext1oz, thicknessUm: ozToUm(2) })).toBeLessThan(widthForCurrent(2, 10, ext1oz))
  })
})

describe('IPC-2152 approximation', () => {
  it('internal equals external and a plane helps', () => {
    const a = { ...ext1oz, standard: '2152' as const }
    expect(kFactor({ ...a, layer: 'internal' })).toBe(kFactor(a))
    expect(kFactor({ ...a, plane: true })).toBeGreaterThan(kFactor(a))
    expect(widthForCurrent(1, 10, { ...a, layer: 'internal' })).toBeLessThan(widthForCurrent(1, 10, int1oz))
  })
})

describe('resistance', () => {
  it('copper resistivity is 1.724e-8 at 20 C and grows with temperature', () => {
    expect(resistivity(20)).toBeCloseTo(1.724e-8, 12)
    expect(resistivity(120) / resistivity(20)).toBeCloseTo(1.393, 3)
  })
  it('100 mm x 1 mm x 1 oz is about 49.5 mOhm', () => {
    expect(traceResistance(100, 1, ozToUm(1))).toBeCloseTo(0.04954, 4)
  })
})

describe('vias', () => {
  it('barrel area of a 0.3 mm hole with 25 um plating', () => {
    // pi * (0.3 + 0.025) mm * 0.025 mm = 0.02553 mm² = 39.57 mil²
    expect(viaAreaMil2({ holeMm: 0.3, platingUm: 25, lengthMm: 1.6, count: 1 })).toBeCloseTo(39.57, 1)
  })
  it('current scales with via count, resistance falls', () => {
    const v = { holeMm: 0.3, platingUm: 25, lengthMm: 1.6, count: 1 }
    expect(viaCurrent({ ...v, count: 4 }, 10)).toBeCloseTo(4 * viaCurrent(v, 10), 9)
    expect(viaResistance({ ...v, count: 4 })).toBeCloseTo(viaResistance(v) / 4, 9)
    // one via is roughly 0.5-1 A at 10 C and about 1-2 mOhm... check range
    expect(viaCurrent(v, 10)).toBeGreaterThan(0.8)
    expect(viaCurrent(v, 10)).toBeLessThan(2)
    expect(viaResistance(v)).toBeGreaterThan(0.001)
    expect(viaResistance(v)).toBeLessThan(0.003)
  })
})

describe('IPC-2221 conductor spacing', () => {
  it('matches Table 6-1', () => {
    expect(minSpacing(12, 'B1')).toBe(0.05)
    expect(minSpacing(12, 'B2')).toBe(0.1)
    expect(minSpacing(50, 'B2')).toBe(0.6)
    expect(minSpacing(51, 'B2')).toBe(0.6)
    expect(minSpacing(250, 'B2')).toBe(1.25)
    expect(minSpacing(400, 'B2')).toBe(2.5)
    expect(minSpacing(100, 'B4')).toBe(0.13)
    expect(minSpacing(170, 'B3')).toBe(3.2)
  })
  it('adds a per-volt amount above 500 V', () => {
    expect(minSpacing(1000, 'B2')).toBeCloseTo(2.5 + 500 * 0.005, 9)
    expect(minSpacing(1000, 'B4')).toBeCloseTo(0.8 + 500 * 0.00305, 9)
  })
})
