import { describe, it, expect } from 'vitest'
import { mmiFromPgaG, pgaGFromMmi, mmiBand, mmiRange, MMI_SIGMA_FROM_PGA } from './gmice'
import { G_CM_S2 } from './gmpe'

describe('Worden et al. 2012 GMICE', () => {
  it('matches the bilinear form on both sides of the knee (log10 PGA = 1.57 → MMI ≈ 4.22)', () => {
    const knee = Math.pow(10, 1.57) / G_CM_S2
    // ShakeMap uses the upper segment at exactly T1; the two published segments
    // meet within 0.005 intensity units there because of coefficient rounding.
    expect(mmiFromPgaG(knee)).toBeCloseTo(-1.60 + 3.70 * 1.57, 6)
    expect(mmiFromPgaG(knee * 0.99)).toBeCloseTo(1.78 + 1.55 * (1.57 + Math.log10(0.99)), 6)
    expect(mmiFromPgaG(knee)).toBeCloseTo(4.22, 1)
  })

  it('is continuous across the knee', () => {
    const k = Math.pow(10, 1.57) / G_CM_S2
    expect(Math.abs(mmiFromPgaG(k * 1.0001) - mmiFromPgaG(k * 0.9999))).toBeLessThan(0.01)
  })

  it('takes g, not cm/s^2: 0.1 g is roughly MMI VI, not off the scale', () => {
    const m = mmiFromPgaG(0.1)
    expect(m).toBeGreaterThan(5.5)
    expect(m).toBeLessThan(7.0)
  })

  it('upper segment: 0.5 g ≈ MMI VIII–IX', () => {
    const m = mmiFromPgaG(0.5)
    expect(m).toBeGreaterThan(8.0)
    expect(m).toBeLessThan(9.5)
  })

  it('is monotonic and clamped to 1..10', () => {
    let prev = 0
    for (let lg = -4; lg <= 1; lg += 0.1) {
      const m = mmiFromPgaG(Math.pow(10, lg))
      expect(m).toBeGreaterThanOrEqual(prev)
      expect(m).toBeGreaterThanOrEqual(1)
      expect(m).toBeLessThanOrEqual(10)
      prev = m
    }
    expect(mmiFromPgaG(0)).toBe(1)
  })

  it('inverse round-trips on both segments', () => {
    for (const mmi of [3.5, 5.0, 7.0, 8.5]) expect(mmiFromPgaG(pgaGFromMmi(mmi))).toBeCloseTo(mmi, 6)
  })

  it('bands round to integer intensity with Roman numerals and legend wording', () => {
    expect(mmiBand(6.4)).toMatchObject({ level: 6, roman: 'VI', shaking: 'Strong' })
    expect(mmiBand(7.5).level).toBe(8)
    expect(mmiBand(12).level).toBe(10)
  })

  it('range spans ±1 sigma (0.66) as integer bands', () => {
    const r = mmiRange(7.0)
    expect(MMI_SIGMA_FROM_PGA).toBe(0.66)
    expect(r.low.level).toBe(6)
    expect(r.high.level).toBe(8)
  })
})
