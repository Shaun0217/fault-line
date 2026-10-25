/**
 * gmice.ts — Ground-motion to Modified Mercalli Intensity conversion.
 *
 * Worden, C. B., M. C. Gerstenberger, D. A. Rhoades, and D. J. Wald (2012).
 * Probabilistic relationships between ground-motion parameters and Modified
 * Mercalli Intensity in California. Bulletin of the Seismological Society of
 * America 102(1), 204–221. https://doi.org/10.1785/0120110156
 *
 * Bilinear form (WGRW12 eq. 3 / Table 1, "reversible" fits, no distance or
 * magnitude term):
 *   MMI = c1 + c2 log10(Y)        for log10(Y) <  t1
 *   MMI = c3 + c4 log10(Y)        for log10(Y) >= t1
 * Y in cm/s^2 for PGA and PSA, cm/s for PGV.
 *
 * Coefficients below are transcribed from the USGS ShakeMap implementation
 * (shakelib/gmice/wgrw12.py, constants `__constants` and `__constants2`),
 * retrieved 2026-09-05 from https://usgs.github.io/shakelib/. The second table
 * is ShakeMap's low-intensity extension (MMI 1–2 range) discussed but not
 * tabulated in the paper; it only affects motions far below "felt".
 *
 * Reported sigma of MMI given PGA is 0.66 intensity units (WGRW12 Table 1).
 * That is why this app displays intensity as a band, never as a decimal.
 *
 * Caveat, stated on screen: WGRW12 is calibrated on California data. There is no
 * comparably complete CEUS GMICE; Atkinson & Kaka (2007) is the CEUS
 * alternative and gives similar intensities at the PGA levels that matter here.
 */

import { G_CM_S2 } from './gmpe'

interface Wgrw12 {
  c1: number; c2: number; c3: number; c4: number; t1: number
  /** Low-intensity extension: MMI = l1 + l2 log10 Y below lt1. */
  l1: number; l2: number; lt1: number
  sigmaMmi: number
}

const PGA: Wgrw12 = { c1: 1.78, c2: 1.55, c3: -1.60, c4: 3.70, t1: 1.57, l1: 1.71, l2: 2.08, lt1: 0.14, sigmaMmi: 0.66 }
const PSA1P0: Wgrw12 = { c1: 2.50, c2: 1.51, c3: 0.20, c4: 2.90, t1: 1.65, l1: 2.71, l2: 2.17, lt1: -0.33, sigmaMmi: 0.75 }
const PSA0P3: Wgrw12 = { c1: 1.26, c2: 1.69, c3: -4.15, c4: 4.14, t1: 2.21, l1: 1.15, l2: 1.92, lt1: 0.44, sigmaMmi: 0.82 }

export const MMI_SIGMA_FROM_PGA = PGA.sigmaMmi
export const MMI_MIN = 1
export const MMI_MAX = 10

function mmiFromLog10(c: Wgrw12, log10Y: number): number {
  let mmi: number
  if (log10Y < c.lt1) mmi = c.l1 + c.l2 * log10Y
  else if (log10Y < c.t1) mmi = c.c1 + c.c2 * log10Y
  else mmi = c.c3 + c.c4 * log10Y
  return Math.min(MMI_MAX, Math.max(MMI_MIN, mmi))
}

/** MMI from PGA in g (converted to cm/s^2 internally). */
export function mmiFromPgaG(pgaG: number): number {
  if (!(pgaG > 0)) return MMI_MIN
  return mmiFromLog10(PGA, Math.log10(pgaG * G_CM_S2))
}

/** MMI from 5%-damped PSA at 1.0 s, in g. */
export function mmiFromPsa1p0G(psaG: number): number {
  if (!(psaG > 0)) return MMI_MIN
  return mmiFromLog10(PSA1P0, Math.log10(psaG * G_CM_S2))
}

/** MMI from 5%-damped PSA at 0.3 s, in g. */
export function mmiFromPsa0p3G(psaG: number): number {
  if (!(psaG > 0)) return MMI_MIN
  return mmiFromLog10(PSA0P3, Math.log10(psaG * G_CM_S2))
}

