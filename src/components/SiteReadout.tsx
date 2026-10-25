import { useState } from 'react'
import type { SiteProfile } from '../lib/district'
import { intensityAtReferenceCondition, type SiteIntensity } from '../lib/pipeline'
import type { AppLocation } from '../lib/types'
import { SITE_CLASS_DESCRIPTION, type SiteClass } from '../lib/siteclass'
import { IntensityTile } from './IntensityTile'
import { ReadoutTable, type ReadoutRow } from './ReadoutTable'
import { AddressSearch } from './AddressSearch'
import { SectionHead } from './SectionHead'
import { SiteColumn } from './SiteColumn'
import { ProvenanceKey, type Provenance } from './Mark'
import { sig2 } from '../lib/format'

interface Props {
  online: boolean
  location: AppLocation | null
  profile: SiteProfile | null
  readout: SiteIntensity | null
  referenceSource: 'live' | 'grid' | 'none'
  onLocate: (loc: AppLocation) => void
  onClear: () => void
  onSave: (label: string) => void
  onGoToScenario: () => void
  siteClassOverride: SiteClass | null
  onSiteClassOverride: (sc: SiteClass | null) => void
}

const LIQ_WORDS = { higher: 'Higher', moderate: 'Moderate', lower: 'Lower', unknown: 'Unknown' } as const

