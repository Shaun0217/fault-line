import { GMPE_NAME, GMPE_VALIDITY, GMPE_SIGMA_LOG10 } from '../lib/gmpe'
import { MMI_SIGMA_FROM_PGA } from '../lib/gmice'
import { DESIGN_MAP_EDITION } from '../lib/siteamp'
import { Dot } from './Mark'
import { SectionHead } from './SectionHead'

const SOURCES: Array<[string, string, string]> = [
  ['Ground motion (rock)', 'Atkinson & Boore (2006), BSSA 96(6), 2181–2205. B/C-boundary coefficients, 140 bar.', 'https://doi.org/10.1785/0120050245'],
  ['Site coefficients', 'ASCE/SEI 7-16, Tables 11.4-1 (Fa), 11.8-1 (F_PGA), 20.3-1 (site class); §11.4.8.', 'https://ascelibrary.org/doi/book/10.1061/9780784414248'],
  ['Mapped design values', 'USGS Seismic Design Web Service, ASCE 7-16 edition, reference condition Vs30 = 760 m/s.', 'https://earthquake.usgs.gov/ws/designmaps/'],
  ['Intensity conversion', 'Worden, Gerstenberger, Rhoades & Wald (2012), BSSA 102(1), 204–221.', 'https://doi.org/10.1785/0120110156'],
  ['Site class proxy', 'Wald & Allen (2007), BSSA 97(5), 1379–1395; USGS OFR 2007-1357, stable-continent table.', 'https://doi.org/10.1785/0120060267'],
  ['Fault geometry', 'USGS 2014 National Seismic Hazard Model source files (Petersen et al. 2014, OFR 2014-1091), CEUS-SSC New Madrid sections.', 'https://github.com/usgs/nshm-cous-2014'],
  ['Subsurface horizons', 'USGS data release (Smout 2025) digitizing Dart 1995 (MF-2284) and Cushing et al. 1964 (PP 448-B) structure contours; interpolated, block diagram and cross-section only.', 'https://doi.org/10.5066/P14BV2PI'],
  ['Elevation', 'NASA SRTM 3 arc-second via Open Topo Data.', 'https://www.opentopodata.org/'],
  ['Geocoding', 'US Census Bureau Geocoder (address discarded after lookup).', 'https://geocoding.geo.census.gov/'],
  ['Seismicity', 'USGS FDSN Event Web Service, M≥3 since 1974 in the NMSZ box.', 'https://earthquake.usgs.gov/fdsnws/event/1/'],
  ['Household plan', 'Ready.gov Build a Kit / Make a Plan / Earthquakes; FEMA earthquake safety guidance; MAE Center Report 09-03 (NMSZ impact study).', 'https://www.ready.gov/kit'],
  ['Colour ramp', 'matplotlib “magma” (van der Walt & Smith 2015), truncated; perceptually uniform, colourblind-safe, monotonic in lightness.', 'https://bids.github.io/colormap/'],
  ['Basemap', 'OpenFreeMap “dark” vector tiles (OpenMapTiles schema) © OpenStreetMap contributors.', 'https://openfreemap.org'],
]

