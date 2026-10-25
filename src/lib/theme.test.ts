import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { THEME, THEME_VAR } from './theme'
import { MMI_RAMP } from './colors'

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
const cssVar = (name: string): string | null => {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return m ? m[1].trim().toLowerCase() : null
}

/** Relative luminance and contrast ratio, WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

describe('theme constants mirror tokens.css', () => {
  it('every MapLibre colour equals its CSS custom property', () => {
    for (const key of Object.keys(THEME) as Array<keyof typeof THEME>) {
      expect(cssVar(THEME_VAR[key]), THEME_VAR[key]).toBe(THEME[key].toLowerCase())
    }
  })
  it('the MMI ramp in colors.ts equals the ramp in tokens.css', () => {
    for (let i = 1; i < MMI_RAMP.length; i++) {
      expect(cssVar(`--mmi-${i + 1}`), `--mmi-${i + 1}`).toBe(MMI_RAMP[i]!.toLowerCase())
    }
  })
})

describe('contrast (DESIGN.md §7: body text ≥ 4.5:1)', () => {
  it('primary and secondary text clear 4.5:1 on both surfaces', () => {
    for (const bg of [THEME.bg, THEME.surface]) {
      expect(contrast(THEME.text, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(THEME.textSecondary, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('accent clears 4.5:1 as text on the page background', () => {
    expect(contrast(THEME.accent, THEME.bg)).toBeGreaterThanOrEqual(4.5)
  })
  it('muted text is decoration only and is not required to pass', () => {
    expect(contrast(THEME.textMuted, THEME.bg)).toBeLessThan(4.5)
  })
})
