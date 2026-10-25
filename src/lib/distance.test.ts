import { describe, it, expect } from 'vitest'
import { haversineKm, distanceToTraceKm, rrupFromRjbKm, destination, nearestPointOnTrace } from './distance'

describe('distance geometry', () => {
  it('haversine: Memphis to Nashville ≈ 316 km', () => {
    expect(haversineKm([-90.049, 35.1495], [-86.7816, 36.1627])).toBeCloseTo(316, -1)
  })

  it('point on the trace has zero horizontal distance; Rrup then equals Ztor', () => {
    const trace = [[-89.6, 36.0], [-89.4, 36.3]] as const
    const d = distanceToTraceKm([-89.5, 36.15], trace)
    expect(d).toBeLessThan(0.5)
    expect(rrupFromRjbKm(0, 5)).toBe(5)
    expect(Number.isFinite(rrupFromRjbKm(0, 0))).toBe(true)
  })

  it('perpendicular offset from a segment matches great-circle distance', () => {
    const a: [number, number] = [-89.6, 36.0]
    const b = destination(a, 30, 60) // 60 km along bearing 030
    const mid = destination(a, 30, 30)
    const off = destination(mid, 120, 25) // 25 km perpendicular
    expect(distanceToTraceKm(off, [a, b])).toBeCloseTo(25, 0)
  })

  it('beyond the segment end the distance is to the endpoint, not the infinite line', () => {
    const a: [number, number] = [-89.6, 36.0]
    const b = destination(a, 0, 50)
    const beyond = destination(b, 0, 40) // 40 km past the north end
    expect(distanceToTraceKm(beyond, [a, b])).toBeCloseTo(40, 0)
  })

  it('handles a degenerate single-vertex trace', () => {
    expect(distanceToTraceKm([-89.0, 36.0], [[-89.0, 36.0]])).toBeCloseTo(0, 6)
  })
  it('nearestPointOnTrace lands on the segment at the foot of the perpendicular', () => {
    const a: [number, number] = [-89.6, 36.0]
    const b = destination(a, 0, 50)
    const mid = destination(a, 0, 20)
    const off = destination(mid, 90, 15)
    const p = nearestPointOnTrace(off, [a, b])
    expect(haversineKm(p, mid)).toBeLessThan(0.3)
    expect(haversineKm(p, off)).toBeCloseTo(distanceToTraceKm(off, [a, b]), 1)
  })
})
