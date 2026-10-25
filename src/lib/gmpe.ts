/**
 * gmpe.ts — Ground-motion prediction for STABLE CONTINENTAL CRUST, reference
 * site condition only. This file knows nothing about soil.
 *
 * Model
 * -----
 * Atkinson, G. M., and D. M. Boore (2006). Earthquake ground-motion prediction
 * equations for eastern North America. Bulletin of the Seismological Society of
 * America 96(6), 2181–2205. https://doi.org/10.1785/0120050245
 *
 * Equation (5), p. 2191:
 *   log10 Y = c1 + c2 M + c3 M^2 + (c4 + c5 M) f1 + (c6 + c7 M) f2
 *             + (c8 + c9 M) f0 + c10 Rcd
 *   f0 = max(log10(R0 / Rcd), 0)         R0 = 10 km
 *   f1 = min(log10 Rcd, log10 R1)        R1 = 70 km
 *   f2 = max(log10(Rcd / R2), 0)         R2 = 140 km
 *
 * Y   : 5%-damped PSA or PGA in cm/s^2 (geometric mean of horizontals), log BASE 10
 * M   : moment magnitude (Mw)
 * Rcd : closest distance to the fault rupture (Rrup), km. Clipped to >= 1 km
 *       because the functional form is singular at 0 (AB06 p. 2182).
 *
 * Coefficients: Table 9 of AB06 (NEHRP B/C boundary, Vs30 = 760 m/s), stress
 * parameter 140 bars. Values below are the higher-precision ones from D. Boore's
 * Fortran implementation, as transcribed in GEM OpenQuake hazardlib
 * (openquake/hazardlib/gsim/atkinson_boore_2006.py, COEFFS_BC), retrieved
 * 2026-09-05. The optional stress-parameter adjustment of AB06 p. 2198 and the
 * Atkinson & Boore (2011) modification are NOT applied.
 *
 * Total sigma: 0.30 log10 units (AB06 Table 9 caption, p. 2202).
 *
 * Applicability (AB06 p. 2182): 3.5 <= M <= 8.0, 1 km <= Rcd <= 1000 km.
 * Inputs are clamped to this range and the clamp is reported to the caller.
 *
 * The site term S of AB06 eq. (5) is deliberately omitted. All amplification in
 * this app happens in siteamp.ts (see CLAUDE.md, Hard Invariant 1).
 */

/** Reference site condition of the coefficient set below (NEHRP B/C boundary). */
export const GMPE_REFERENCE_VS30_MS = 760

export const GMPE_NAME = 'Atkinson & Boore (2006), B/C boundary, 140 bar'

export const GMPE_VALIDITY = {
  magMwMin: 3.5,
  magMwMax: 8.0,
  rrupKmMin: 1.0,
  rrupKmMax: 1000.0,
} as const

/** AB06 total standard deviation, log10 units. */
export const GMPE_SIGMA_LOG10 = 0.3

const R0_KM = 10.0
const R1_KM = 70.0
const R2_KM = 140.0

type Ab06Coeffs = readonly [
  c1: number, c2: number, c3: number, c4: number, c5: number,
  c6: number, c7: number, c8: number, c9: number, c10: number,
]

/** AB06 Table 9 (B/C boundary). Keys are intensity measures. */
const COEFFS_BC: Record<'pga' | 'psa1p0' | 'psa0p315', Ab06Coeffs> = {
  //         c1          c2          c3          c4          c5          c6          c7          c8          c9          c10
  pga:      [5.233e-1,  9.686e-1,  -6.196e-2,  -2.439,     1.465e-1,  -2.335,     1.912e-1,  -8.695e-2,  -8.285e-2,  -6.304e-4],
  psa1p0:   [-5.058,    2.233,     -1.454e-1,  -2.030,     1.408e-1,  -8.744e-1,  5.412e-2,   7.922e-1,  -1.697e-1,  -4.886e-4],
  psa0p315: [-1.560,    1.455,     -9.312e-2,  -1.977,     1.209e-1,  -9.466e-1,  5.576e-2,   6.499e-1,  -1.558e-1,  -9.552e-4],
}

