/**
 * district.ts — the prebaked site-profile grid and how the app samples it.
 *
 * scripts/prebake.ts writes /public/data/district.json. This module loads it
 * (precached by the service worker, so it is available offline) and answers
 * "what is the site profile at this lat/lon?" without any network call.
 *
 * Grid: regular lat/lon, row-major from the south-west corner. Per cell:
 *   vs30   Vs30 estimate, m/s, from the slope proxy (vs30proxy.ts)
 *   slope  topographic slope, m/m, from which vs30 was derived
 *   elev   elevation, m
 *   pga    ASCE 7-16 mapped MCE_G PGA at 760 m/s, g   (reference condition)
 *   ss     ASCE 7-16 mapped Ss at 760 m/s, g
 *   s1     ASCE 7-16 mapped S1 at 760 m/s, g
 *
 * Sampling rules
 *   - Mapped ground-motion values (pga, ss, s1) vary smoothly → bilinear.
 *   - Vs30 / site class is categorical → nearest cell, and the returned profile
 *     says the class came from a proxy at ~5 km resolution.
 *
 * Liquefaction screen (proxy, labelled as such in the UI): liquefaction needs
 * young, loose, saturated, sandy deposits (Youd & Perkins 1978, J. Geotech. Eng.
 * Div. 104(GT4)). Low Vs30 and near-zero slope are the two geospatial proxies
 * with the most predictive power for those conditions in the global model of
 * Zhu, Baise & Thompson (2017, Earthquake Spectra 33(3), 1365–1385). The screen
 * here is deliberately coarse: E → higher, soft D (Vs30 < 240) → moderate,
 * otherwise lower. It is a screen, not a susceptibility map.
 */

import { siteClassFromVs30, type SiteClass } from './siteclass'

export interface DistrictGrid {
  meta: {
    generatedAt: string
    designMapEdition: 'ASCE7-16'
    vs30Method: string
    elevationSource: string
    stepDeg: number
    note: string
    subsurfaceSource?: string
  }
  lat0: number
  lon0: number
  stepDeg: number
  rows: number
  cols: number
  vs30: number[]
  slope: number[]
  elev: number[]
  pga: number[]
  ss: number[]
  s1: number[]
  /** Top of Paleozoic bedrock, m relative to sea level; null where not contoured. */
  pzElev?: Array<number | null>
  /** Top of Cretaceous, m relative to sea level; null where not contoured. */
  kElev?: Array<number | null>
}

export type LiquefactionProxy = 'higher' | 'moderate' | 'lower' | 'unknown'

export interface SiteProfile {
  lat: number
  lon: number
  inGrid: boolean
  vs30Ms: number
  vs30RangeMs: readonly [number, number]
  siteClass: SiteClass
  siteClassSource: 'slope-proxy' | 'default' | 'user'
  slopeMPerM: number
  elevationM: number
  /** Reference-condition (760 m/s) mapped values, g. */
  pgaRefG: number
  ssRefG: number
  s1RefG: number
  liquefactionProxy: LiquefactionProxy
  /** Nearest cell index, for debugging and the worker. */
  cellIndex: number
  /** Subsurface horizons from published structure contours (null = not contoured here). */
  topPaleozoicElevM: number | null
  topCretaceousElevM: number | null
  /** Depth below the surface to Paleozoic bedrock, m (elevation − top of Paleozoic). */
  bedrockDepthM: number | null
  /** Thickness of Cenozoic sediment, m (elevation − top of Cretaceous). */
  cenozoicThicknessM: number | null
}

/** Vs30 range implied by the Wald & Allen bin the proxy value sits in. */
export function vs30RangeForProxy(vs30Ms: number): readonly [number, number] {
  const edges = [0, 180, 240, 300, 360, 490, 620, 760, 1500]
  for (let i = 0; i < edges.length - 1; i++) if (vs30Ms < edges[i + 1]) return [edges[i], edges[i + 1]]
  return [760, 1500]
}

export function liquefactionScreen(vs30Ms: number): LiquefactionProxy {
  if (!Number.isFinite(vs30Ms)) return 'unknown'
  if (vs30Ms < 180) return 'higher'
  if (vs30Ms < 240) return 'moderate'
  return 'lower'
}

/** Default when a location falls outside the grid: reference rock, flagged. */
export const OUT_OF_GRID_VS30_MS = 760

let cached: Promise<DistrictGrid> | null = null

export function loadDistrict(url = '/data/district.json'): Promise<DistrictGrid> {
  if (!cached) {
    cached = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`district grid ${r.status}`)
      return validateGrid(await r.json())
    })
    cached.catch(() => { cached = null })
  }
  return cached
}

