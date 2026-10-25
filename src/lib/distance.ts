/**
 * distance.ts — point-to-fault-segment geometry.
 *
 * Distance metric fed to the GMPE is Rrup (closest distance to the rupture
 * plane), which is what Atkinson & Boore (2006) require. For the near-vertical
 * NMSZ strike-slip arms we model each rupture as a vertical plane beneath the
 * surface trace, so
 *   Rjb  = horizontal distance from the site to the trace (Joyner–Boore distance)
 *   Rrup = sqrt(Rjb^2 + Ztor^2)          (Ztor = depth to top of rupture)
 * The Reelfoot thrust dips ~30–45° SW (Csontos & Van Arsdale 2008); treating it
 * as vertical slightly overstates distance for sites on its hanging wall. This is
 * a documented simplification (METHODS.md).
 *
 * Planar geometry: sites are within a few hundred km of the traces, so an
 * equirectangular projection centred on the site (1° lat = 111.195 km, 1° lon =
 * 111.195 cos(lat) km, mean Earth radius 6371.0088 km per IUGG) is accurate to
 * well under 1% here, which is far below GMPE uncertainty.
 */

export type LonLat = readonly [lon: number, lat: number]

/** Mean Earth radius, km (IUGG). */
export const EARTH_RADIUS_KM = 6371.0088
const KM_PER_DEG = (Math.PI / 180) * EARTH_RADIUS_KM
const DEG = Math.PI / 180

/** Great-circle distance, km (haversine). */
export function haversineKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * DEG
  const dLon = (b[0] - a[0]) * DEG
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Project lon/lat to local km east/north about a reference latitude. */
function toLocalKm(p: LonLat, refLat: number, refLon: number): [number, number] {
  return [(p[0] - refLon) * KM_PER_DEG * Math.cos(refLat * DEG), (p[1] - refLat) * KM_PER_DEG]
}

/** Distance from point P to segment AB in the plane (km). Handles degenerate A == B. */
function pointToSegmentKm(p: [number, number], a: [number, number], b: [number, number]): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const apx = p[0] - a[0]
  const apy = p[1] - a[1]
  const len2 = abx * abx + aby * aby
  let t = len2 > 0 ? (apx * abx + apy * aby) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const dx = a[0] + t * abx - p[0]
  const dy = a[1] + t * aby - p[1]
  return Math.hypot(dx, dy)
}

/** Horizontal (Joyner–Boore style) distance from a site to a polyline trace, km. */
export function distanceToTraceKm(site: LonLat, trace: readonly LonLat[]): number {
  if (trace.length === 0) throw new Error('trace must have at least one vertex')
  const refLat = site[1]
  const refLon = site[0]
  const p: [number, number] = [0, 0]
  if (trace.length === 1) return Math.hypot(...toLocalKm(trace[0], refLat, refLon))
  let best = Infinity
  let prev = toLocalKm(trace[0], refLat, refLon)
  for (let i = 1; i < trace.length; i++) {
    const cur = toLocalKm(trace[i], refLat, refLon)
    const d = pointToSegmentKm(p, prev, cur)
    if (d < best) best = d
    prev = cur
  }
  return best
}

/** Rupture distance for a vertical rupture plane whose top is at ztorKm. Never NaN, never 0 if ztorKm > 0. */
export function rrupFromRjbKm(rjbKm: number, ztorKm: number): number {
  return Math.hypot(Math.max(0, rjbKm), Math.max(0, ztorKm))
}

/** Move a point by a bearing and distance (km). Used by tests and by the prebake grid. */
export function destination(p: LonLat, bearingDeg: number, distKm: number): LonLat {
  const br = bearingDeg * DEG
  const lat1 = p[1] * DEG
  const lon1 = p[0] * DEG
  const ad = distKm / EARTH_RADIUS_KM
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(br))
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2))
  return [lon2 / DEG, lat2 / DEG]
}