/** Standard gravity, cm/s^2 (CODATA / ISO 80000-3). */
export const G_CM_S2 = 980.665

export interface ClampedInputs {
  magMw: number
  rrupKm: number
  /** True when either input was moved to the edge of the model's valid range. */
  clamped: boolean
  notes: string[]
}

/** Clamp inputs to the published validity range and say so. Never extrapolate silently. */
export function clampToValidity(magMw: number, rrupKm: number): ClampedInputs {
  const notes: string[] = []
  let m = magMw
  let r = rrupKm
  if (!Number.isFinite(m)) throw new Error('magMw must be finite')
  if (!Number.isFinite(r)) throw new Error('rrupKm must be finite')
  if (m < GMPE_VALIDITY.magMwMin) { m = GMPE_VALIDITY.magMwMin; notes.push(`Magnitude raised to model minimum M${m}`) }
  if (m > GMPE_VALIDITY.magMwMax) { m = GMPE_VALIDITY.magMwMax; notes.push(`Magnitude capped at model maximum M${m}`) }
  if (r < GMPE_VALIDITY.rrupKmMin) { r = GMPE_VALIDITY.rrupKmMin; notes.push(`Distance floored at ${r} km (model singular at 0)`) }
  if (r > GMPE_VALIDITY.rrupKmMax) { r = GMPE_VALIDITY.rrupKmMax; notes.push(`Distance capped at ${r} km`) }
  return { magMw: m, rrupKm: r, clamped: notes.length > 0, notes }
}

/** AB06 eq. (5) without the site term. Returns log10 of cm/s^2. Inputs must already be clamped. */
function ab06Log10CmS2(c: Ab06Coeffs, magMw: number, rrupKm: number): number {
  const [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10] = c
  const logR = Math.log10(rrupKm)
  const f0 = Math.max(Math.log10(R0_KM / rrupKm), 0)
  const f1 = Math.min(logR, Math.log10(R1_KM))
  const f2 = Math.max(Math.log10(rrupKm / R2_KM), 0)
  return (
    c1 + c2 * magMw + c3 * magMw * magMw +
    (c4 + c5 * magMw) * f1 +
    (c6 + c7 * magMw) * f2 +
    (c8 + c9 * magMw) * f0 +
    c10 * rrupKm
  )
}

export interface RockMotion {
  /** Median PGA, g, at Vs30 = GMPE_REFERENCE_VS30_MS. */
  pgaG: number
  /** Median 5%-damped PSA at 1.0 s, g, same reference condition. */
  psa1p0G: number
  /** Median 5%-damped PSA at 0.315 s, g (closest AB06 period to the 0.3 s GMICE period). */
  psa0p315G: number
  inputs: ClampedInputs
}

/**
 * Median reference-condition motion for a moment magnitude and rupture distance.
 * Output is in g. Nothing here is amplified for soil.
 */
export function rockMotion(magMw: number, rrupKm: number): RockMotion {
  const inputs = clampToValidity(magMw, rrupKm)
  const toG = (log10CmS2: number) => Math.pow(10, log10CmS2) / G_CM_S2
  return {
    pgaG: toG(ab06Log10CmS2(COEFFS_BC.pga, inputs.magMw, inputs.rrupKm)),
    psa1p0G: toG(ab06Log10CmS2(COEFFS_BC.psa1p0, inputs.magMw, inputs.rrupKm)),
    psa0p315G: toG(ab06Log10CmS2(COEFFS_BC.psa0p315, inputs.magMw, inputs.rrupKm)),
    inputs,
  }
}

/** Convenience: median rock PGA in g. */
export function pgaRockG(magMw: number, rrupKm: number): number {
  return rockMotion(magMw, rrupKm).pgaG
}
