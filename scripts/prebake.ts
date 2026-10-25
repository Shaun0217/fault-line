/**
 * prebake.ts — builds /public/data/district.json, the static site-profile grid
 * that makes the app work with no live API at all.
 *
 * Run:  npm run prebake            (full grid, ~20–30 minutes, polite rate)
 *       npm run prebake -- --quick (coarse 0.25° grid for smoke tests)
 *
 * Per grid cell:
 *   1. Elevation 5-point stencil (centre, ±30″ N/S, ±30″ E/W) from the
 *      Open Topo Data (NASA SRTM 3 arc-second, dataset srtm90m; free public API,
 *      no key). https://www.opentopodata.org/  Fallback: Open-Meteo Elevation API.
 *   2. Slope → Vs30 via Wald & Allen (2007) stable-continent table (vs30proxy.ts).
 *   3. Mapped reference-condition PGA, Ss, S1 from the USGS Seismic Design Web
 *      Service, ASCE 7-16 edition (designmaps.ts). siteClass is passed as the
 *      required placeholder "B"; only the mapped (unamplified) values are kept.
 *
 * No amplification happens here. No secrets are needed.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { vs30FromSlopeStableContinent, slopeFromStencil } from '../src/lib/vs30proxy'
import { parseDesignMapResponse } from '../src/lib/designmaps'
import { EARTH_RADIUS_KM } from '../src/lib/distance'
import { buildContourIndex, interpolateContours, type ContourLine } from '../src/lib/contours'

const QUICK = process.argv.includes('--quick')
const OUT = 'public/data/district.json'
const CACHE = 'fixtures/prebake-cache.json'

// Grid extent: TN-08 plus the NMSZ so the map has context on every side of the district.
const LAT0 = 34.85
const LAT1 = 37.05
const LON0 = -90.85
const LON1 = -87.85
const STEP = QUICK ? 0.25 : 0.05

const rows = Math.round((LAT1 - LAT0) / STEP) + 1
const cols = Math.round((LON1 - LON0) / STEP) + 1
console.log(`grid ${rows} x ${cols} = ${rows * cols} cells at ${STEP}°`)

const ARCSEC30_DEG = 30 / 3600
const DEG = Math.PI / 180
const KM_PER_DEG = DEG * EARTH_RADIUS_KM

type Cache = Record<string, { pga: number; ss: number; s1: number } | { elev: number }>
const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
function saveCache() { writeFileSync(CACHE, JSON.stringify(cache)) }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchJsonRetry(url: string, tries = 4): Promise<unknown> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'fault-line-prebake (student project)' } })
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`)
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
      return await r.json()
    } catch (e) {
      lastErr = e
      await sleep((String(e).includes('429') ? 6000 : 1500) * (i + 1))
    }
  }
  throw lastErr
}

// ---- 1. elevations ----------------------------------------------------------------
interface Pt { lat: number; lon: number }
const cellLat = (r: number) => +(LAT0 + r * STEP).toFixed(5)
const cellLon = (c: number) => +(LON0 + c * STEP).toFixed(5)
const key = (p: Pt) => `e:${p.lat.toFixed(5)},${p.lon.toFixed(5)}`

/**
 * Wald & Allen derived slope from 30 arc-second cell-mean elevations (SRTM30).
 * Single 3 arc-second points would overstate slope on dissected uplands
 * (Allen & Wald 2009 warn that finer DEMs bias slope high), so each stencil arm
 * is the mean of a 5-point cross (the arm point ± 10″ north/south/east/west),
 * approximating the 30″ cell mean. Centre elevation is a single point.
 */
const ARCSEC10_DEG = 10 / 3600
const CROSS: Array<[number, number]> = [[0, 0], [ARCSEC10_DEG, 0], [-ARCSEC10_DEG, 0], [0, ARCSEC10_DEG], [0, -ARCSEC10_DEG]]
function armPoints(lat: number, lon: number, dlat: number, dlon: number): Pt[] {
  return CROSS.map(([a, b]) => ({ lat: +(lat + dlat + a).toFixed(5), lon: +(lon + dlon + b).toFixed(5) }))
}
function stencilPoints(lat: number, lon: number): { centre: Pt; arms: Pt[][] } {
  return {
    centre: { lat, lon },
    arms: [armPoints(lat, lon, ARCSEC30_DEG, 0), armPoints(lat, lon, -ARCSEC30_DEG, 0), armPoints(lat, lon, 0, ARCSEC30_DEG), armPoints(lat, lon, 0, -ARCSEC30_DEG)],
  }
}
const needed: Pt[] = []
const seen = new Set<string>()
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const { centre, arms } = stencilPoints(cellLat(r), cellLon(c))
  for (const p of [centre, ...arms.flat()]) { const k = key(p); if (!(k in cache) && !seen.has(k)) { seen.add(k); needed.push(p) } }
}
console.log(`elevation points to fetch: ${needed.length}`)
/**
 * Primary DEM: Open Topo Data, dataset srtm90m (NASA SRTM 3 arc-second), public
 * API: 100 locations per request, 1 request/second, 1000 requests/day.
 * https://www.opentopodata.org/api/  — free, no key, attribution below.
 * Fallback: Open-Meteo Elevation API (Copernicus GLO-90), which rate-limits
 * bursts with HTTP 429; used only if Open Topo Data fails.
 */
