// Thin proxy for the USGS Seismic Design Web Service, ASCE 7-16 edition, reference condition only.
// siteClass=B is the placeholder the service requires; the client reads only mapped values.
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const p = new URL(req.url).searchParams
  const lat = Number(p.get('latitude')), lon = Number(p.get('longitude'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return new Response(JSON.stringify({ error: 'latitude and longitude required' }), { status: 400 })
  const upstream = new URL('https://earthquake.usgs.gov/ws/building-codes/asce7-16/calculate') // documented /ws/designmaps/asce7-16.json redirects here
  upstream.searchParams.set('latitude', lat.toFixed(4))
  upstream.searchParams.set('longitude', lon.toFixed(4))
  upstream.searchParams.set('riskCategory', 'II')
  upstream.searchParams.set('siteClass', 'B')
  upstream.searchParams.set('title', 'fault-line')
  const r = await fetch(upstream.toString())
  return new Response(r.body, {
    status: r.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=2592000', 'access-control-allow-origin': '*' },
  })
}
