/**
 * siteamp.ts — THE ONLY FILE IN THIS CODEBASE THAT APPLIES SITE AMPLIFICATION.
 * (CLAUDE.md, Hard Invariant 1. If you are about to write an amplification
 * coefficient anywhere else, stop.)
 *
 * Pipeline, always in this order:
 *   1. Reference-condition motion in (gmpe.ts rock motion, or designmaps.ts
 *      mapped values). Neither is amplified.
 *   2. Reference-condition normalization. AB06 B/C coefficients are for
 *      Vs30 = 760 m/s. The ASCE 7-16 Chapter 22 maps (from the USGS 2014
 *      National Seismic Hazard Model, Petersen et al. 2014, USGS OFR 2014-1091)
 *      are also computed for Vs30 = 760 m/s. The conversion factor is therefore
 *      exactly 1.0. It still exists as a named constant so that swapping either
 *      source forces the question to be answered here, once.
 *   3. Code site coefficient applied once:
 *        F_PGA — ASCE/SEI 7-16 Table 11.8-1 (indexed by mapped PGA at 760 m/s)
 *        Fa    — ASCE/SEI 7-16 Table 11.4-1 (indexed by mapped Ss at 760 m/s)
 *      linearly interpolated between columns ("straight-line interpolation for
 *      intermediate values", ASCE 7-16 Tables 11.4-1 and 11.8-1 notes), flat
 *      beyond the end columns.
 *   4. gmice.ts converts the amplified PGA to MMI (not done here).
 *
 * Fv (Table 11.4-2) is intentionally NOT implemented: for Site Class D and E at
 * S1 >= 0.2 g — i.e. nearly all of West Tennessee — ASCE 7-16 §11.4.8 requires a
 * site-specific analysis, and the USGS design service returns null. Publishing an
 * Fv-based number here would be false precision.
 *
 * Table values were cross-checked on 2026-09-05 against the USGS Seismic Design
 * Web Service (ASCE 7-16 edition) at 12 locations × 4 site classes; the snapshot is
 * fixtures/designmaps-asce7-16-sitecoeff-grid.json and siteamp.test.ts asserts
 * agreement.
 *
 * Site Class E with Ss >= 1.0 g: Table 11.4-1 says "see §11.4.8". Exception 1 of
 * §11.4.8 permits Fa to be taken as the Site Class C value; that is what this
 * file does, and it says so in the returned notes.
 */

import { GMPE_REFERENCE_VS30_MS } from './gmpe'
import type { SiteClass } from './siteclass'

export const DESIGN_MAP_EDITION = 'ASCE7-16' as const
/** Reference site condition of the ASCE 7-16 maps (NEHRP B/C boundary). */
export const DESIGN_MAP_REFERENCE_VS30_MS = 760

/**
 * Step 2: factor that takes GMPE reference-condition PGA to design-map
 * reference-condition PGA. Both are 760 m/s, so 1.0. A test asserts that this
 * constant is consistent with the two reference Vs30 values.
 */
export const REFERENCE_CONVERSION_FACTOR = 1.0

if (GMPE_REFERENCE_VS30_MS !== DESIGN_MAP_REFERENCE_VS30_MS && REFERENCE_CONVERSION_FACTOR === 1.0) {
  throw new Error('siteamp.ts: GMPE and design-map reference Vs30 differ but no conversion factor is defined')
}

/** ASCE 7-16 Table 11.8-1 column headers: mapped MCE_G PGA, g. */
const PGA_COLUMNS_G = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] as const
/** ASCE 7-16 Table 11.8-1, F_PGA by site class. */
const F_PGA_TABLE: Record<SiteClass, readonly number[]> = {
  A: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
  B: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  C: [1.3, 1.2, 1.2, 1.2, 1.2, 1.2],
  D: [1.6, 1.4, 1.3, 1.2, 1.1, 1.1],
  E: [2.4, 1.9, 1.6, 1.4, 1.2, 1.1],
}

/** ASCE 7-16 Table 11.4-1 column headers: mapped MCE_R Ss, g. */
const SS_COLUMNS_G = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5] as const
/** ASCE 7-16 Table 11.4-1, Fa by site class. NaN = "See Section 11.4.8". */
const F_A_TABLE: Record<SiteClass, readonly number[]> = {
  A: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
  B: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  C: [1.3, 1.3, 1.2, 1.2, 1.2, 1.2],
  D: [1.6, 1.4, 1.2, 1.1, 1.0, 1.0],
  E: [2.4, 1.7, 1.3, NaN, NaN, NaN],
}