async function elevationBatch(batch: Pt[]): Promise<number[]> {
  try {
    const locs = batch.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|')
    const j = (await fetchJsonRetry(`https://api.opentopodata.org/v1/srtm90m?locations=${encodeURIComponent(locs)}`)) as { status: string; results: Array<{ elevation: number | null }> }
    if (j.status !== 'OK') throw new Error(j.status)
    const out = j.results.map((r) => r.elevation)
    if (out.every((e) => typeof e === 'number')) return out as number[]
    throw new Error('null elevations')
  } catch (e) {
    console.warn('  opentopodata failed, falling back to open-meteo:', (e as Error).message)
    await sleep(3000)
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${batch.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${batch.map((p) => p.lon.toFixed(5)).join(',')}`
    const j = (await fetchJsonRetry(url, 6)) as { elevation: number[] }
    return j.elevation
  }
}
for (let i = 0; i < needed.length; i += 100) {
  const batch = needed.slice(i, i + 100)
  const elevs = await elevationBatch(batch)
  batch.forEach((p, k) => { cache[key(p)] = { elev: elevs[k] } })
  if ((i / 100) % 10 === 0) { console.log(`  elevation ${i + batch.length}/${needed.length}`); saveCache() }
  await sleep(1100)
}
saveCache()

// ---- 2. slope → Vs30 ----------------------------------------------------------------
const vs30: number[] = [], slope: number[] = [], elev: number[] = []
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const lat = cellLat(r), lon = cellLon(c)
  const { centre, arms } = stencilPoints(lat, lon)
  const zAt = (p: Pt) => (cache[key(p)] as { elev: number }).elev
  const mean = (pts: Pt[]) => pts.reduce((a, p) => a + zAt(p), 0) / pts.length
  const [zN, zS, zE, zW] = arms.map(mean)
  const halfNorthM = ARCSEC30_DEG * KM_PER_DEG * 1000
  const halfEastM = ARCSEC30_DEG * KM_PER_DEG * Math.cos(lat * DEG) * 1000
  const s = slopeFromStencil(zN, zS, zE, zW, halfNorthM, halfEastM)
  slope.push(+s.toExponential(3))
  vs30.push(vs30FromSlopeStableContinent(s).vs30Ms)
  elev.push(zAt(centre))
}

// ---- 3. design maps (reference condition) ---------------------------------------------
const pga: number[] = new Array(rows * cols).fill(NaN)
const ss: number[] = new Array(rows * cols).fill(NaN)
const s1: number[] = new Array(rows * cols).fill(NaN)
const dmKey = (lat: number, lon: number) => `d:${lat.toFixed(4)},${lon.toFixed(4)}`
let pending = 0
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!(dmKey(cellLat(r), cellLon(c)) in cache)) pending++
console.log(`design map cells to fetch: ${pending}`)

const CONCURRENCY = 3
let done = 0
const tasks: Array<() => Promise<void>> = []
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const i = r * cols + c, lat = cellLat(r), lon = cellLon(c), k = dmKey(lat, lon)
  tasks.push(async () => {
    if (!(k in cache)) {
      const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-16.json?latitude=${lat}&longitude=${lon}&riskCategory=II&siteClass=B&title=fault-line`
      const v = parseDesignMapResponse(await fetchJsonRetry(url), 'live')
      cache[k] = { pga: v.pgaG, ss: v.ssG, s1: v.s1G }
      done++
      if (done % 50 === 0) { console.log(`  design maps ${done}/${pending}`); saveCache() }
      await sleep(150)
    }
    const v = cache[k] as { pga: number; ss: number; s1: number }
    pga[i] = v.pga; ss[i] = v.ss; s1[i] = v.s1
  })
}
async function runPool() {
  let idx = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (idx < tasks.length) { const t = tasks[idx++]; await t() }
  }))
}
await runPool()
saveCache()

