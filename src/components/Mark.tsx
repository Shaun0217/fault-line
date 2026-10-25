/**
 * Provenance (DESIGN.md §4, amended 2026-09-13): a 7px mark after the value
 * rather than a table column. Hue carries the meaning and a shape carries it
 * again — filled dot, dash, ring, half — so the distinction survives
 * colour-vision deficiency and the greyscale printing the household plan needs.
 */
export type Provenance = 'published' | 'modeled' | 'proxy' | 'assumed'

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  published: 'Published',
  modeled: 'Modeled',
  proxy: 'Proxy',
  assumed: 'Assumed',
}

export const PROVENANCE_NOTE: Record<Provenance, string> = {
  published: 'measured, or taken straight from a published dataset',
  modeled: 'computed here from published equations',
  proxy: 'estimated from a correlation, not measured at this address',
  assumed: 'a default, or a value you supplied',
}

export const PROVENANCE_ORDER: Provenance[] = ['published', 'modeled', 'proxy', 'assumed']

export function Dot({ kind, className = '' }: { kind: Provenance; className?: string }) {
  const text = `${PROVENANCE_LABEL[kind]}: ${PROVENANCE_NOTE[kind]}`
  return <span className={`dot dot-${kind} ${className}`} role="img" aria-label={text} title={text} />
}

/** The key, shown once at the foot of a section rather than on every row. */
export function ProvenanceKey({ kinds = PROVENANCE_ORDER }: { kinds?: Provenance[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-fg-muted">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-2"><Dot kind={k} />{PROVENANCE_LABEL[k]}</span>
      ))}
    </div>
  )
}