export function SiteReadout({ online, location, profile, readout, referenceSource, onLocate, onClear, onSave, onGoToScenario, siteClassOverride, onSiteClassOverride }: Props) {
  const [label, setLabel] = useState('')

  if (!location || !profile) {
    return (
      <div className="space-y-6 max-w-prose">
        <div>
          <h1 className="text-h1 text-fg">What will the ground under your address do in a major New Madrid earthquake?</h1>
          <p className="text-label text-fg-secondary mt-2">
            Soft river soils can turn strong shaking into severe shaking a few miles apart. Fault Line reads the site under one address, models the shaking from each New Madrid fault, and builds a household plan that works with the power out.
          </p>
        </div>
        <AddressSearch online={online} onLocate={onLocate} />
        <p className="text-meta text-fg-muted">
          Every result is conditional: if an earthquake of this size occurred on this fault. No one can predict when one will.
        </p>
      </div>
    )
  }

  const proxy = profile.siteClassSource === 'slope-proxy'
  const userSet = profile.siteClassSource === 'user'
  const classProv: Provenance = userSet ? 'assumed' : proxy ? 'proxy' : 'assumed'

  // At most three supporting rows; everything else is behind the disclosure.
  const whyRows: ReadoutRow[] = [
    { label: 'Site class', value: profile.siteClass, provenance: classProv, note: `${SITE_CLASS_DESCRIPTION[profile.siteClass]}${userSet ? ', set by you' : proxy ? ', from terrain slope' : ', default outside the dataset'}` },
    { label: 'Vs30', value: userSet ? vs30ForClass(profile.siteClass) : profile.inGrid ? `${profile.vs30RangeMs[0]}–${profile.vs30RangeMs[1]}` : '760', unit: 'm/s', provenance: classProv, note: 'Shear-wave speed in the top 30 m. Slower ground shakes harder.' },
    ...(readout ? [{ label: 'Shaking on bare rock here', value: intensityAtReferenceCondition(readout.amplified.pgaReferenceG).band.roman, unit: 'MMI', provenance: 'modeled' as Provenance, note: `Your soil raises it by ${(readout.amplified.fPga).toFixed(2)}×.` }] : []),
  ]

  const pipelineRows: ReadoutRow[] = readout
    ? [
        { label: 'Mapped PGA, reference rock', value: sig2(readout.amplified.pgaReferenceG), unit: 'g', provenance: 'published', note: `ASCE 7-16 MCE_G at Vs30 760 m/s, ${referenceSource === 'live' ? 'USGS service' : 'prebaked grid'}` },
        { label: `Site coefficient F_PGA, class ${profile.siteClass}`, value: `× ${readout.amplified.fPga.toFixed(2)}`, provenance: 'modeled', note: 'ASCE 7-16 Table 11.8-1, interpolated' },
        { label: 'PGA at the surface', value: sig2(readout.amplified.pgaSiteG), unit: 'g', provenance: 'modeled' },
        { label: 'Liquefaction screen', value: LIQ_WORDS[profile.liquefactionProxy], provenance: 'proxy', note: 'From site class only. Not a susceptibility map.' },
        { label: 'Elevation', value: Number.isFinite(profile.elevationM) ? Math.round(profile.elevationM).toString() : '—', unit: 'm', provenance: 'published', note: Number.isFinite(profile.slopeMPerM) ? `SRTM; slope ${profile.slopeMPerM.toExponential(1)} m/m` : undefined },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* 1. Location */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-label text-fg truncate">{location.label}</div>
          <div className="num text-meta text-fg-muted">{location.lat.toFixed(3)}, {location.lon.toFixed(3)}{!profile.inGrid && ' · outside the modeled area'}</div>
        </div>
        <button onClick={onClear} className="link text-meta shrink-0">Change</button>
      </div>

      {/* 2. The answer */}
      {readout ? (
        <IntensityTile result={readout} caption="Building-code design level: the rare shaking structures here are designed against, not a forecast." />
      ) : (
        <p className="text-label text-fg-secondary">No mapped design value is available outside the modeled area while offline. The scenario simulator still works here.</p>
      )}

      <button onClick={onGoToScenario} className="btn w-full">Run a New Madrid scenario here</button>

      {/* 3. Why */}
      <section>
        <SectionHead title="Why" />
        <ReadoutTable rows={whyRows} caption="Site conditions" showKey={false} />
        <div className="mt-3"><ProvenanceKey kinds={[...new Set(whyRows.map((r) => r.provenance))]} /></div>

        <details className="disclose mt-3 border-t border-border">
          <summary>How this was estimated</summary>
          <div className="pb-2 space-y-4">
            {readout && <ReadoutTable rows={pipelineRows} caption="Ground-motion pipeline" />}
            <p className="text-meta text-fg-secondary">
              {proxy && 'Site class is estimated from terrain slope using the Wald and Allen (2007) correlation, so it is a proxy rather than a measurement. Along the Mississippi bluff and in dissected uplands it tends to read one class too stiff. '}
              {userSet && 'You set the site class, so it is marked as assumed rather than measured. '}
              Ground motion carries roughly a factor-of-two uncertainty and intensity about one band. This is not a substitute for a geotechnical report.
            </p>
            <div>
              <label htmlFor="sc-override" className="block text-meta text-fg-secondary mb-2">If you have a geotechnical report, set the site class</label>
              <select id="sc-override" value={siteClassOverride ?? ''} onChange={(e) => onSiteClassOverride((e.target.value || null) as SiteClass | null)} className="field">
                <option value="">Use the terrain estimate</option>
                {(['A', 'B', 'C', 'D', 'E'] as SiteClass[]).map((c) => <option key={c} value={c}>Class {c} — {SITE_CLASS_DESCRIPTION[c]}</option>)}
              </select>
            </div>
            {readout && <SiteColumn profile={profile} vs30RangeMs={userSet ? vs30RangeForClass(profile.siteClass) : profile.vs30RangeMs} fPga={readout.amplified.fPga} provenance={classProv} />}
          </div>
        </details>
      </section>

      <section>
        <SectionHead title="Save this place" />
        <div className="flex gap-2">
          <input id="save-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, school, work" className="field" />
          <button onClick={() => { onSave(label.trim() || location.label); setLabel('') }} className="btn-quiet">Save</button>
        </div>
        <p className="text-meta text-fg-muted mt-2">Stores the site profile and coordinates rounded to about 100 m, never the street address.</p>
      </section>
    </div>
  )
}

/** ASCE 7-16 Table 20.3-1 Vs30 range for a class, for display when the user sets the class directly. */
function vs30RangeForClass(sc: SiteClass): readonly [number, number] {
  return ({ A: [1500, 3000], B: [760, 1500], C: [360, 760], D: [180, 360], E: [0, 180] } as const)[sc]
}
function vs30ForClass(sc: SiteClass): string {
  const [lo, hi] = vs30RangeForClass(sc)
  return sc === 'A' ? `> ${lo}` : sc === 'E' ? `< ${hi}` : `${lo}–${hi}`
}
