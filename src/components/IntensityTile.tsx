import { mmiColor, mmiTextColor } from '../lib/colors'
import type { SiteIntensity } from '../lib/pipeline'
import { Dot } from './Mark'

/**
 * The answer: the largest element in the app. One intensity, in plain language,
 * with one line of what that means. The chip colour comes from the same ramp
 * function the map uses.
 */
export function IntensityTile({ result, caption }: { result: SiteIntensity; caption?: string }) {
  const { band, range } = result
  const same = range.low.level === range.high.level
  return (
    <div>
      <div className="flex items-stretch gap-4">
        <div className="w-24 shrink-0 flex flex-col items-center justify-center py-4"
          style={{ background: band.level === 1 ? 'var(--surface-2)' : mmiColor(band.level), color: band.level === 1 ? 'var(--text)' : mmiTextColor(band.level) }}>
          <div className="num text-display font-medium">{band.roman}</div>
          <div className="text-meta mt-1" style={{ color: 'inherit', opacity: 0.8 }}>MMI</div>
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="text-h1 text-fg">{band.shaking} shaking</div>
          <p className="text-label text-fg-secondary mt-1">{band.consequence}</p>
          <p className="text-meta text-fg-muted mt-2 flex items-center gap-2">
            <Dot kind="modeled" /> plausible range {same ? band.roman : `${range.low.roman}–${range.high.roman}`}
          </p>
        </div>
      </div>
      {caption && <p className="text-meta text-fg-muted mt-3">{caption}</p>}
    </div>
  )
}
