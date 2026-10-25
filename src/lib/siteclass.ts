/**
 * siteclass.ts — Vs30 to NEHRP / ASCE 7 site class. Classification only.
 * This file never returns an amplification factor (CLAUDE.md, Hard Invariant 1).
 *
 * Boundaries: ASCE/SEI 7-16, Table 20.3-1 "Site Classification".
 *   A  hard rock            Vs30 > 1,500 m/s
 *   B  rock                 760 < Vs30 <= 1,500 m/s
 *   C  very dense soil/soft rock   360 < Vs30 <= 760 m/s
 *   D  stiff soil           180 <= Vs30 <= 360 m/s
 *   E  soft clay soil       Vs30 < 180 m/s
 *   F  requires site response analysis — cannot be assigned from Vs30 alone,
 *      so this function never returns it.
 */

export type SiteClass = 'A' | 'B' | 'C' | 'D' | 'E'

export const SITE_CLASS_DESCRIPTION: Record<SiteClass, string> = {
  A: 'Hard rock',
  B: 'Rock',
  C: 'Very dense soil or soft rock',
  D: 'Stiff soil',
  E: 'Soft clay soil',
}

export function siteClassFromVs30(vs30Ms: number): SiteClass {
  if (!Number.isFinite(vs30Ms) || vs30Ms <= 0) throw new Error(`vs30Ms must be a positive number, got ${vs30Ms}`)
  if (vs30Ms > 1500) return 'A'
  if (vs30Ms > 760) return 'B'
  if (vs30Ms > 360) return 'C'
  if (vs30Ms >= 180) return 'D'
  return 'E'
}
