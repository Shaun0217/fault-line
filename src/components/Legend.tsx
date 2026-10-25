import { useState } from 'react'
import { MMI_RAMP, MMI_ROMAN, mmiTextColor } from '../lib/colors'
import { PROVENANCE_LABEL, PROVENANCE_NOTE, Dot, type Provenance } from './Mark'

const KEYS: Provenance[] = ['published', 'modeled', 'proxy', 'assumed']

/**
 * The ramp and three anchors. Everything that explains rather than decodes —
 * the provenance key and the grid-cell note — sits behind the info button.
 */
export function Legend({ showLiq = false }: { showLiq?: boolean }) {
  const [info, setInfo] = useState(false)
  return (
    <div className="bg-surface border border-border w-[min(76vw,324px)] pointer-events-auto">
      <div className="flex items-center gap-2 px-3 pt-2">
        <span className="text-meta text-fg-secondary">Modeled intensity</span>
        <button onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="About this legend"
          className="ml-auto icon-btn w-6 h-6 text-meta">i</button>
      </div>
      <div className="px-3 pb-3 pt-2">
        <div className="grid grid-cols-10 gap-px bg-border">
          {MMI_RAMP.map((c, i) => (
            <div key={i} className="h-5 wide:h-6 flex items-center justify-center num"
              style={{ background: c ?? 'var(--surface-2)', color: c ? mmiTextColor(i + 1) : 'var(--text-muted)', fontSize: 10, letterSpacing: '-0.03em' }}
              title={`MMI ${MMI_ROMAN[i]}`}>
              {MMI_ROMAN[i]}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-meta text-fg-secondary mt-1">
          <span>weak</span><span>strong</span><span>extreme</span>
        </div>
        {info && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {KEYS.map((k) => (
              <div key={k} className="flex items-start gap-2 text-meta text-fg-secondary">
                <Dot kind={k} className="mt-1" /><span><span className="text-fg">{PROVENANCE_LABEL[k]}</span> — {PROVENANCE_NOTE[k]}</span>
              </div>
            ))}
            <p className="text-meta text-fg-muted">Cell edges are real: site class is a step function on a 5 km grid. The overlay fades where the modeled area ends.</p>
            {showLiq && <p className="text-meta text-fg-muted">Hatched areas are the liquefaction screen, a proxy from site class only.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