function interpolateColumns(columns: readonly number[], values: readonly number[], x: number): number {
  if (!Number.isFinite(x)) throw new Error(`site coefficient lookup needs a finite value, got ${x}`)
  if (x <= columns[0]) return values[0]
  const last = columns.length - 1
  if (x >= columns[last]) return values[last]
  for (let i = 0; i < last; i++) {
    if (x <= columns[i + 1]) {
      const t = (x - columns[i]) / (columns[i + 1] - columns[i])
      return values[i] + t * (values[i + 1] - values[i])
    }
  }
  return values[last]
}

/** Step 2. Exposed so the pipeline is explicit and testable. */
export function normalizeToDesignReference(pgaGmpeReferenceG: number): number {
  return pgaGmpeReferenceG * REFERENCE_CONVERSION_FACTOR
}

/** F_PGA per ASCE 7-16 Table 11.8-1 for a mapped/reference PGA in g. */
export function fPga(siteClass: SiteClass, pgaReferenceG: number): number {
  return interpolateColumns(PGA_COLUMNS_G, F_PGA_TABLE[siteClass], pgaReferenceG)
}

export interface FaResult {
  fa: number
  /** Present when the table cell says "see §11.4.8" and the §11.4.8 exception was used. */
  note?: string
}

/** Fa per ASCE 7-16 Table 11.4-1 for a mapped Ss in g. */
export function fa(siteClass: SiteClass, ssReferenceG: number): FaResult {
  const row = F_A_TABLE[siteClass]
  const firstNaN = row.findIndex((v) => !Number.isFinite(v))
  if (firstNaN === -1) return { fa: interpolateColumns(SS_COLUMNS_G, row, ssReferenceG) }
  // Site Class E: numeric cells end at Ss = 0.75 g. Below the first "see §11.4.8"
  // column the tabulated value is held flat (this matches the USGS design
  // service, e.g. Ss = 0.924 g → 1.3). At and above it, §11.4.8 Exception 1
  // permits the Site Class C value.
  if (ssReferenceG < SS_COLUMNS_G[firstNaN]) {
    return { fa: interpolateColumns(SS_COLUMNS_G.slice(0, firstNaN), row.slice(0, firstNaN), ssReferenceG) }
  }
  return {
    fa: interpolateColumns(SS_COLUMNS_G, F_A_TABLE.C, ssReferenceG),
    note: 'Site Class E with Ss ≥ 1.0 g: Fa taken as the Site Class C value per ASCE 7-16 §11.4.8 Exception 1.',
  }
}

export interface AmplifiedPga {
  siteClass: SiteClass
  /** Input, GMPE/design-map reference condition (760 m/s), g. */
  pgaReferenceG: number
  fPga: number
  /** Output: PGA at the site surface, g. */
  pgaSiteG: number
}

/**
 * Step 3 for PGA. Used by BOTH the scenario worker and the address readout so
 * the two can never disagree (siteamp.test.ts asserts exact equality).
 */
export function amplifyPga(pgaGmpeReferenceG: number, siteClass: SiteClass): AmplifiedPga {
  if (!(pgaGmpeReferenceG >= 0)) throw new Error(`pga must be >= 0, got ${pgaGmpeReferenceG}`)
  const pgaReferenceG = normalizeToDesignReference(pgaGmpeReferenceG)
  const f = fPga(siteClass, pgaReferenceG)
  return { siteClass, pgaReferenceG, fPga: f, pgaSiteG: pgaReferenceG * f }
}

export interface AmplifiedShortPeriod {
  siteClass: SiteClass
  ssReferenceG: number
  fa: number
  /** S_MS = Fa × Ss (ASCE 7-16 eq. 11.4-1), g. */
  smsG: number
  note?: string
}

/** Step 3 for the short-period design value S_MS = Fa × Ss (ASCE 7-16 eq. 11.4-1). */
export function amplifyShortPeriod(ssReferenceG: number, siteClass: SiteClass): AmplifiedShortPeriod {
  if (!(ssReferenceG >= 0)) throw new Error(`ss must be >= 0, got ${ssReferenceG}`)
  const r = fa(siteClass, ssReferenceG)
  return { siteClass, ssReferenceG, fa: r.fa, smsG: ssReferenceG * r.fa, note: r.note }
}

/**
 * Precomputed F_PGA lookup for renderers that need a table rather than a
 * function (e.g. a texture). Rows are site classes A..E, columns are PGA
 * samples. Generated here so no coefficient ever lives in a shader.
 */
export function fPgaTable(pgaSamplesG: readonly number[]): Record<SiteClass, number[]> {
  const out = {} as Record<SiteClass, number[]>
  for (const sc of ['A', 'B', 'C', 'D', 'E'] as const) out[sc] = pgaSamplesG.map((p) => fPga(sc, p))
  return out
}
