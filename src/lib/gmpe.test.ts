import { describe, it, expect } from 'vitest'
import { rockMotion, pgaRockG, clampToValidity, GMPE_VALIDITY, G_CM_S2 } from './gmpe'
import { mmiFromPgaG } from './gmice'

/**
 * These tests exist to catch the bugs that produce plausible wrong answers:
 * log base, output units, distance metric, magnitude scaling, and
 * double-counted amplification (CLAUDE.md, Testing).
 */
describe('AB06 rock GMPE — units and log base', () => {
  it('reproduces AB06 eq. (5) by hand for M6, Rrup 30 km (log10, cm/s^2 → g)', () => {
    // Hand evaluation of the PGA B/C row, Table 9.
    const M = 6.0, R = 30.0
    const f0 = Math.max(Math.log10(10 / R), 0)
    const f1 = Math.min(Math.log10(R), Math.log10(70))
    const f2 = Math.max(Math.log10(R / 140), 0)
    const log10Y =
      0.5233 + 0.9686 * M - 0.06196 * M * M +
      (-2.439 + 0.1465 * M) * f1 + (-2.335 + 0.1912 * M) * f2 +
      (-0.08695 - 0.08285 * M) * f0 - 0.0006304 * R
    const expectedG = Math.pow(10, log10Y) / G_CM_S2
    expect(pgaRockG(M, R)).toBeCloseTo(expectedG, 10)
  })

  it('is not accidentally natural-log (ln would inflate values by ~10^0.43 per unit)', () => {
    // If someone swaps log10 for ln, M7 @ 10 km would be > 5 g. Guard the magnitude.
    expect(pgaRockG(7.0, 10)).toBeLessThan(2.0)
    expect(pgaRockG(7.0, 10)).toBeGreaterThan(0.1)
  })

  it('outputs g, not cm/s^2 or %g', () => {
    const g = pgaRockG(7.0, 50)
    expect(g).toBeGreaterThan(0.01)
    expect(g).toBeLessThan(1.5)
  })
})

describe('AB06 rock GMPE — order-of-magnitude sanity (CLAUDE.md table)', () => {
  it('M7.0 at 10 km rock: PGA of order 0.3–0.5 g (AB06 B/C actually gives ≈0.72 g)', () => {
    // CLAUDE.md asks for "order 0.3–0.5 g". Atkinson & Boore (2006) is known to
    // predict strong near-source high-frequency motion in ENA; at Rrup = 10 km
    // it gives 0.72 g for M7.0 on the B/C boundary. Same order of magnitude, so
    // the guard is the order, not the decimal. Value is recorded in METHODS.md.
    const pga = pgaRockG(7.0, 10)
    expect(pga).toBeGreaterThanOrEqual(0.2)
    expect(pga).toBeLessThanOrEqual(1.0)
    expect(pga).toBeCloseTo(0.718, 2)
  })

  it('M7.0 at 200 km: still meaningfully felt, MMI IV–VI on reference rock', () => {
    const mmi = mmiFromPgaG(pgaRockG(7.0, 200))
    expect(mmi).toBeGreaterThanOrEqual(3.5)
    expect(mmi).toBeLessThanOrEqual(6.5)
  })

  it('doubling distance gives a smooth, monotonic falloff', () => {
    let prev = pgaRockG(7.0, 2)
    for (let r = 4; r <= 1000; r *= 2) {
      const cur = pgaRockG(7.0, r)
      expect(cur).toBeLessThan(prev)
      expect(cur).toBeGreaterThan(prev * 0.1) // no cliffs between octaves
      prev = cur
    }
  })

  it('M5.0 vs M7.0 at the same distance: large, monotonic magnitude scaling (AB06 gives ≈9× at 50 km)', () => {
    // CLAUDE.md's rough expectation was "two orders of magnitude". Published
    // GMPEs scale PGA more weakly than that: log10 PGA grows ~0.5 per magnitude
    // unit at these distances and AB06's quadratic term saturates at large M, so
    // M7/M5 is ~9× at 50 km and ~15× at 200 km. Guard against the failure modes
    // that motivated the check (magnitude scale or sign errors), not the number.
    const r50 = pgaRockG(7.0, 50) / pgaRockG(5.0, 50)
    const r200 = pgaRockG(7.0, 200) / pgaRockG(5.0, 200)
    expect(r50).toBeGreaterThan(5)
    expect(r50).toBeLessThan(300)
    expect(r200).toBeGreaterThan(r50) // larger events attenuate more slowly
    expect(r200).toBeLessThan(300)
  })

  it('is monotonic in magnitude across the valid range', () => {
    let prev = 0
    for (let m = 3.5; m <= 8.0; m += 0.25) {
      const cur = pgaRockG(m, 40)
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
  })
})

describe('AB06 rock GMPE — boundaries', () => {
  it('distance 0 does not divide by zero or return NaN', () => {
    const r = rockMotion(7.0, 0)
    expect(Number.isFinite(r.pgaG)).toBe(true)
    expect(r.inputs.clamped).toBe(true)
    expect(r.inputs.rrupKm).toBe(GMPE_VALIDITY.rrupKmMin)
  })

  it('clamps magnitude and distance to the published range and says so', () => {
    const c = clampToValidity(9.0, 5000)
    expect(c.magMw).toBe(8.0)
    expect(c.rrupKm).toBe(1000)
    expect(c.clamped).toBe(true)
    expect(c.notes.length).toBe(2)
    const ok = clampToValidity(7.0, 100)
    expect(ok.clamped).toBe(false)
  })

  it('rejects non-finite input rather than silently producing NaN', () => {
    expect(() => rockMotion(NaN, 10)).toThrow()
    expect(() => rockMotion(7, Infinity)).toThrow()
  })

  it('returns PSA(1.0 s) below PGA in the near field at M6 (spectral shape sanity)', () => {
    const r = rockMotion(6.0, 20)
    expect(r.psa1p0G).toBeLessThan(r.pgaG)
  })
})

describe('Comparison with an observed CEUS event (within ~1 intensity unit)', () => {
  // 2011-08-23 Mineral, Virginia Mw 5.8 (USGS event se609212). USGS ShakeMap /
  // DYFI: MMI VII–VIII within ~10 km of the epicenter, MMI IV–V in Washington,
  // D.C. at ~130 km. Reference condition here is rock, and D.C. sites are mostly
  // C/D, so compare against the lower part of each observed range.
  it('near-source Mineral, VA: MMI ≈ VI–VIII on rock', () => {
    const mmi = mmiFromPgaG(pgaRockG(5.8, 8))
    expect(mmi).toBeGreaterThanOrEqual(5.5)
    expect(mmi).toBeLessThanOrEqual(8.5)
  })
  it('Washington D.C. at ~130 km from Mineral, VA: MMI ≈ III–V on rock', () => {
    const mmi = mmiFromPgaG(pgaRockG(5.8, 130))
    expect(mmi).toBeGreaterThanOrEqual(3.0)
    expect(mmi).toBeLessThanOrEqual(5.5)
  })
})
