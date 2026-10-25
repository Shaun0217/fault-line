/**
 * pipeline.ts — the one composition of the ground-motion pipeline that every
 * consumer (scenario worker, address readout, tests) calls. Keeping it in one
 * function is what makes "readout amplification == scenario amplification" a
 * structural guarantee rather than a hope.
 *
 *   reference PGA ──► siteamp.amplifyPga ──► gmice.mmiFromPgaG ──► band/range
 */

import { rockMotion, GMPE_SIGMA_LOG10, type RockMotion } from './gmpe'
import { amplifyPga, normalizeToDesignReference, type AmplifiedPga } from './siteamp'
import { mmiFromPgaG, mmiBand, mmiRange, mmiSigmaWithPgaUncertainty, type MmiBand } from './gmice'
import type { SiteClass } from './siteclass'

export interface SiteIntensity {
  amplified: AmplifiedPga
  /** Continuous MMI. Never display this with decimals; use band/range. */
  mmi: number
  band: MmiBand
  range: { low: MmiBand; high: MmiBand }
}

/** Reference-condition PGA (g) + site class → amplified PGA + intensity. */
export function intensityFromReferencePga(pgaReferenceG: number, siteClass: SiteClass): SiteIntensity {
  const amplified = amplifyPga(pgaReferenceG, siteClass)
  const mmi = mmiFromPgaG(amplified.pgaSiteG)
  return { amplified, mmi, band: mmiBand(mmi), range: mmiRange(mmi) }
}

export interface ScenarioSiteResult extends SiteIntensity {
  rock: RockMotion
  rrupKm: number
  /** Number of GMPE standard deviations applied to the reference motion (0 = median, 1 = 84th percentile). */
  epsilon: number
  /** Reference PGA actually fed to amplification (median × 10^(ε·σ)), g. */
  pgaReferenceUsedG: number
  /** σ of MMI including the GMPE's own uncertainty, intensity units. */
  sigmaMmiTotal: number
}

/**
 * Scenario path: magnitude + rupture distance + site class → everything.
 * epsilon shifts the reference motion by that many GMPE sigmas (log10 units) before
 * amplification; the plausible band uses the GMPE and GMICE uncertainties combined.
 */
export function scenarioAtSite(magMw: number, rrupKm: number, siteClass: SiteClass, epsilon = 0): ScenarioSiteResult {
  const rock = rockMotion(magMw, rrupKm)
  const pgaReferenceUsedG = rock.pgaG * Math.pow(10, epsilon * GMPE_SIGMA_LOG10)
  const base = intensityFromReferencePga(pgaReferenceUsedG, siteClass)
  const sigmaMmiTotal = mmiSigmaWithPgaUncertainty(base.amplified.pgaSiteG, GMPE_SIGMA_LOG10)
  return { ...base, range: mmiRange(base.mmi, sigmaMmiTotal), rock, rrupKm: rock.inputs.rrupKm, epsilon, pgaReferenceUsedG, sigmaMmiTotal }
}

/**
 * Comparison row for the readout: the intensity the same reference motion
 * would produce with no site amplification at all (the map reference
 * condition, Vs30 = 760 m/s). No coefficient is applied here; the reference
 * normalization is the identity step from siteamp.ts.
 */
export function intensityAtReferenceCondition(pgaReferenceG: number): { pgaG: number; mmi: number; band: MmiBand; range: { low: MmiBand; high: MmiBand } } {
  const pgaG = normalizeToDesignReference(pgaReferenceG)
  const mmi = mmiFromPgaG(pgaG)
  return { pgaG, mmi, band: mmiBand(mmi), range: mmiRange(mmi) }
}
