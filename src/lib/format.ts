/** Number formatting that respects "no false precision" (CLAUDE.md, Hard Invariant 3). */

/** Two significant figures, e.g. 0.6123 → "0.61", 1.9452 → "1.9", 0.0345 → "0.035". */
export function sig2(x: number): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  return Number(x.toPrecision(2)).toString()
}

export function km(x: number): string {
  if (!Number.isFinite(x)) return '—'
  return x < 10 ? x.toFixed(1) : Math.round(x).toString()
}

export function mag(x: number): string {
  return `M${x.toFixed(1)}`
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

/** Kilometres with miles alongside, e.g. "132 km · 82 mi". */
export function kmMi(x: number): string {
  if (!Number.isFinite(x)) return '—'
  return `${km(x)} km · ${km(x * 0.621371)} mi`
}
