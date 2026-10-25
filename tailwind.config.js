/** @type {import('tailwindcss').Config} */
// Every colour resolves to a custom property in src/styles/tokens.css. The
// default palette, radii and shadows are replaced rather than extended, so an
// off-system value is unreachable rather than merely discouraged.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--bg)',
      surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
      border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
      fg: { DEFAULT: 'var(--text)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)' },
      accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)' },
      src: { published: 'var(--src-published)', proxy: 'var(--src-proxy)', assumed: 'var(--src-assumed)' },
      mmi: {
        1: 'var(--mmi-1)', 2: 'var(--mmi-2)', 3: 'var(--mmi-3)', 4: 'var(--mmi-4)', 5: 'var(--mmi-5)',
        6: 'var(--mmi-6)', 7: 'var(--mmi-7)', 8: 'var(--mmi-8)', 9: 'var(--mmi-9)', 10: 'var(--mmi-10)',
      },
    },
    borderRadius: { none: '0', DEFAULT: '2px', full: '9999px' },
    boxShadow: { none: 'none' },
    // 4px base. 10 = 40px exists only for the scenario bar height.
    spacing: { 0: '0', px: '1px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px', 24: '96px' },
    fontFamily: { ui: ['Inter', 'system-ui', 'sans-serif'], data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'] },
    // Values are visibly larger than their labels: label 13px, value 20px.
    fontSize: {
      display: ['2.75rem', { lineHeight: '1' }],
      h1: ['1.5rem', { lineHeight: '1.25' }],
      h2: ['1.125rem', { lineHeight: '1.3' }],
      value: ['1.25rem', { lineHeight: '1.3' }],
      body: ['0.9375rem', { lineHeight: '1.55' }],
      label: ['0.8125rem', { lineHeight: '1.35' }],
      meta: ['0.75rem', { lineHeight: '1.35' }],
    },
    fontWeight: { normal: '400', medium: '500', semibold: '600' },
    extend: {
      screens: { wide: '900px' },
      transitionDuration: { ui: '120ms', value: '200ms' },
      transitionTimingFunction: { value: 'cubic-bezier(0.2, 0, 0.2, 1)' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
}
