/**
 * colors.ts — the intensity ramp, the only saturated color in the interface
 * (DESIGN.md §1–§2).
 *
 * Ten bands for MMI I–X+, derived from matplotlib "magma" (van der Walt &
 * Smith 2015, https://bids.github.io/colormap/) truncated to avoid pure black
 * and the yellow extreme. Perceptually uniform, colourblind-safe (yellow → red →
 * magenta → purple; never red against green) and monotonic in lightness, so the
 * ordering survives grayscale printing. Hex values are the DESIGN.md tokens; the
 * CSS custom properties in src/styles/tokens.css carry the same values.
 * Band I is transparent: "not felt" is paper with a hairline outline.
 * Every band is labelled with its numeral wherever it is drawn.
 */

export const MMI_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const

/** Bands I..X. Index 0 (band I) has no fill. */
export const MMI_RAMP: readonly (string | null)[] = [
  null, '#FDDCA6', '#FCC08B', '#F9A17A', '#F2836E', '#E4636A', '#CE4870', '#B03579', '#8A2A80', '#5E1878',
]

export function mmiColor(level: number): string {
  const i = Math.min(10, Math.max(1, Math.round(level))) - 1
  return MMI_RAMP[i] ?? 'transparent'
}

/** Ink on the light bands, paper on the dark ones (contrast ≥ 4.5:1 either way). */
export function mmiTextColor(level: number): string {
  return Math.round(level) >= 6 ? '#FAF8F3' : '#1A1A18'
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
