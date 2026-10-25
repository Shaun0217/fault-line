import { NMSZ_SEGMENTS, SCENARIO_PRESETS, segmentById, SCENARIO_MAG_MIN, SCENARIO_MAG_MAX, type SegmentId } from '../lib/faults'
import { intensityAtReferenceCondition, type ScenarioSiteResult } from '../lib/pipeline'
import type { AppLocation } from '../lib/types'
import { IntensityTile } from './IntensityTile'
import { ReadoutTable, type ReadoutRow } from './ReadoutTable'
import { Disclaimer } from './Disclaimer'
import { km, kmMi, mag, sig2 } from '../lib/format'
import { mmiBand } from '../lib/gmice'
import type { Provenance } from './Mark'
import { Transect } from './Transect'
import type { DistrictGrid } from '../lib/district'
import { SectionHead } from './SectionHead'

interface Props {
  segmentId: SegmentId
  magMw: number
  epsilon: 0 | 1
  onChange: (next: { segmentId?: SegmentId; magMw?: number; epsilon?: 0 | 1 }) => void
  location: AppLocation | null
  result: ScenarioSiteResult | null
  rjbKm: number | null
  busy: boolean
  maxMmi: number | null
  siteClassProvenance: Provenance
  onGoToSite: () => void
  grid: DistrictGrid | null
}

