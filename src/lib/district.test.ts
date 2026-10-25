import { describe, it, expect } from 'vitest'
import { sampleSite, validateGrid, liquefactionScreen, sampleTransect, type DistrictGrid } from './district'

function tinyGrid(): DistrictGrid {
  // 2 x 3 grid, step 1°, SW corner (35, -90)
  return {
    meta: { generatedAt: 't', designMapEdition: 'ASCE7-16', vs30Method: 'test', elevationSource: 'test', stepDeg: 1, note: '' },
    lat0: 35, lon0: -90, stepDeg: 1, rows: 2, cols: 3,
    vs30: [150, 200, 400, 250, 700, 900],
    slope: [0, 0, 0, 0, 0, 0],
    elev: [80, 80, 80, 90, 90, 90],
    pga: [1.0, 0.5, 0.25, 0.8, 0.4, 0.2],
    ss: [2, 1, 0.5, 1.6, 0.8, 0.4],
    s1: [1, 0.5, 0.25, 0.8, 0.4, 0.2],
    pzElev: [-900, -500, null, -800, -400, null],
    kElev: [-600, -200, 0, -500, -100, null],
  }
}

describe('district grid sampling', () => {
  it('bilinear interpolation of mapped values; nearest-cell site class', () => {
    const g = tinyGrid()
    const p = sampleSite(g, 35.5, -89.5)
    expect(p.pgaRefG).toBeCloseTo((1.0 + 0.5 + 0.8 + 0.4) / 4, 10)
    expect(p.inGrid).toBe(true)
    expect(p.siteClassSource).toBe('slope-proxy')
  })
  it('categorical fields come from the nearest cell (no averaging across classes)', () => {
    const g = tinyGrid()
    expect(sampleSite(g, 35.1, -89.9).siteClass).toBe('E')
    expect(sampleSite(g, 35.9, -88.1).siteClass).toBe('B')
  })
  it('outside the grid returns a flagged reference-rock default, never NaN class', () => {
    const p = sampleSite(tinyGrid(), 40, -80)
    expect(p.inGrid).toBe(false)
    expect(p.siteClassSource).toBe('default')
    expect(p.siteClass).toBe('C')
    expect(p.liquefactionProxy).toBe('unknown')
  })
  it('liquefaction screen is a coarse three-level proxy', () => {
    expect(liquefactionScreen(150)).toBe('higher')
    expect(liquefactionScreen(200)).toBe('moderate')
    expect(liquefactionScreen(300)).toBe('lower')
  })
  it('validates array lengths and edition', () => {
    const g = tinyGrid()
    expect(() => validateGrid(g)).not.toThrow()
    expect(() => validateGrid({ ...g, pga: [1] })).toThrow()
    expect(() => validateGrid({ ...g, meta: { ...g.meta, designMapEdition: 'ASCE7-22' } })).toThrow()
  })
  it('derives bedrock depth and Cenozoic thickness from the horizons, null where not contoured', () => {
    const g = tinyGrid()
    const p = sampleSite(g, 35.1, -89.9)
    expect(p.bedrockDepthM).toBe(80 + 900)
    expect(p.cenozoicThicknessM).toBe(80 + 600)
    const q = sampleSite(g, 35.1, -87.9)
    expect(q.bedrockDepthM).toBeNull()
    expect(q.cenozoicThicknessM).toBe(80)
  })
  it('samples a transect with monotonic distance and horizon values from the grid', () => {
    const t = sampleTransect(tinyGrid(), [-90, 35], [-88, 35], 4)
    expect(t.length).toBe(5)
    for (let i = 1; i < t.length; i++) expect(t[i].distKm).toBeGreaterThan(t[i - 1].distKm)
    expect(t[0].topPaleozoicElevM).toBe(-900)
    expect(t[4].topPaleozoicElevM).toBeNull()
  })
})