export function MethodsPanel({ onInstall }: { onInstall?: () => void }) {
  return (
    <div className="space-y-8 max-w-prose">
      <div>
        <div className="text-meta text-fg-secondary">Methods</div>
        <h2 className="text-h1 font-semibold mt-1">How every number is made</h2>
        <p className="text-body text-fg-secondary mt-2">Every equation carries its full published citation in a header comment in the source code. This is the short version. It is the same pipeline for the address readout and the scenario map.</p>
      </div>

      <ol className="border-t border-border-strong">
        {[
          ['1', 'Reference motion', `Scenario: ${GMPE_NAME}, a stable-continental-crust model (Central & Eastern US only), valid for M${GMPE_VALIDITY.magMwMin}–${GMPE_VALIDITY.magMwMax} and ${GMPE_VALIDITY.rrupKmMin}–${GMPE_VALIDITY.rrupKmMax} km; inputs are clamped and the clamp is shown. Readout: ${DESIGN_MAP_EDITION} mapped PGA. Both are at Vs30 = 760 m/s, unamplified.`],
          ['1b', 'Rupture distance', 'Closest distance from the site to a finite rupture plane hung from the published trace: top at 10 km, 15 km wide, vertical for the strike-slip arms and dipping 40° southwest for the Reelfoot thrust (Csontos & Van Arsdale 2008), so hanging-wall sites near Reelfoot Lake sit closer to the rupture than the trace alone suggests.'],
          ['2', 'Reference normalization', 'The GMPE reference and the design-map reference are both 760 m/s, so the factor is 1.00. It exists as a named constant so that changing either source forces the question.'],
          ['3', 'Site amplification, once', 'ASCE 7-16 Table 11.8-1 F_PGA for the site class, interpolated at the reference PGA. Applied in exactly one file (siteamp.ts) and checked against the USGS service at 12 locations × 4 site classes.'],
          ['4', 'Intensity', `Worden et al. (2012) PGA→MMI. One standard deviation is ${MMI_SIGMA_FROM_PGA} intensity units, which is why intensity is shown as a band with a plausible range and never as a decimal.`],
        ].map(([n, t, d]) => (
          <li key={n} className="py-3 border-b border-border grid grid-cols-[32px_1fr] gap-x-2">
            <div className="num text-fg-secondary">{n}</div>
            <div><div className="font-semibold">{t}</div><div className="text-label text-fg-secondary mt-1">{d}</div></div>
          </li>
        ))}
      </ol>

      <div>
        <SectionHead title="Reading the marks" />
        <div className="grid grid-cols-1 gap-2 text-label">
          <div className="flex gap-3 items-start"><Dot kind="published" /><span><b>Solid</b> — taken from published data: mapped design values, recorded earthquakes, fault traces.</span></div>
          <div className="flex gap-3 items-start"><Dot kind="modeled" /><span><b>Dashed</b> — model output: scenario ground motion, interpolated site coefficients, intensity.</span></div>
          <div className="flex gap-3 items-start"><Dot kind="assumed" /><span><b>Hatched</b> — assumed or user-supplied: defaulted values, questionnaire answers.</span></div>
          <div className="flex gap-3 items-start"><Dot kind="proxy" /><span><b>Cross-hatched</b> — proxy: site class from terrain slope, the liquefaction screen.</span></div>
        </div>
      </div>

      <div className="border-b border-border-strong pb-4">
        <SectionHead title="What this app does not do" />
        <ul className="mt-2 space-y-2 text-label list-disc pl-4">
          <li>It does not predict earthquakes. No science can say when the next New Madrid event will happen; every result here is “if an event of this size occurred on this source”.</li>
          <li>It does not know your soil. Site class comes from terrain slope at ~5 km resolution (a published proxy), not from a borehole. Along the Mississippi bluff and in dissected uplands the proxy tends to read one class too stiff (C where borings show D). A geotechnical report beats this app.</li>
          <li>It does not model directivity or basin effects. Ground-motion variability (σ ≈ {GMPE_SIGMA_LOG10} log₁₀ units, roughly a factor of two) is shown as the plausible band and as the 84th-percentile option, not resolved.</li>
          <li>It does not assess your building. Intensity describes the ground; damage depends on construction.</li>
        </ul>
      </div>

      <div>
        <SectionHead title="Sources" meta="all public" />
        <ul className="border-t border-border-strong">
          {SOURCES.map(([k, v, href]) => (
            <li key={k} className="py-2 border-b border-border text-label">
              <div className="font-semibold">{k}</div>
              <div className="text-fg-secondary">{v} <a className="link" href={href} target="_blank" rel="noopener">source</a></div>
            </li>
          ))}
        </ul>
      </div>

      {onInstall && <button onClick={onInstall} className="btn-quiet w-full">Install for offline use</button>}
      <p className="text-meta text-fg-secondary">Covers West Tennessee and the New Madrid Seismic Zone. Data is prebaked at build time and cached by a service worker, so the readout, scenario simulator and plan work with no connection.</p>
    </div>
  )
}
