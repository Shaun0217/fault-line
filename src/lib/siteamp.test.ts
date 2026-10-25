import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fPga, fa, amplifyPga, REFERENCE_CONVERSION_FACTOR, DESIGN_MAP_REFERENCE_VS30_MS, fPgaTable } from './siteamp'
import { GMPE_REFERENCE_VS30_MS } from './gmpe'
import { intensityFromReferencePga, scenarioAtSite } from './pipeline'
import { rockMotion } from './gmpe'
import type { SiteClass } from './siteclass'

interface Snapshot {
  data: Record<string, Record<'B' | 'C' | 'D' | 'E', { pga: number; ss: number; fpga: number | null; fa: number | null }>>
}
const snapshot = JSON.parse(readFileSync(new URL('../../fixtures/designmaps-asce7-16-sitecoeff-grid.json', import.meta.url), 'utf8')) as Snapshot

describe('reference-condition normalization', () => {
  it('GMPE and design maps share the 760 m/s reference, so the factor is exactly 1', () => {
    expect(GMPE_REFERENCE_VS30_MS).toBe(760)
    expect(DESIGN_MAP_REFERENCE_VS30_MS).toBe(760)
    expect(REFERENCE_CONVERSION_FACTOR).toBe(1)
  })
})

describe('ASCE 7-16 site coefficients vs USGS design service snapshot', () => {
  it('F_PGA matches the service at every location and site class (Table 11.8-1)', () => {
    let checked = 0
    for (const [, byClass] of Object.entries(snapshot.data)) {
      for (const sc of ['B', 'C', 'D', 'E'] as const) {
        const row = byClass[sc]
        if (row.fpga == null) continue
        expect(fPga(sc, row.pga)).toBeCloseTo(row.fpga, 2)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(30)
  })

  it('Fa matches the service wherever the service publishes one (Table 11.4-1)', () => {
    let checked = 0
    for (const [, byClass] of Object.entries(snapshot.data)) {
      for (const sc of ['B', 'C', 'D', 'E'] as const) {
        const row = byClass[sc]
        if (row.fa == null) continue
        expect(fa(sc, row.ss).fa).toBeCloseTo(row.fa, 2)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(25)
  })

  it('Site Class E above Ss 1.0 g falls back to the Class C value with a note (§11.4.8 Exc. 1)', () => {
    const r = fa('E', 1.2)
    expect(r.fa).toBeCloseTo(fa('C', 1.2).fa, 10)
    expect(r.note).toMatch(/11\.4\.8/)
    expect(fa('E', 0.4).note).toBeUndefined()
    // Between the last numeric column (0.75) and the first §11.4.8 column (1.0) the value holds flat.
    expect(fa('E', 0.924).fa).toBe(1.3)
    expect(fa('E', 0.924).note).toBeUndefined()
  })

  it('interpolates linearly and is flat beyond the end columns', () => {
    expect(fPga('D', 0.15)).toBeCloseTo(1.5, 10)
    expect(fPga('D', 0.05)).toBe(1.6)
    expect(fPga('D', 2.0)).toBe(1.1)
    expect(fPga('A', 0.3)).toBe(0.8)
  })
})

describe('readout vs scenario amplification consistency (Hard Invariant 1)', () => {
  it('the same reference PGA and site class produce EXACTLY the same site PGA and MMI on both paths', () => {
    for (const sc of ['A', 'B', 'C', 'D', 'E'] as SiteClass[]) {
      for (const [m, r] of [[7.5, 25], [6.0, 80], [7.7, 5]] as const) {
        const scenario = scenarioAtSite(m, r, sc)
        // The readout path receives a reference PGA from the design maps; emulate
        // that with the identical reference number the scenario used.
        const readout = intensityFromReferencePga(rockMotion(m, r).pgaG, sc)
        expect(readout.amplified.pgaSiteG).toBe(scenario.amplified.pgaSiteG)
        expect(readout.mmi).toBe(scenario.mmi)
        expect(readout.amplified.fPga).toBe(scenario.amplified.fPga)
      }
    }
  })

  it('amplification is applied exactly once (site PGA / reference PGA equals the table factor)', () => {
    const a = amplifyPga(0.25, 'D')
    expect(a.pgaSiteG / a.pgaReferenceG).toBeCloseTo(fPga('D', 0.25), 12)
    expect(fPga('D', 0.25)).toBeCloseTo(1.35, 10)
  })

  it('soft soil amplifies weak motion more than strong motion (nonlinearity preserved)', () => {
    expect(fPga('E', 0.1)).toBeGreaterThan(fPga('E', 0.6))
    expect(fPga('E', 0.1)).toBeGreaterThan(fPga('D', 0.1))
  })

  it('table export for renderers reproduces the function', () => {
    const t = fPgaTable([0.1, 0.35, 0.9])
    expect(t.E[1]).toBeCloseTo(fPga('E', 0.35), 12)
    expect(t.B).toEqual([0.9, 0.9, 0.9])
  })
})