/** Inverse of the PGA relationship (median), g. Used for tests and legend boundaries. */
export function pgaGFromMmi(mmi: number): number {
  const c = PGA
  const mmiAtT1 = c.c1 + c.c2 * c.t1
  const log10Y = mmi < mmiAtT1 ? (mmi - c.c1) / c.c2 : (mmi - c.c3) / c.c4
  return Math.pow(10, log10Y) / G_CM_S2
}

export interface MmiBand {
  /** Integer intensity 1..10 */
  level: number
  roman: string
  /** USGS ShakeMap "perceived shaking" wording */
  shaking: string
  /** USGS ShakeMap "potential damage" wording */
  damage: string
  /** One plain line of what that damage looks like, from the USGS Modified Mercalli descriptions. */
  consequence: string
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/**
 * Perceived shaking / potential damage wording follows the USGS ShakeMap
 * instrumental intensity legend (Wald et al. 1999; Worden et al. 2012 Table 2).
 */
const BANDS: Omit<MmiBand, 'level' | 'roman'>[] = [
  { shaking: 'Not felt', damage: 'None', consequence: 'Not felt except by a very few under favourable conditions.' },
  { shaking: 'Weak', damage: 'None', consequence: 'Felt by a few people at rest, mostly on upper floors.' },
  { shaking: 'Weak', damage: 'None', consequence: 'Felt indoors; hanging objects swing, like a passing truck.' },
  { shaking: 'Light', damage: 'None', consequence: 'Windows and dishes rattle; parked cars rock noticeably.' },
  { shaking: 'Moderate', damage: 'Very light', consequence: 'Furniture moves, unstable objects fall, sleepers wake.' },
  { shaking: 'Strong', damage: 'Light', consequence: 'Plaster cracks; some chimneys and unreinforced masonry are damaged.' },
  { shaking: 'Very strong', damage: 'Moderate', consequence: 'Considerable damage to unreinforced masonry; chimneys break at the roofline.' },
  { shaking: 'Severe', damage: 'Moderate to heavy', consequence: 'Heavy damage to unreinforced masonry; ordinary buildings partly collapse.' },
  { shaking: 'Violent', damage: 'Heavy', consequence: 'Weak masonry destroyed; underground pipes break; ground cracks.' },
  { shaking: 'Extreme', damage: 'Very heavy', consequence: 'Most masonry and frame structures destroyed; ground badly cracked.' },
]

/** Round a continuous MMI to its integer band (standard rounding, clamped to 1..10). */
export function mmiBand(mmi: number): MmiBand {
  const level = Math.min(MMI_MAX, Math.max(MMI_MIN, Math.round(mmi)))
  const b = BANDS[level - 1]
  return { level, roman: ROMAN[level], ...b }
}

/**
 * Plausible range given one sigma of the GMICE. Returned as integer bands so
 * the UI can say "VII, plausibly VI–VIII".
 */
export function mmiRange(mmi: number, sigma: number = MMI_SIGMA_FROM_PGA): { low: MmiBand; high: MmiBand } {
  return { low: mmiBand(mmi - sigma), high: mmiBand(mmi + sigma) }
}

/**
 * Standard deviation of MMI when the PGA itself is uncertain by sigmaLog10Pga
 * (e.g. the GMPE's total sigma). The GMICE is piecewise linear in log10 PGA, so
 * the PGA uncertainty maps through the local slope and adds in quadrature to the
 * GMICE's own scatter: σ_MMI = sqrt((slope · σ_log10PGA)² + σ_GMICE²).
 * For AB06 (σ = 0.30) on the upper WGRW12 segment this is ≈ 1.29 intensity units.
 */
export function mmiSigmaWithPgaUncertainty(pgaG: number, sigmaLog10Pga: number): number {
  const c = PGA
  const log10Y = pgaG > 0 ? Math.log10(pgaG * G_CM_S2) : -Infinity
  const slope = log10Y < c.lt1 ? c.l2 : log10Y < c.t1 ? c.c2 : c.c4
  return Math.sqrt((slope * sigmaLog10Pga) ** 2 + c.sigmaMmi ** 2)
}
