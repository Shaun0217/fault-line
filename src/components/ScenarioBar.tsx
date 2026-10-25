/** Slim context bar across the top of the map: what the sheet shows, nothing else. */
export function ScenarioBar({ title, level, busy }: { title: string; level: string; busy: boolean }) {
  return (
    <div className="h-10 flex items-center gap-3 px-4 border-b border-border bg-surface no-print">
      <span className="text-label text-fg truncate">{title}</span>
      <span className="text-meta text-fg-secondary truncate">{level}</span>
      <span className="ml-auto text-meta text-fg-muted" aria-live="polite">{busy ? 'computing' : ''}</span>
    </div>
  )
}
