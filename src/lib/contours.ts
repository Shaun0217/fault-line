/**
 * contours.ts — interpolating a surface elevation from digitized structure
 * contours. Used by scripts/prebake.ts to put the top of Paleozoic bedrock and
 * the top of the Cretaceous under every grid cell.
 *
 * Data: Smout, B. (2025). Digital Data of Structural Contours from Previously
 * Published USGS Mississippi Embayment Studies. USGS data release,
 * https://doi.org/10.5066/P14BV2PI, which digitizes Dart, R. L. (1995), Maps of
 * upper Mississippi embayment Paleozoic and Precambrian rocks (USGS Open-File
 * Report 95-95, https://doi.org/10.3133/ofr9595) and Cushing, Boswell & Hosman
 * (1964), General geology of the Mississippi embayment (USGS Professional Paper
 * 448-B). Snapshot: fixtures/embayment-structure-contours.json.
 *
 * Method: classic two-contour linear interpolation. For a point P, find the
 * nearest vertex on each contour level; take the nearest level A and the nearest
 * level B on the *other side* of P's value ordering (the next level up or down
 * whose nearest vertex is on the opposite side of A's), and interpolate by
 * distance:  z = (zA·dB + zB·dA) / (dA + dB). If no bracketing pair exists
 * within `maxKm`, the nearest single level is returned with a flag, and beyond
 * `maxKm` the result is null (outside the mapped area). This is what a
 * draftsperson does by eye between structure contours; it is not kriging, and
 * the output is marked as interpolated wherever it is shown.
 */

import type { LonLat } from './distance'
import { EARTH_RADIUS_KM } from './distance'

export interface ContourLine {
  /** Surface elevation of this contour, metres relative to sea level. */
  m: number
  coords: LonLat[]
}

export interface ContourInterpolation {
  /** Interpolated surface elevation, metres relative to sea level. */
  elevM: number
  /** 'bracketed' when between two contour levels, 'nearest' when only one level was within reach. */
  method: 'bracketed' | 'nearest'
  /** Distance to the nearest contour vertex used, km. */
  nearestKm: number
}

const DEG = Math.PI / 180
const KM_PER_DEG = DEG * EARTH_RADIUS_KM

/** Pre-grouped contour vertices by level for fast repeated queries. */
export interface ContourIndex {
  levels: number[]
  /** Flat [lon, lat, lon, lat, ...] per level. */
  verts: Float64Array[]
}

export function buildContourIndex(lines: ContourLine[]): ContourIndex {
  const byLevel = new Map<number, number[]>()
  for (const l of lines) {
    const arr = byLevel.get(l.m) ?? []
    for (const [lon, lat] of l.coords) arr.push(lon, lat)
    byLevel.set(l.m, arr)
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b)
  return { levels, verts: levels.map((lv) => Float64Array.from(byLevel.get(lv)!)) }
}

function nearestKmToLevel(v: Float64Array, lon: number, lat: number): number {
  const kx = KM_PER_DEG * Math.cos(lat * DEG)
  let best = Infinity
  for (let i = 0; i < v.length; i += 2) {
    const dx = (v[i] - lon) * kx
    const dy = (v[i + 1] - lat) * KM_PER_DEG
    const d2 = dx * dx + dy * dy
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

export function interpolateContours(index: ContourIndex, point: LonLat, maxKm = 60): ContourInterpolation | null {
  const [lon, lat] = point
  const dists = index.levels.map((_, i) => nearestKmToLevel(index.verts[i], lon, lat))
  let a = 0
  for (let i = 1; i < dists.length; i++) if (dists[i] < dists[a]) a = i
  if (!(dists[a] <= maxKm)) return null
  // Bracket: the nearer of the adjacent levels (one step up or down).
  const candidates = [a - 1, a + 1].filter((i) => i >= 0 && i < dists.length && dists[i] <= maxKm * 2)
  if (candidates.length === 0) return { elevM: index.levels[a], method: 'nearest', nearestKm: dists[a] }
  const b = candidates.length === 1 ? candidates[0] : dists[candidates[0]] <= dists[candidates[1]] ? candidates[0] : candidates[1]
  const dA = dists[a], dB = dists[b]
  const elevM = (index.levels[a] * dB + index.levels[b] * dA) / (dA + dB)
  return { elevM, method: 'bracketed', nearestKm: dA }
}