// ---- 3b. subsurface horizons from digitized structure contours ----------------------
/**
 * Top of Paleozoic bedrock and top of the Cretaceous, interpolated between the
 * structure contours of Smout (2025, USGS data release, doi:10.5066/P14BV2PI),
 * which digitizes Dart (1995, USGS MF-2284; DataSource DAS06) and Cushing et al.
 * (1964, USGS PP 448-B; DAS07). Dart's labels are in metres although the release
 * files them under Value_ft (see fixture metadata, unitCorrection); the fixture
 * carries the corrected values. Paleozoic top: Dart first, Cushing where Dart is
 * not bracketed. Cretaceous top: Cushing (the only source). Physical guards:
 * a horizon above the ground surface or a Paleozoic top above the Cretaceous
 * top is dropped rather than shown (METHODS.md §5b).
 */
interface ContourFixture { layers: Record<string, { lines: Array<{ m: number; src: string; coords: [number, number][] }> }> }
const contours = JSON.parse(readFileSync('fixtures/embayment-structure-contours.json', 'utf8')) as ContourFixture
const toLines = (ls: Array<{ m: number; coords: [number, number][] }>): ContourLine[] => ls.map((l) => ({ m: l.m, coords: l.coords }))
const pzDart = buildContourIndex(toLines(contours.layers.topPaleozoic.lines.filter((l) => l.src === 'DAS06')))
const pzCushing = buildContourIndex(toLines(contours.layers.topPaleozoic.lines.filter((l) => l.src === 'DAS07')))
const kIdx = buildContourIndex(toLines(contours.layers.topCretaceous.lines))
const pzElev: Array<number | null> = []
const kElev: Array<number | null> = []
const NEAREST_ONLY_MAX_KM = 12 // beyond this, a single unbracketed contour says little
const pick = (r: ReturnType<typeof interpolateContours>) => (r && (r.method === 'bracketed' || r.nearestKm <= NEAREST_ONLY_MAX_KM) ? Math.round(r.elevM) : null)
let fromDart = 0, fromCushing = 0, dropped = 0
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const pt: [number, number] = [cellLon(c), cellLat(r)]
  const surface = elev[r * cols + c]
  const d = interpolateContours(pzDart, pt, 40)
  let pzV = d && d.method === 'bracketed' ? Math.round(d.elevM) : null
  if (pzV != null) fromDart++
  else { pzV = pick(d) ?? pick(interpolateContours(pzCushing, pt, 40)); if (pzV != null) fromCushing++ }
  let kV = pick(interpolateContours(kIdx, pt, 40))
  if (kV != null && kV > surface) kV = null
  if (pzV != null && pzV > surface) { pzV = null; dropped++ }
  if (pzV != null && kV != null && pzV > kV) { pzV = null; dropped++ }
  pzElev.push(pzV); kElev.push(kV)
}
console.log(`subsurface: paleozoic from Dart ${fromDart}, from Cushing ${fromCushing}, dropped by physical guards ${dropped}`)
console.log('subsurface: paleozoic top known for', pzElev.filter((v) => v != null).length, 'cells; cretaceous top for', kElev.filter((v) => v != null).length)

// ---- 4. write ------------------------------------------------------------------------------
mkdirSync('public/data', { recursive: true })
const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    designMapEdition: 'ASCE7-16' as const,
    vs30Method: 'Wald & Allen (2007) stable-continent slope proxy; central differences of ±30″ arm-mean elevations',
    elevationSource: 'Open Topo Data srtm90m (NASA SRTM 3 arc-second), 5-point cross means per 30″ arm; Open-Meteo GLO-90 fallback',
    stepDeg: STEP,
    note: 'Reference-condition (Vs30 = 760 m/s) mapped values; NOT amplified. Site class is an estimate at ~5 km resolution. pzElev/kElev: top of Paleozoic and top of Cretaceous, m relative to sea level, interpolated from Dart (1995) and Cushing et al. (1964) structure contours via Smout (2025); null where not contoured.',
    subsurfaceSource: 'Smout, B., 2025, USGS data release doi:10.5066/P14BV2PI, digitizing Dart 1995 (USGS MF-2284) and Cushing et al. 1964 (USGS PP 448-B)',
  },
  lat0: LAT0, lon0: LON0, stepDeg: STEP, rows, cols,
  vs30, slope, elev, pzElev, kElev,
  pga: pga.map((x) => +x.toFixed(3)), ss: ss.map((x) => +x.toFixed(3)), s1: s1.map((x) => +x.toFixed(3)),
}
writeFileSync(OUT, JSON.stringify(out))
console.log(`wrote ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`)
const classes = vs30.reduce<Record<string, number>>((a, v) => { const k = v < 180 ? 'E' : v <= 360 ? 'D' : v <= 760 ? 'C' : 'B'; a[k] = (a[k] || 0) + 1; return a }, {})
console.log('site class histogram', classes)
