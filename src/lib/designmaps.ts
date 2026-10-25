/**
 * designmaps.ts — client for the USGS Seismic Design Web Service, REFERENCE
 * SITE CONDITION ONLY.
 *
 * Edition: ASCE 7-16 (constant below; never mixed with another edition).
 * Endpoint: https://earthquake.usgs.gov/ws/designmaps/asce7-16.json
 * Documentation: https://earthquake.usgs.gov/ws/designmaps/
 *
 * We consume ONLY the mapped values `pga`, `ss`, `s1`, which the service returns
 * for the map reference condition (Vs30 = 760 m/s, Site Class B/C boundary) and
 * which do not depend on the siteClass request parameter. The request always
 * passes siteClass=B as a placeholder because the service requires the
 * parameter. The amplified outputs `pgam`, `sms`, `sm1`, `sds`, `sd1`, `fa`,
 * `fv`, `fpga` are never read (CLAUDE.md, Hard Invariant 1).
 *
 * In production this goes through /api/designmaps (Vercel) so the browser never
 * depends on USGS CORS policy; the dev server proxies the same path. Live calls
 * are an enhancement: the prebaked district grid is the primary source.
 */

export const DESIGN_MAP_EDITION = 'ASCE7-16' as const

export interface MappedReferenceValues {
  /** MCE_G peak ground acceleration at Vs30 = 760 m/s, g. */
  pgaG: number
  /** MCE_R 0.2 s spectral acceleration at 760 m/s, g. */
  ssG: number
  /** MCE_R 1.0 s spectral acceleration at 760 m/s, g. */
  s1G: number
  edition: typeof DESIGN_MAP_EDITION
  source: 'live' | 'fixture'
}

interface ServiceResponse {
  request?: { referenceDocument?: string }
  response?: { data?: { pga?: number; ss?: number; s1?: number } }
}

/** Parse a raw service response, refusing anything from a different edition. */
export function parseDesignMapResponse(json: unknown, source: MappedReferenceValues['source'] = 'live'): MappedReferenceValues {
  const r = json as ServiceResponse
  const doc = r.request?.referenceDocument
  if (doc && doc !== DESIGN_MAP_EDITION) throw new Error(`design map edition mismatch: expected ${DESIGN_MAP_EDITION}, got ${doc}`)
  const d = r.response?.data
  if (!d || typeof d.pga !== 'number' || typeof d.ss !== 'number' || typeof d.s1 !== 'number') {
    throw new Error('design map response missing mapped values')
  }
  return { pgaG: d.pga, ssG: d.ss, s1G: d.s1, edition: DESIGN_MAP_EDITION, source }
}

/** URL used by both the browser (via proxy) and the prebake script (direct). */
export function designMapUrl(latitude: number, longitude: number, base = '/api/designmaps'): string {
  const q = new URLSearchParams({ latitude: latitude.toFixed(4), longitude: longitude.toFixed(4) })
  return `${base}?${q.toString()}`
}

export async function fetchMappedReferenceValues(latitude: number, longitude: number, signal?: AbortSignal): Promise<MappedReferenceValues> {
  const res = await fetch(designMapUrl(latitude, longitude), { signal })
  if (!res.ok) throw new Error(`design map service ${res.status}`)
  return parseDesignMapResponse(await res.json(), 'live')
}