export function validateGrid(g: unknown): DistrictGrid {
  const d = g as DistrictGrid
  const n = d.rows * d.cols
  for (const k of ['vs30', 'slope', 'elev', 'pga', 'ss', 's1'] as const) {
    if (!Array.isArray(d[k]) || d[k].length !== n) throw new Error(`district grid: ${k} has wrong length`)
  }
  if (d.meta?.designMapEdition !== 'ASCE7-16') throw new Error('district grid: unexpected design map edition')
  return d
}

function cellIndexNearest(g: DistrictGrid, lat: number, lon: number): { i: number; row: number; col: number } | null {
  const row = Math.round((lat - g.lat0) / g.stepDeg)
  const col = Math.round((lon - g.lon0) / g.stepDeg)
  if (row < 0 || col < 0 || row >= g.rows || col >= g.cols) return null
  return { i: row * g.cols + col, row, col }
}

function bilinear(g: DistrictGrid, field: number[], lat: number, lon: number): number {
  const fr = (lat - g.lat0) / g.stepDeg
  const fc = (lon - g.lon0) / g.stepDeg
  const r0 = Math.max(0, Math.min(g.rows - 2, Math.floor(fr)))
  const c0 = Math.max(0, Math.min(g.cols - 2, Math.floor(fc)))
  const tr = Math.max(0, Math.min(1, fr - r0))
  const tc = Math.max(0, Math.min(1, fc - c0))
  const v = (r: number, c: number) => field[r * g.cols + c]
  const top = v(r0, c0) * (1 - tc) + v(r0, c0 + 1) * tc
  const bot = v(r0 + 1, c0) * (1 - tc) + v(r0 + 1, c0 + 1) * tc
  return top * (1 - tr) + bot * tr
}

export function sampleSite(g: DistrictGrid, lat: number, lon: number): SiteProfile {
  const cell = cellIndexNearest(g, lat, lon)
  if (!cell) {
    return {
      lat, lon, inGrid: false,
      vs30Ms: OUT_OF_GRID_VS30_MS, vs30RangeMs: [760, 1500], siteClass: siteClassFromVs30(OUT_OF_GRID_VS30_MS), siteClassSource: 'default',
      slopeMPerM: NaN, elevationM: NaN, pgaRefG: NaN, ssRefG: NaN, s1RefG: NaN, liquefactionProxy: 'unknown', cellIndex: -1,
      topPaleozoicElevM: null, topCretaceousElevM: null, bedrockDepthM: null, cenozoicThicknessM: null,
    }
  }
  const vs30Ms = g.vs30[cell.i]
  const elev = g.elev[cell.i]
  const pz = g.pzElev?.[cell.i] ?? null
  const k = g.kElev?.[cell.i] ?? null
  return {
    lat, lon, inGrid: true,
    vs30Ms,
    vs30RangeMs: vs30RangeForProxy(vs30Ms),
    siteClass: siteClassFromVs30(vs30Ms),
    siteClassSource: 'slope-proxy',
    slopeMPerM: g.slope[cell.i],
    elevationM: elev,
    pgaRefG: bilinear(g, g.pga, lat, lon),
    ssRefG: bilinear(g, g.ss, lat, lon),
    s1RefG: bilinear(g, g.s1, lat, lon),
    liquefactionProxy: liquefactionScreen(vs30Ms),
    cellIndex: cell.i,
    topPaleozoicElevM: pz,
    topCretaceousElevM: k,
    bedrockDepthM: pz == null ? null : Math.max(0, Math.round(elev - pz)),
    cenozoicThicknessM: k == null ? null : Math.max(0, Math.round(elev - k)),
  }
}

export interface TransectSample {
  distKm: number
  lon: number
  lat: number
  elevM: number
  topPaleozoicElevM: number | null
  topCretaceousElevM: number | null
}

/** Sample the grid along a straight line for a cross-section; nearest-cell for horizons, bilinear for surface. */
export function sampleTransect(g: DistrictGrid, from: [number, number], to: [number, number], n = 48): TransectSample[] {
  const out: TransectSample[] = []
  const kx = Math.cos(((from[1] + to[1]) / 2) * (Math.PI / 180)) * 111.195
  const total = Math.hypot((to[0] - from[0]) * kx, (to[1] - from[1]) * 111.195)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const lon = from[0] + (to[0] - from[0]) * t, lat = from[1] + (to[1] - from[1]) * t
    const cell = cellIndexNearest(g, lat, lon)
    const elev = cell ? bilinear(g, g.elev, lat, lon) : NaN
    out.push({
      distKm: total * t, lon, lat, elevM: elev,
      topPaleozoicElevM: cell ? g.pzElev?.[cell.i] ?? null : null,
      topCretaceousElevM: cell ? g.kElev?.[cell.i] ?? null : null,
    })
  }
  return out
}

/** Geographic bounds of the grid cell centres, [west, south, east, north]. */
export function gridBounds(g: DistrictGrid): [number, number, number, number] {
  return [g.lon0, g.lat0, g.lon0 + (g.cols - 1) * g.stepDeg, g.lat0 + (g.rows - 1) * g.stepDeg]
}
