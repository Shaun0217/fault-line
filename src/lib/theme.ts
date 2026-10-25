/**
 * theme.ts — the colours MapLibre needs as literals.
 *
 * MapLibre paint properties are evaluated outside CSS, so they cannot read the
 * custom properties in src/styles/tokens.css. These constants mirror that file
 * exactly and theme.test.ts parses the stylesheet to prove it. Change a colour
 * in tokens.css and the test tells you to change it here too.
 */
export const THEME = {
  bg: '#0E1114',
  surface: '#171B20',
  surface2: '#1F252C',
  border: '#262C33',
  borderStrong: '#333B44',
  text: '#ECEFF2',
  textSecondary: '#8B949E',
  textMuted: '#616B76',
  accent: '#E8843C',
  accentHover: '#F09553',
  srcPublished: '#5B8C6E',
  srcProxy: '#C99A3B',
  srcAssumed: '#B0563F',
  srcModeled: '#8B949E',
} as const

/** CSS custom property name for each constant, for the consistency test. */
export const THEME_VAR: Record<keyof typeof THEME, string> = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  accent: '--accent',
  accentHover: '--accent-hover',
  srcPublished: '--src-published',
  srcProxy: '--src-proxy',
  srcAssumed: '--src-assumed',
  srcModeled: '--src-modeled',
}
