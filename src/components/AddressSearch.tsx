import { useState, type FormEvent } from 'react'
import { geocodeAddress } from '../lib/geocode'
import type { AppLocation } from '../lib/types'

interface Props {
  online: boolean
  onLocate: (loc: AppLocation) => void
}

/** A form field, not a search bar (DESIGN.md §10). The map-pin fallback is offered immediately. */
export function AddressSearch({ online, onLocate }: Props) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true); setError(null)
    try {
      const r = await geocodeAddress(q)
      if (!r) { setError('No match for that address. Rural addresses often miss; click the map at your home instead, or add the ZIP.'); return }
      onLocate({ lat: r.lat, lon: r.lon, label: r.placeLabel, source: 'address' })
    } catch {
      setError(online ? 'The geocoder did not respond. Click the map at your home, or use your location.' : 'Offline: address lookup needs a connection. Your location and clicking the map still work.')
    } finally { setBusy(false) }
  }

  function useGps() {
    if (!navigator.geolocation) { setError('This browser has no location service. Click the map instead.'); return }
    setBusy(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onLocate({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Your location', source: 'gps' }) },
      () => { setBusy(false); setError('Location permission was denied. Click the map at your home instead.') },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="addr" className="text-meta text-fg-secondary block mb-2">Street address</label>
      <div className="flex gap-2">
        <input id="addr" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="street-address" className="field" />
        <button type="submit" disabled={busy} className="btn">{busy ? 'Looking up' : 'Look up'}</button>
      </div>
      <div className="mt-3 text-label text-fg-secondary">
        Or <button type="button" onClick={useGps} className="link">use your location</button>, or click the map at your home.
      </div>
      {error && <p className="mt-2 text-label" role="alert">{error}</p>}
    </form>
  )
}
