/** Sentence case, 12px secondary. The only tracked all-caps is the wordmark. */
export function SectionHead({ title, meta, as: Tag = 'h3' }: { title: string; meta?: string; as?: 'h2' | 'h3' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-2">
      <Tag className="text-meta text-fg-secondary">{title}</Tag>
      {meta && <span className="text-meta text-fg-muted whitespace-nowrap">{meta}</span>}
    </div>
  )
}