/** Nearest point on a polyline trace to a site (lon/lat), using the same local projection as distanceToTraceKm. */
export function nearestPointOnTrace(site: LonLat, trace: readonly LonLat[]): LonLat {
  if (trace.length === 1) return trace[0]
  const refLat = site[1], refLon = site[0]
  const kx = KM_PER_DEG * Math.cos(refLat * DEG)
  let best = Infinity
  let bestPt: LonLat = trace[0]
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1], b = trace[i]
    const ax = (a[0] - refLon) * kx, ay = (a[1] - refLat) * KM_PER_DEG
    const bx = (b[0] - refLon) * kx, by = (b[1] - refLat) * KM_PER_DEG
    const abx = bx - ax, aby = by - ay
    const len2 = abx * abx + aby * aby
    let t = len2 > 0 ? -(ax * abx + ay * aby) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * abx, py = ay + t * aby
    const d = px * px + py * py
    if (d < best) { best = d; bestPt = [refLon + px / kx, refLat + py / KM_PER_DEG] }
  }
  return bestPt
}

/**
 * Rupture distance to a finite dipping rupture plane hung from a surface trace.
 *
 * Each trace segment carries a rectangle: top edge along the segment at depth
 * ztorKm, extending down-dip for widthKm at dipDeg toward the side given by
 * dipAzimuthDeg (compass bearing the plane descends toward). With an orthonormal
 * parametrisation (along-strike u, down-dip v) the nearest point to the site is
 * the clamped orthogonal projection, so the distance is exact for a rectangle.
 * For dipDeg = 90 this reduces to sqrt(Rjb² + Ztor²), the vertical case above.
 *
 * Geometry after Csontos & Van Arsdale (2008, Geosphere 4(5), 802–813): the
 * Reelfoot thrust dips ~30–45° SW; the strike-slip arms are near vertical.
 */
export function rrupToPlaneKm(
  site: LonLat,
  trace: readonly LonLat[],
  ztorKm: number,
  widthKm: number,
  dipDeg: number,
  dipAzimuthDeg: number | null,
): number {
  if (trace.length < 2) return rrupFromRjbKm(distanceToTraceKm(site, trace), ztorKm)
  const refLat = site[1], refLon = site[0]
  const kx = KM_PER_DEG * Math.cos(refLat * DEG)
  const dip = dipDeg * DEG
  const cosD = Math.cos(dip), sinD = Math.sin(dip)
  // Preferred horizontal dip direction as a unit vector (east, north).
  const pref = dipAzimuthDeg == null ? null : [Math.sin(dipAzimuthDeg * DEG), Math.cos(dipAzimuthDeg * DEG)]
  let best = Infinity
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1], b = trace[i]
    const ax = (a[0] - refLon) * kx, ay = (a[1] - refLat) * KM_PER_DEG
    const bx = (b[0] - refLon) * kx, by = (b[1] - refLat) * KM_PER_DEG
    const L = Math.hypot(bx - ax, by - ay)
    if (L === 0) continue
    const ux = (bx - ax) / L, uy = (by - ay) / L
    // Horizontal normal to strike; flip toward the preferred dip azimuth.
    let nx = uy, ny = -ux
    if (pref && nx * pref[0] + ny * pref[1] < 0) { nx = -nx; ny = -ny }
    // Down-dip unit vector (east, north, down) and top-edge origin (depth positive down).
    const vx = nx * cosD, vy = ny * cosD, vz = sinD
    // Site is at the origin, depth 0. Vector from A (at depth ztor) to the site:
    const wx = -ax, wy = -ay, wz = -ztorKm
    let s = wx * ux + wy * uy            // along strike (u is horizontal)
    let t = wx * vx + wy * vy + wz * vz  // down dip
    s = Math.max(0, Math.min(L, s))
    t = Math.max(0, Math.min(widthKm, t))
    const px = ax + s * ux + t * vx, py = ay + s * uy + t * vy, pz = ztorKm + t * vz
    const d = Math.sqrt(px * px + py * py + pz * pz)
    if (d < best) best = d
  }
  return best
}
