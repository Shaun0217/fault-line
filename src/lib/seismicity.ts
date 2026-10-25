/**
 * seismicity.ts — recorded earthquakes for context on the map.
 *
 * Source: USGS FDSN Event Web Service (https://earthquake.usgs.gov/fdsnws/event/1/),
 * GeoJSON output. A snapshot is bundled (public/data/seismicity.json, from
 * fixtures/usgs-fdsn-nmsz-m3plus.json) so the layer renders offline; a live
 * refresh is attempted and silently skipped when offline.
 *
 * This layer shows what HAS happened. It is never used to suggest what will.
 */

export interface Quake {
  id: string
  lon: number
  lat: number
  depthKm: number
  mag: number
  time: number
  place: string
}

interface UsgsFeature {
  id: string
  properties: { mag: number | null; time: number; place: string | null }
  geometry: { coordinates: [number, number, number] }
}

export function parseUsgsGeoJson(json: unknown): Quake[] {
  const f = (json as { features?: UsgsFeature[] }).features ?? []
  return f
    .filter((x) => typeof x.properties.mag === 'number')
    .map((x) => ({
      id: x.id,
      lon: x.geometry.coordinates[0],
      lat: x.geometry.coordinates[1],
      depthKm: x.geometry.coordinates[2],
      mag: x.properties.mag as number,
      time: x.properties.time,
      place: x.properties.place ?? '',
    }))
}

export const NMSZ_BBOX = { minlatitude: 35.0, maxlatitude: 37.2, minlongitude: -91.0, maxlongitude: -88.5 }

export function liveSeismicityUrl(minMag = 3.0): string {
  const q = new URLSearchParams({
    format: 'geojson', starttime: '1974-01-01', minmagnitude: String(minMag), orderby: 'time',
    ...Object.fromEntries(Object.entries(NMSZ_BBOX).map(([k, v]) => [k, String(v)])),
  })
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${q.toString()}`
}

export async function loadSeismicity(): Promise<{ quakes: Quake[]; source: 'live' | 'bundled' }> {
  const bundled = fetch('/data/seismicity.json').then(async (r) => parseUsgsGeoJson(await r.json()))
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { quakes: await bundled, source: 'bundled' }
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch(liveSeismicityUrl(), { signal: ctl.signal })
    clearTimeout(t)
    if (r.ok) return { quakes: parseUsgsGeoJson(await r.json()), source: 'live' }
  } catch { /* offline or blocked: fall through to the bundled snapshot */ }
  return { quakes: await bundled, source: 'bundled' }
}
