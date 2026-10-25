import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDesignMapResponse, designMapUrl } from './designmaps'

const memphis = JSON.parse(readFileSync(new URL('../../fixtures/designmaps-asce7-16-memphis.json', import.meta.url), 'utf8'))

describe('design maps client (reference condition only)', () => {
  it('reads only the mapped values from the ASCE 7-16 fixture', () => {
    const v = parseDesignMapResponse(memphis, 'fixture')
    expect(v.edition).toBe('ASCE7-16')
    expect(v.pgaG).toBeCloseTo(0.612, 3)
    expect(v.ssG).toBeCloseTo(1.025, 3)
    expect(v.s1G).toBeCloseTo(0.347, 3)
    const raw = v as unknown as Record<string, unknown>
    expect(raw.pgam).toBeUndefined()
    expect(raw.fpga).toBeUndefined()
  })
  it('refuses another edition', () => {
    const other = { ...memphis, request: { ...memphis.request, referenceDocument: 'ASCE7-22' } }
    expect(() => parseDesignMapResponse(other)).toThrow(/edition/)
  })
  it('never puts a soil site class in the request', () => {
    expect(designMapUrl(35.1, -90.0)).not.toMatch(/siteClass/)
  })
})
