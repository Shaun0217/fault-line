import type { SiteClass } from '../lib/siteclass'
import { SITE_CLASS_DESCRIPTION } from '../lib/siteclass'
import type { SiteProfile } from '../lib/district'
import type { Provenance } from './Mark'
import { Dot } from './Mark'

interface Props {
  profile: SiteProfile
  fPga: number
  provenance: Provenance
  vs30RangeMs: readonly [number, number]
}

/**
 * Block diagram in the survey tradition (DESIGN.md §10): the ground under the
 * address cut away to bedrock, lithology by hatch, depth axis in metres, one
 * colour. Horizons come from published structure contours (Dart 1995; Cushing
 * et al. 1964; digitized by Smout 2025) interpolated at ~5 km resolution; the
 * top 30 m band is what the site class actually measures.
 */
const HATCH: Record<SiteClass, string> = { A: 'sc-rock', B: 'sc-rock', C: 'sc-dense', D: 'sc-stiff', E: 'sc-soft' }

export function SiteColumn({ profile, fPga, provenance, vs30RangeMs }: Props) {
  const elev = Number.isFinite(profile.elevationM) ? profile.elevationM : 0
  const kDepth = profile.cenozoicThicknessM
  const pzDepth = profile.bedrockDepthM
  const known = pzDepth != null
  // Vertical scale: full depth to bedrock when known, else at least the Cenozoic + an open base.
  const depthSpan = known ? Math.max(120, Math.round(pzDepth * 1.18)) : Math.max(300, (kDepth ?? 0) + 150)
  const niceStep = depthSpan > 800 ? 250 : depthSpan > 400 ? 100 : 50
  // Geometry.
  const X0 = 70, W = 200, Y0 = 70, H = 230, DX = 34, DY = 22
  const yOf = (depthM: number) => Y0 + (Math.min(depthM, depthSpan) / depthSpan) * H
  const yK = kDepth != null ? yOf(kDepth) : null
  const yPz = known ? yOf(pzDepth) : null
  const y30 = yOf(30)
  const face = (yTop: number, yBot: number, fill: string) => <rect x={X0} y={yTop} width={W} height={Math.max(0, yBot - yTop)} fill={fill} />
  const side = (yTop: number, yBot: number, fill: string) => (
    <polygon points={`${X0 + W},${yTop} ${X0 + W + DX},${yTop - DY} ${X0 + W + DX},${yBot - DY} ${X0 + W},${yBot}`} fill={fill} opacity="0.85" />
  )
  const ticks: number[] = []
  for (let d = 0; d <= depthSpan; d += niceStep) ticks.push(d)
  const LX = X0 + W + DX + 12
  const label = (d: number | null, title: string, value: string, dy = 0) => d == null ? null : (
    <g>
      <line x1={X0 + W + DX} x2={LX - 4} y1={yOf(d) - DY} y2={yOf(d) - DY} stroke="var(--border-strong)" />
      <text x={LX} y={yOf(d) - DY - 3 + dy} fontSize="11" fill="var(--text-secondary)">{title}</text>
      <text x={LX} y={yOf(d) - DY + 11 + dy} fontSize="12" fill="var(--text)" fontFamily="IBM Plex Mono, monospace">{value}</text>
    </g>
  )
  return (
    <figure className="border-t border-b border-border py-4">
      <svg viewBox="0 0 560 340" className="w-full" role="img" aria-label={`Block diagram of the ground under this address: ${kDepth != null ? `${kDepth} m of Cenozoic sediment, ` : ''}${known ? `bedrock ${pzDepth} m below the surface` : 'bedrock depth not contoured here'}; the top 30 m is site class ${profile.siteClass}.`}>
        <defs>
          <pattern id="sc-soft" width="8" height="6" patternUnits="userSpaceOnUse"><path d="M0 3 q2 -2 4 0 t4 0" fill="none" stroke="var(--text-secondary)" strokeWidth="1" /></pattern>
          <pattern id="sc-stiff" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 L7 0" stroke="var(--text-secondary)" strokeWidth="1" /></pattern>
          <pattern id="sc-dense" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 L7 0 M0 0 L7 7" stroke="var(--text-secondary)" strokeWidth="0.8" /></pattern>
          <pattern id="sc-rock" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 H12 M6 0 V4 M0 4 V8 M12 4 V8" fill="none" stroke="var(--text-secondary)" strokeWidth="1" /></pattern>
          <pattern id="sc-cz" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="var(--text-muted)" /><circle cx="7" cy="6" r="0.9" fill="var(--text-muted)" /><path d="M0 9 h4" stroke="var(--text-muted)" strokeWidth="0.8" /></pattern>
          <pattern id="sc-k" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 2 h7 M8 6 h4 M0 6 h2" stroke="var(--text-muted)" strokeWidth="1" /></pattern>
          <pattern id="sc-pz" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 H14 M7 0 V5 M0 5 V10 M14 5 V10" fill="none" stroke="var(--text-secondary)" strokeWidth="1" /></pattern>
        </defs>
        {/* top face with the address pin */}
        <polygon points={`${X0},${Y0} ${X0 + DX},${Y0 - DY} ${X0 + W + DX},${Y0 - DY} ${X0 + W},${Y0}`} fill="var(--surface-2)" stroke="var(--text)" />
        <circle cx={X0 + W / 2 + DX / 2} cy={Y0 - DY / 2} r="5" fill="none" stroke="var(--text)" strokeWidth="1.5" />
        <circle cx={X0 + W / 2 + DX / 2} cy={Y0 - DY / 2} r="1.8" fill="var(--text)" />
        <text x={X0} y={Y0 - DY - 12} fontSize="11" fill="var(--text-secondary)">YOUR ADDRESS · surface {Math.round(elev)} m above sea level</text>
        {/* front face layers */}
        {face(Y0, yK ?? (yPz ?? Y0 + H), 'url(#sc-cz)')}
        {yK != null && face(yK, yPz ?? Y0 + H, 'url(#sc-k)')}
        {yPz != null && face(yPz, Y0 + H, 'url(#sc-pz)')}
        {/* side face */}
        {side(Y0, yK ?? (yPz ?? Y0 + H), 'var(--bg)')}
        {yK != null && side(yK, yPz ?? Y0 + H, 'var(--surface-2)')}
        {yPz != null && side(yPz, Y0 + H, 'var(--border)')}
        {/* the 30 m band */}
        <rect x={X0} y={Y0} width={W} height={Math.max(5, y30 - Y0)} fill={`url(#${HATCH[profile.siteClass]})`} stroke="var(--text)" strokeWidth="0.75" />
        {/* horizon lines: dashed = interpolated */}
        {yK != null && <line x1={X0} x2={X0 + W} y1={yK} y2={yK} stroke="var(--text)" strokeDasharray="4 3" />}
        {yPz != null && <line x1={X0} x2={X0 + W} y1={yPz} y2={yPz} stroke="var(--text)" strokeDasharray="4 3" strokeWidth="1.5" />}
        {!known && <line x1={X0} x2={X0 + W} y1={Y0 + H} y2={Y0 + H} stroke="var(--text-muted)" strokeDasharray="1 3" />}
        <rect x={X0} y={Y0} width={W} height={H} fill="none" stroke="var(--text)" />
        {/* depth axis */}
        <g fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="var(--text-secondary)">
          <line x1={X0 - 12} y1={Y0} x2={X0 - 12} y2={Y0 + H} stroke="var(--text)" />
          {ticks.map((d) => (
            <g key={d}><line x1={X0 - 16} y1={yOf(d)} x2={X0 - 12} y2={yOf(d)} stroke="var(--text)" /><text x={X0 - 20} y={yOf(d) + 4} textAnchor="end">{d}</text></g>
          ))}
          <text x={14} y={Y0 + H / 2} transform={`rotate(-90 14 ${Y0 + H / 2})`} textAnchor="middle" letterSpacing="1">DEPTH · m</text>
        </g>
        {/* right-hand labels */}
        {label(0, 'top 30 m · what site class measures', `class ${profile.siteClass} · × ${fPga.toFixed(2)}`, 12)}
        {kDepth != null && kDepth > 40 && label(kDepth, 'top of Cretaceous', `${kDepth} m down`, (yOf(kDepth) - y30 < 40 ? 22 : 0))}
        {known && label(pzDepth, 'Paleozoic bedrock', `${pzDepth} m down`, (kDepth != null && yOf(pzDepth) - yOf(kDepth) < 40 ? 22 : 0))}
        {!known && <text x={LX} y={Y0 + H - DY} fontSize="12" fill="var(--text-secondary)">bedrock deeper than shown;</text>}
        {!known && <text x={LX} y={Y0 + H - DY + 14} fontSize="12" fill="var(--text-secondary)">not contoured here</text>}
        {known && Y0 + H - yPz! >= 18 && <text x={X0 + 6} y={Y0 + H - 6} fontSize="11" fill="var(--text-secondary)">PALEOZOIC BEDROCK</text>}
        {((yK ?? yPz ?? Y0 + H) - y30) > 26 && <text x={X0 + 6} y={y30 + 16} fontSize="11" fill="var(--text)">CENOZOIC SEDIMENT</text>}
        {yK != null && (yPz ?? Y0 + H) - yK > 26 && <text x={X0 + 6} y={yK + 16} fontSize="11" fill="var(--text)">CRETACEOUS</text>}
      </svg>
      <figcaption className="text-label text-fg-secondary mt-2">
        <span className="text-fg">Vs30 {vs30RangeMs[0]}–{vs30RangeMs[1]} m/s, {SITE_CLASS_DESCRIPTION[profile.siteClass].toLowerCase()}</span> <Dot kind={provenance} />.
        {known || kDepth != null ? <> Horizons <Dot kind="modeled" /> interpolated between published structure contours (Dart 1995, USGS MF-2284; Cushing et al. 1964, USGS PP 448-B; digitized by Smout 2025) at about 5 km resolution; expect ±50–100 m.</> : <> No published contour covers this cell, so the base of the sediment is left open.</>}
        {' '}Site class measures only the top 30 m; softer ground there amplifies shaking. The deep sediment column is why the region is a basin, but it is not modeled in the shaking pipeline. Schematic; horizontal width is not to scale.
      </figcaption>
    </figure>
  )
}