export function ScenarioPanel({ segmentId, magMw, epsilon, onChange, location, result, rjbKm, busy, maxMmi, siteClassProvenance, onGoToSite, grid }: Props) {
  const seg = segmentById(segmentId)
  const activePreset = SCENARIO_PRESETS.find((p) => p.segmentId === segmentId && Math.abs(p.magMw - magMw) < 0.01)

  const rows: ReadoutRow[] = result
    ? [
        { label: 'Distance to trace', value: kmMi(rjbKm ?? 0), provenance: 'published', note: `rupture distance ${km(result.rrupKm)} km to a ${seg.dipDeg}° plane, top at ${seg.ztorKm} km${seg.dipAzimuthDeg != null ? ', dipping SW' : ''}` },
        { label: epsilon ? 'PGA on reference rock, 84th percentile' : 'PGA on reference rock, median', value: sig2(result.pgaReferenceUsedG), unit: 'g', provenance: 'modeled', note: `Atkinson & Boore 2006, ${mag(result.rock.inputs.magMw)}${epsilon ? ` · median ${sig2(result.rock.pgaG)} g × 10^σ` : ''}${result.rock.inputs.clamped ? ' · ' + result.rock.inputs.notes.join('; ') : ''}` },
        { label: `F_PGA, site class ${result.amplified.siteClass}`, value: `× ${result.amplified.fPga.toFixed(2)}`, provenance: siteClassProvenance, note: siteClassProvenance === 'proxy' ? 'ASCE 7-16 Table 11.8-1; site class from terrain slope' : siteClassProvenance === 'assumed' ? 'ASCE 7-16 Table 11.8-1; site class set by you' : 'ASCE 7-16 Table 11.8-1' },
        { label: 'PGA at the surface here', value: sig2(result.amplified.pgaSiteG), unit: 'g', provenance: 'modeled', strong: true },
        { label: 'Intensity at your ground', value: `${result.band.roman} (${result.range.low.roman}–${result.range.high.roman})`, unit: 'MMI', provenance: 'modeled', strong: true, note: `plausible band spans ±${result.sigmaMmiTotal.toFixed(1)} units: GMPE σ ${0.3} log₁₀ and GMICE σ ${0.66} combined` },
        { label: 'Same motion on reference rock', value: intensityAtReferenceCondition(result.rock.pgaG).band.roman, unit: 'MMI', provenance: 'modeled', note: 'no soil amplification' },
      ]
    : []

  return (
    <div className="space-y-8">
      <div className="border-b border-border-strong pb-3">
        <div className="text-meta text-fg-secondary">Scenario · conditional, not a forecast</div>
        <h2 className="text-h2 font-semibold mt-1">If an {mag(magMw)} earthquake occurred on the {seg.name.split(' (')[0]}</h2>
        <p className="text-label text-fg-secondary mt-1">The map and the table show the shaking the model expects for that event. When or whether such an event happens cannot be predicted.</p>
      </div>

      <section>
        <SectionHead title="Presets" meta="1811–12 analogs" />
        <div className="grid grid-cols-2 gap-2">
          {SCENARIO_PRESETS.map((p) => (
            <button key={p.id} onClick={() => onChange({ segmentId: p.segmentId, magMw: p.magMw })} aria-pressed={activePreset?.id === p.id}
              className={`min-h-12 px-3 py-2 border text-left ${activePreset?.id === p.id ? 'bg-surface-2 border-border-strong text-fg' : 'bg-surface border-border hover:border-border-strong text-fg-secondary'}`} title={p.note}>
              <span className={`block text-label leading-snug ${activePreset?.id === p.id ? 'font-semibold' : ''}`}>{p.label.replace(' analog', '')}</span>
              <span className="num text-meta text-fg-secondary">{p.sublabel.split(' · ')[1]}</span>
            </button>
          ))}
        </div>
        {activePreset && <p className="text-meta text-fg-muted mt-2">{activePreset.note}</p>}
      </section>

      <section>
        <SectionHead title="Rupture source" meta="USGS 2014 model" />
        <div className="border-t border-border-strong">
          {NMSZ_SEGMENTS.map((s) => (
            <button key={s.id} onClick={() => onChange({ segmentId: s.id })} aria-pressed={s.id === segmentId}
              className={`w-full text-left grid grid-cols-[16px_1fr_auto] gap-x-3 items-baseline py-3 px-2 border-b border-border min-h-12 ${s.id === segmentId ? 'bg-surface-2' : 'hover:bg-surface'}`}>
              <span className={`inline-block w-3 h-3 self-center border ${s.id === segmentId ? 'bg-fg border-fg' : 'border-border-strong'}`} style={{ borderRadius: '50%' }} aria-hidden="true" />
              <span><span className={s.id === segmentId ? 'text-fg font-medium' : 'text-fg-secondary'}>{s.shortName}</span> <span className="text-label text-fg-secondary">· {s.mechanism}</span></span>
              <span className="num text-label text-fg-secondary">M{s.magRange[0]}–{s.magRange[1]}</span>
            </button>
          ))}
        </div>
        <p className="text-meta text-fg-muted mt-2">{seg.description}</p>
      </section>

      <section>
        <SectionHead title="Event" />
        <div className="flex items-baseline justify-between">
          <label htmlFor="mag" className="text-meta text-fg-secondary">Magnitude · Mw</label>
          <div className="num text-display font-medium">{magMw.toFixed(1)}</div>
        </div>
        <input id="mag" type="range" className="mag mt-4" min={SCENARIO_MAG_MIN} max={SCENARIO_MAG_MAX} step={0.1} value={magMw} onChange={(e) => onChange({ magMw: Number(e.target.value) })} />
        <div className="flex justify-between text-meta text-fg-secondary mt-2 num"><span>{SCENARIO_MAG_MIN.toFixed(1)}</span><span>source model {seg.magRange[0]}–{seg.magRange[1]}</span><span>{SCENARIO_MAG_MAX.toFixed(1)}</span></div>
        <div className="mt-4">
          <div className="text-meta text-fg-secondary mb-2">Ground-motion level</div>
          <div className="seg grid-cols-2">
            <button onClick={() => onChange({ epsilon: 0 })} aria-pressed={epsilon === 0}>Median</button>
            <button onClick={() => onChange({ epsilon: 1 })} aria-pressed={epsilon === 1}>84th percentile (+1σ)</button>
          </div>
          <p className="text-meta text-fg-muted mt-2">{epsilon ? 'Reference motion raised by one model standard deviation (a factor of 2.0) before site amplification: the level exceeded in about one event in six. Emergency planners often plan to this.' : 'The model’s median estimate. Real shaking scatters around it by roughly a factor of two either way.'}</p>
        </div>
      </section>

      {location && result ? (
        <section>
          <SectionHead title={`At ${location.label}`} />
          <IntensityTile result={result} />
          <details className="disclose mt-3 border-t border-border">
            <summary>How this was computed</summary>
            <div className="pb-2 space-y-4">
              <ReadoutTable rows={rows} caption="Scenario ground motion pipeline" />
              {grid && <Transect grid={grid} location={location} segment={seg} />}
            </div>
          </details>
        </section>
      ) : (
        <p className="text-label text-fg-secondary">
          The map shows the regional picture. <button onClick={onGoToSite} className="link">Set an address</button> to see the number for your ground; site class alone can move it a full band.
        </p>
      )}

      <div className="flex items-center justify-between text-meta text-fg-secondary">
        <span>{busy ? 'Recomputing' : maxMmi ? `Peak on map · ${mmiBand(maxMmi).roman}` : ''}</span>
        <span>Computed on this device</span>
      </div>

      <Disclaimer />
    </div>
  )
}
