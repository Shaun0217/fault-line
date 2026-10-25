import { useMemo } from 'react'
import { sampleTransect, type DistrictGrid } from '../lib/district'
import { nearestPointOnTrace } from '../lib/distance'
import type { FaultSegment } from '../lib/faults'
import type { AppLocation } from '../lib/types'
import { Dot } from './Mark'
import { SectionHead } from './SectionHead'

interface Props {
  grid: DistrictGrid
  location: AppLocation
  segment: FaultSegment
}

/**
 * Cross-section from the nearest point on the selected rupture trace to the
 * address: surface from SRTM, Cenozoic and Cretaceous horizons from published
 * structure contours (dashed = interpolated), Paleozoic bedrock hatched. Vertical
 * exaggeration is computed and printed; the rupture top (10 km) is below frame.
 */
export function Transect({ grid, location, segment }: Props) {
  const data = useMemo(() => {
    const site: [number, number] = [location.lon, location.lat]
    const from = nearestPointOnTrace(site, segment.trace)
    return { from, samples: sampleTransect(grid, [from[0], from[1]], site, 60) }
  }, [grid, location, segment])
  const s = data.samples
  const L = s[s.length - 1].distKm
  if (!(L > 1)) return null
  const elevs = s.map((p) => p.elevM).filter(Number.isFinite)
  const pz = s.map((p) => p.topPaleozoicElevM).filter((v): v is number => v != null)
  const k = s.map((p) => p.topCretaceousElevM).filter((v): v is number => v != null)
  const top = Math.max(...elevs) + 60
  const bottom = Math.min(pz.length ? Math.min(...pz) - 120 : k.length ? Math.min(...k) - 200 : -400, -200)
  const X0 = 56, X1 = 440, Y0 = 20, Y1 = 200
  const x = (d: number) => X0 + (d / L) * (X1 - X0)
  const y = (e: number) => Y0 + ((top - e) / (top - bottom)) * (Y1 - Y0)
  const ve = ((Y1 - Y0) / (top - bottom)) / ((X1 - X0) / (L * 1000))
  const surfPath = s.map((p, i) => `${i ? 'L' : 'M'}${x(p.distKm).toFixed(1)},${y(p.elevM).toFixed(1)}`).join(' ')
  const horizon = (key: 'topPaleozoicElevM' | 'topCretaceousElevM') => {
    const segs: string[] = []
    let open = false
    for (const p of s) {
      const v = p[key]
      if (v == null) { open = false; continue }
      segs.push(`${open ? 'L' : 'M'}${x(p.distKm).toFixed(1)},${y(v).toFixed(1)}`)
      open = true
    }
    return segs.join(' ')
  }
  // Fill polygons between surface and a horizon, only where the horizon is known (contiguous runs).
  const fillBetween = (upper: (p: typeof s[number]) => number | null, lower: (p: typeof s[number]) => number | null) => {
    const polys: string[] = []
    let run: typeof s = []
    const flush = () => {
      if (run.length > 1) {
        const up = run.map((p) => `${x(p.distKm).toFixed(1)},${y(upper(p)!).toFixed(1)}`)
        const lo = [...run].reverse().map((p) => `${x(p.distKm).toFixed(1)},${y(lower(p)!).toFixed(1)}`)
        polys.push([...up, ...lo].join(' '))
      }
      run = []
    }
    for (const p of s) { if (upper(p) != null && lower(p) != null) run.push(p); else flush() }
    flush()
    return polys
  }
  const czPolys = fillBetween((p) => p.elevM, (p) => p.topCretaceousElevM ?? p.topPaleozoicElevM)
  const kPolys = fillBetween((p) => p.topCretaceousElevM, (p) => p.topPaleozoicElevM)
  const pzPolys = fillBetween((p) => p.topPaleozoicElevM, () => bottom)
  const ticksY: number[] = []
  const step = top - bottom > 1200 ? 500 : 250
  for (let e = Math.floor(top / step) * step; e >= bottom; e -= step) ticksY.push(e)
  return (
    <figure className="border-t border-b border-border py-4">
      <SectionHead title="Cross-section" meta="trace to address" />
      <svg viewBox="0 0 460 240" className="w-full" role="img" aria-label={`Cross-section ${Math.round(L)} km long from the ${segment.shortName} trace to the address, showing the surface and the top of the Cretaceous and Paleozoic where contoured.`}>
        <defs>
          <pattern id="tx-cz" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="var(--text-muted)" /><circle cx="7" cy="6" r="0.9" fill="var(--text-muted)" /><path d="M0 9 h4" stroke="var(--text-muted)" strokeWidth="0.8" /></pattern>
          <pattern id="tx-k" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 2 h7 M8 6 h4 M0 6 h2" stroke="var(--text-muted)" strokeWidth="1" /></pattern>
          <pattern id="tx-pz" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 H14 M7 0 V5 M0 5 V10 M14 5 V10" fill="none" stroke="var(--text-secondary)" strokeWidth="1" /></pattern>
        </defs>
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="var(--surface)" stroke="var(--text)" />
        {czPolys.map((pts, i) => <polygon key={'c' + i} points={pts} fill="url(#tx-cz)" />)}
        {kPolys.map((pts, i) => <polygon key={'k' + i} points={pts} fill="url(#tx-k)" />)}
        {pzPolys.map((pts, i) => <polygon key={'p' + i} points={pts} fill="url(#tx-pz)" />)}
        <path d={horizon('topCretaceousElevM')} fill="none" stroke="var(--text)" strokeDasharray="4 3" />
        <path d={horizon('topPaleozoicElevM')} fill="none" stroke="var(--text)" strokeDasharray="4 3" strokeWidth="1.5" />
        <path d={surfPath} fill="none" stroke="var(--text)" strokeWidth="1.5" />
        {/* rupture trace at x = 0 */}
        <line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--text)" strokeWidth="2" />
        <text x={X0 + 6} y={Y0 + 14} fontSize="11" fill="var(--text)">{segment.shortName} trace · rupture top at {segment.ztorKm} km, below frame</text>
        {/* address */}
        <circle cx={X1} cy={y(s[s.length - 1].elevM)} r="4" fill="var(--surface)" stroke="var(--text)" strokeWidth="1.5" />
        <text x={X1 - 5} y={y(s[s.length - 1].elevM) - 9} fontSize="11" textAnchor="end" fill="var(--text)">your address</text>
        {/* axes */}
        <g fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="var(--text-secondary)">
          {ticksY.map((e) => (<g key={e}><line x1={X0 - 4} x2={X0} y1={y(e)} y2={y(e)} stroke="var(--text)" /><text x={X0 - 7} y={y(e) + 4} textAnchor="end">{e}</text></g>))}
          <text x={12} y={(Y0 + Y1) / 2} transform={`rotate(-90 12 ${(Y0 + Y1) / 2})`} textAnchor="middle" letterSpacing="1">ELEV · m</text>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (<g key={f}><line x1={x(f * L)} x2={x(f * L)} y1={Y1} y2={Y1 + 4} stroke="var(--text)" /><text x={x(f * L)} y={Y1 + 16} textAnchor="middle">{Math.round(f * L)}</text></g>))}
          <text x={(X0 + X1) / 2} y={Y1 + 32} textAnchor="middle" letterSpacing="1">DISTANCE FROM TRACE · km · vertical exaggeration ×{Math.round(ve)}</text>
        </g>
      </svg>
      <figcaption className="text-label text-fg-secondary mt-2">
        Surface from SRTM <Dot kind="published" />; Cretaceous and Paleozoic tops <Dot kind="modeled" /> interpolated between published structure contours (Dart 1995; Cushing et al. 1964; Smout 2025). Gaps mean no contour covers that stretch. The section shows why the region is a sediment-filled basin; the shaking pipeline uses only the top 30 m.
      </figcaption>
    </figure>
  )
}
