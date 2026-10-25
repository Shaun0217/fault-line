import { describe, it, expect } from 'vitest'
import { siteClassFromVs30 } from './siteclass'

describe('ASCE 7-16 Table 20.3-1 site classification', () => {
  it('classifies at and around the boundaries', () => {
    expect(siteClassFromVs30(2000)).toBe('A')
    expect(siteClassFromVs30(1500.01)).toBe('A')
    expect(siteClassFromVs30(1500)).toBe('B')
    expect(siteClassFromVs30(761)).toBe('B')
    expect(siteClassFromVs30(760)).toBe('C')
    expect(siteClassFromVs30(361)).toBe('C')
    expect(siteClassFromVs30(360)).toBe('D')
    expect(siteClassFromVs30(180)).toBe('D')
    expect(siteClassFromVs30(179.9)).toBe('E')
  })
  it('never returns a factor or class F', () => {
    for (const v of [100, 200, 400, 900, 1600]) expect(['A', 'B', 'C', 'D', 'E']).toContain(siteClassFromVs30(v))
  })
  it('rejects nonsense', () => {
    expect(() => siteClassFromVs30(0)).toThrow()
    expect(() => siteClassFromVs30(NaN)).toThrow()
  })
})
