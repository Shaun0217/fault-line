// Thin CORS proxy for the US Census Geocoder. No business logic (CLAUDE.md, Stack).
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const address = new URL(req.url).searchParams.get('address')?.trim() ?? ''
  if (!address || address.length > 200) return new Response(JSON.stringify({ error: 'address required' }), { status: 400 })
  const upstream = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
  upstream.searchParams.set('address', address)
  upstream.searchParams.set('benchmark', 'Public_AR_Current')
  upstream.searchParams.set('format', 'json')
  const r = await fetch(upstream.toString(), { headers: { 'User-Agent': 'fault-line (student project)' } })
  return new Response(r.body, {
    status: r.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' },
  })
}
