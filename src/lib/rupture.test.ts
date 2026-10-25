import { describe, it, expect } from 'vitest'
import { rrupToPlaneKm, distanceToTraceKm, rrupFromRjbKm, destination } from './distance'
import { segmentById, rrupToSegmentKm } from './faults'
import { scenarioAtSite } from './pipeline'
import { mmiSigmaWithPgaUncertainty, MMI_SIGMA_FROM_PGA } from './gmice'
import { GMPE_SIGMA_LOG10 } from './gmpe'

describe('rupture distance to a dipping plane', () => {
  const a: [number, number] = [-89.6, 36.0]
  const b = destination(a, 0, 40) // 40 km due north
  it('vertical plane reduces to sqrt(Rjb² + Ztor²)', () => {
    const site = destination(destination(a, 0, 20), 90, 30)
    const rjb = distanceToTraceKm(site, [a, b])
    expect(rrupToPlaneKm(site, [a, b], 10, 15, 90, null)).toBeCloseTo(rrupFromRjbKm(rjb, 10), 3)
  })
  it('hanging-wall site is closer than footwall site at equal Rjb for a 40° plane dipping east', () => {
    const mid = destination(a, 0, 20)
    const hw = destination(mid, 90, 12) // east = hanging wall (plane descends toward 090)
    const fw = destination(mid, 270, 12)
    const dHW = rrupToPlaneKm(hw, [a, b], 10, 15, 40, 90)
    const dFW = rrupToPlaneKm(fw, [a, b], 10, 15, 40, 90)
    expect(dHW).toBeLessThan(dFW)
    expect(dFW).toBeCloseTo(rrupFromRjbKm(12, 10), 2) // footwall sees only the top edge
    // Bottom edge sits 15·cos40 ≈ 11.5 km east at depth 10 + 15·sin40 ≈ 19.6 km; the HW site at 12 km east is nearly above it.
    expect(dHW).toBeLessThan(Math.hypot(12, 10))
    expect(dHW).toBeGreaterThanOrEqual(10)
  })
  it('never returns less than the top-of-rupture depth', () => {
    for (const site of [a, destination(a, 0, 20), destination(a, 180, 5), destination(a, 45, 3)] as [number, number][]) {
      expect(rrupToPlaneKm(site, [a, b], 10, 15, 40, 90)).toBeGreaterThanOrEqual(10 - 1e-9)
    }
  })
  it('Reelfoot: Tiptonville (hanging wall, SW) is closer than a mirror point on the NE', () => {
    const seg = segmentById('reelfoot')
    const sw = rrupToSegmentKm([-89.55, 36.35], seg)
    const ne = rrupToSegmentKm([-89.25, 36.55], seg)
    expect(sw).toBeLessThan(ne)
  })
})

describe('uncertainty propagation and percentile', () => {
  it('combined MMI sigma exceeds the GMICE sigma and equals the quadrature sum on the upper segment', () => {
    const s = mmiSigmaWithPgaUncertainty(0.3, GMPE_SIGMA_LOG10)
    expect(s).toBeGreaterThan(MMI_SIGMA_FROM_PGA)
    expect(s).toBeCloseTo(Math.sqrt((3.7 * 0.3) ** 2 + 0.66 ** 2), 6)
  })
  it('epsilon = 1 raises the reference PGA by one GMPE sigma before amplification and never after', () => {
    const med = scenarioAtSite(7.5, 40, 'D', 0)
    const p84 = scenarioAtSite(7.5, 40, 'D', 1)
    expect(p84.pgaReferenceUsedG / med.pgaReferenceUsedG).toBeCloseTo(Math.pow(10, GMPE_SIGMA_LOG10), 9)
    expect(p84.amplified.pgaReferenceG).toBeCloseTo(p84.pgaReferenceUsedG, 12)
    expect(p84.mmi).toBeGreaterThan(med.mmi)
    expect(p84.range.high.level).toBeGreaterThanOrEqual(med.range.high.level)
  })
})
