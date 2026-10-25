import { describe, it, expect } from 'vitest'
import { vs30FromSlopeStableContinent, slopeFromStencil } from './vs30proxy'
import { siteClassFromVs30 } from './siteclass'

describe('Wald & Allen 2007 stable-continent slope proxy', () => {
  it('maps bin boundaries to the published Vs30 ranges', () => {
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(1e-5).vs30Ms)).toBe('E')
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(1e-3).vs30Ms)).toBe('D')
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(3e-3).vs30Ms)).toBe('D')
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(5e-3).vs30Ms)).toBe('D') // 300–360 m/s is still D under ASCE 7-16
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(0.01).vs30Ms)).toBe('C')
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(0.02).vs30Ms)).toBe('C') // 620–760 m/s: ASCE 7-16 B needs > 760
    expect(siteClassFromVs30(vs30FromSlopeStableContinent(0.1).vs30Ms)).toBe('B')
  })
  it('returns the bin bounds so the UI can show the range instead of a point value', () => {
    const p = vs30FromSlopeStableContinent(3e-3)
    expect(p.vs30LowMs).toBe(240)
    expect(p.vs30HighMs).toBe(300)
  })
  it('flat Mississippi floodplain (few metres over 2 km) is E or soft D', () => {
    // 2 m change across 2 × 926 m
    const s = slopeFromStencil(51, 49, 50, 50, 926, 750)
    expect(s).toBeCloseTo(2 / 1852, 6)
    expect(['D', 'E']).toContain(siteClassFromVs30(vs30FromSlopeStableContinent(s).vs30Ms))
  })
  it('rejects negative or NaN slope', () => {
    expect(() => vs30FromSlopeStableContinent(-1)).toThrow()
    expect(() => vs30FromSlopeStableContinent(NaN)).toThrow()
  })
})
