import { describe, it, expect } from 'vitest'
import { NMSZ_SEGMENTS, SCENARIO_PRESETS, segmentById, SCENARIO_MAG_MIN, SCENARIO_MAG_MAX } from './faults'
import { distanceToTraceKm, rrupFromRjbKm } from './distance'
import { GMPE_VALIDITY } from './gmpe'

describe('NMSZ segment geometry', () => {
  it('all vertices are inside the New Madrid region', () => {
    for (const s of NMSZ_SEGMENTS) for (const [lon, lat] of s.trace) {
      expect(lon).toBeGreaterThan(-91)
      expect(lon).toBeLessThan(-88.5)
      expect(lat).toBeGreaterThan(35)
      expect(lat).toBeLessThan(37.5)
    }
  })
  it('Reelfoot Lake (36.37, -89.40) is within ~10 km of the Reelfoot trace', () => {
    expect(distanceToTraceKm([-89.4, 36.37], segmentById('reelfoot').trace)).toBeLessThan(10)
  })
  it('downtown Memphis is roughly 50–70 km from the southwest arm', () => {
    const d = distanceToTraceKm([-90.05, 35.15], segmentById('sw-arm').trace)
    expect(d).toBeGreaterThan(45)
    expect(d).toBeLessThan(75)
  })
  it('Ztor keeps Rrup inside GMPE validity even on the trace', () => {
    for (const s of NMSZ_SEGMENTS) expect(rrupFromRjbKm(0, s.ztorKm)).toBeGreaterThanOrEqual(GMPE_VALIDITY.rrupKmMin)
  })
  it('presets reference existing segments and magnitudes inside slider and GMPE bounds', () => {
    for (const p of SCENARIO_PRESETS) {
      expect(() => segmentById(p.segmentId)).not.toThrow()
      expect(p.magMw).toBeGreaterThanOrEqual(SCENARIO_MAG_MIN)
      expect(p.magMw).toBeLessThanOrEqual(SCENARIO_MAG_MAX)
      expect(p.note).toMatch(/estimate|magnitude/i)
    }
    expect(SCENARIO_MAG_MIN).toBeGreaterThanOrEqual(GMPE_VALIDITY.magMwMin)
    expect(SCENARIO_MAG_MAX).toBeLessThanOrEqual(GMPE_VALIDITY.magMwMax)
  })
  it('no copy implies prediction', () => {
    const text = JSON.stringify(NMSZ_SEGMENTS) + JSON.stringify(SCENARIO_PRESETS)
    expect(text).not.toMatch(/overdue|will strike|is likely to occur|imminent|predict/i)
  })
})
