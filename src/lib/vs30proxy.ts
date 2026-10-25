/**
 * vs30proxy.ts — topographic-slope proxy for Vs30. Used by the prebake script to
 * assign a site class to every grid cell, because no measured Vs30 dataset is
 * available at address resolution for West Tennessee without a key or a GIS
 * stack. The UI labels every site class that comes from here as an estimate.
 *
 * Wald, D. J., and T. I. Allen (2007). Topographic slope as a proxy for seismic
 * site conditions and amplification. Bulletin of the Seismological Society of
 * America 97(5), 1379–1395. https://doi.org/10.1785/0120060267
 * Also USGS Open-File Report 2007-1357, Table (p. 12), "stable continent"
 * column, which was calibrated on Mississippi Embayment measurements — i.e. on
 * this exact region. Values transcribed from the OFR PDF on 2026-09-05.
 *
 *   Site class   Vs30 (m/s)   slope (m/m), stable continent
 *   E            < 180        < 2.0E-5
 *   D            180–240      2.0E-5 – 2.0E-3
 *   D            240–300      2.0E-3 – 4.0E-3
 *   D            300–360      4.0E-3 – 7.2E-3   (Wald & Allen list this bin under D)
 *   C            360–490      7.2E-3 – 0.013
 *   B/C          490–620      0.013  – 0.018
 *   B            620–760      0.018  – 0.025
 *   B            > 760        > 0.025
 *
 * Wald & Allen computed slope from the 30 arc-second SRTM30 DEM. The prebake
 * uses central differences over ±30 arc-seconds of Copernicus GLO-90 elevations
 * (via the Open-Meteo elevation API), which is the closest free equivalent; the
 * residual difference is documented in METHODS.md as part of the proxy error.
 *
 * Returned Vs30 is the midpoint of the bin (for the open-ended bins, a
 * representative value inside the bin). Only the bin boundaries matter for
 * classification, which is all this app uses.
 */

interface SlopeBin {
  slopeMaxMPerM: number
  vs30LowMs: number
  vs30HighMs: number
}

/** Stable-continent column, ascending slope. The last bin is open-ended. */
export const STABLE_CONTINENT_BINS: readonly SlopeBin[] = [
  { slopeMaxMPerM: 2.0e-5, vs30LowMs: 0, vs30HighMs: 180 },
  { slopeMaxMPerM: 2.0e-3, vs30LowMs: 180, vs30HighMs: 240 },
  { slopeMaxMPerM: 4.0e-3, vs30LowMs: 240, vs30HighMs: 300 },
  { slopeMaxMPerM: 7.2e-3, vs30LowMs: 300, vs30HighMs: 360 },
  { slopeMaxMPerM: 0.013, vs30LowMs: 360, vs30HighMs: 490 },
  { slopeMaxMPerM: 0.018, vs30LowMs: 490, vs30HighMs: 620 },
  { slopeMaxMPerM: 0.025, vs30LowMs: 620, vs30HighMs: 760 },
  { slopeMaxMPerM: Infinity, vs30LowMs: 760, vs30HighMs: 900 },
]

export interface Vs30Proxy {
  vs30Ms: number
  vs30LowMs: number
  vs30HighMs: number
  slopeMPerM: number
}

/** Slope in m/m (rise over run, not degrees) → Vs30 estimate with its bin. */
export function vs30FromSlopeStableContinent(slopeMPerM: number): Vs30Proxy {
  if (!Number.isFinite(slopeMPerM) || slopeMPerM < 0) throw new Error(`slope must be a finite non-negative number, got ${slopeMPerM}`)
  for (const bin of STABLE_CONTINENT_BINS) {
    if (slopeMPerM < bin.slopeMaxMPerM) {
      const vs30Ms = bin.vs30LowMs === 0 ? 150 : (bin.vs30LowMs + bin.vs30HighMs) / 2
      return { vs30Ms, vs30LowMs: bin.vs30LowMs, vs30HighMs: bin.vs30HighMs, slopeMPerM }
    }
  }
  throw new Error('unreachable')
}

/**
 * Slope magnitude from a 5-point elevation stencil (centre, N, S, E, W) with
 * the neighbours at ±halfSpanM metres. Slope = |∇z| in m/m.
 */
export function slopeFromStencil(zN: number, zS: number, zE: number, zW: number, halfSpanNorthM: number, halfSpanEastM: number): number {
  const dzdy = (zN - zS) / (2 * halfSpanNorthM)
  const dzdx = (zE - zW) / (2 * halfSpanEastM)
  return Math.hypot(dzdx, dzdy)
}
