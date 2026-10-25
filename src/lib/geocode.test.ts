import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCensusResponse } from './geocode'

const fx = JSON.parse(readFileSync(new URL('../../fixtures/census-geocoder-memphis.json', import.meta.url), 'utf8'))

describe('census geocoder parsing', () => {
  it('extracts lon/lat (x = lon, y = lat) and a storable place label', () => {
    const r = parseCensusResponse(fx)!
    expect(r.lat).toBeCloseTo(35.1384, 3)
    expect(r.lon).toBeCloseTo(-90.0596, 3)
    expect(r.placeLabel).toBe('Memphis, TN 38103')
    expect(r.placeLabel).not.toMatch(/VANCE/)
  })
  it('returns null for no match', () => {
    expect(parseCensusResponse({ result: { addressMatches: [] } })).toBeNull()
  })
})
