/**
 * geocode.ts — address → coordinates via the US Census Bureau Geocoder
 * (https://geocoding.geo.census.gov/geocoder/, no key). The service sends no
 * CORS headers, so the browser calls /api/geocode, a thin proxy (api/geocode.ts
 * on Vercel; vite.config.ts in development). No business logic lives in the proxy.
 *
 * Privacy: the address string is sent to the geocoder and then discarded. The
 * app stores the derived site profile and a user-chosen label, never the street
 * address (CLAUDE.md, Conventions).
 */

export interface GeocodeResult {
  lat: number
  lon: number
  matchedAddress: string
  /** City/state only, safe to store and display. */
  placeLabel: string
}

interface CensusResponse {
  result?: {
    addressMatches?: Array<{
      coordinates: { x: number; y: number }
      matchedAddress: string
      addressComponents?: { city?: string; state?: string; zip?: string }
    }>
  }
}

export function parseCensusResponse(json: unknown): GeocodeResult | null {
  const m = (json as CensusResponse).result?.addressMatches?.[0]
  if (!m) return null
  const c = m.addressComponents
  const placeLabel = c?.city && c?.state ? `${titleCase(c.city)}, ${c.state}${c.zip ? ' ' + c.zip : ''}` : m.matchedAddress
  return { lat: m.coordinates.y, lon: m.coordinates.x, matchedAddress: m.matchedAddress, placeLabel }
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const q = new URLSearchParams({ address: address.trim() })
  const res = await fetch(`/api/geocode?${q.toString()}`, { signal })
  if (!res.ok) throw new Error(`geocoder ${res.status}`)
  return parseCensusResponse(await res.json())
}
