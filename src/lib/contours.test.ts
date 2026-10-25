import { describe, it, expect } from 'vitest'
import { buildContourIndex, interpolateContours } from './contours'

// Two straight north–south contours 0.2° apart (≈18 km at 35.5°N): -100 m at lon -90.2, -300 m at lon -90.0.
const idx = buildContourIndex([
  { m: -100, coords: Array.from({ length: 21 }, (_, i) => [-90.2, 35 + i * 0.05] as [number, number]) },
  { m: -300, coords: Array.from({ length: 21 }, (_, i) => [-90.0, 35 + i * 0.05] as [number, number]) },
  { m: -500, coords: Array.from({ length: 21 }, (_, i) => [-89.8, 35 + i * 0.05] as [number, number]) },
])

describe('contour interpolation', () => {
  it('returns the contour value on the contour', () => {
    expect(interpolateContours(idx, [-90.2, 35.5])!.elevM).toBeCloseTo(-100, 6)
  })
  it('is linear between two contours', () => {
    const r = interpolateContours(idx, [-90.1, 35.5])!
    expect(r.method).toBe('bracketed')
    expect(r.elevM).toBeCloseTo(-200, 0)
    expect(interpolateContours(idx, [-90.15, 35.5])!.elevM).toBeCloseTo(-150, 0)
  })
  it('brackets with the correct neighbour on either side of the middle contour', () => {
    expect(interpolateContours(idx, [-89.9, 35.5])!.elevM).toBeCloseTo(-400, 0)
  })
  it('returns null far outside the mapped contours', () => {
    expect(interpolateContours(idx, [-85.0, 35.5])).toBeNull()
  })
  it('is monotonic across the field', () => {
    let prev = Infinity
    for (let lon = -90.2; lon <= -89.8 + 1e-9; lon += 0.02) {
      const z = interpolateContours(idx, [lon, 35.5])!.elevM
      expect(z).toBeLessThanOrEqual(prev + 1e-9)
      prev = z
    }
  })
})
