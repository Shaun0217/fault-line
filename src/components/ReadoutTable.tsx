import { Dot, ProvenanceKey, type Provenance } from './Mark'

export interface ReadoutRow {
  label: string
  value: string
  unit?: string
  provenance: Provenance
  note?: string
  /** Emphasised row: the value that answers the question. */
  strong?: boolean
}

/**
 * Label left, value right, a 7px provenance mark after the value. No source
 * column and no header row: the mark says where the number came from, and one
 * key at the foot of the table says what the marks mean.
 */
export function ReadoutTable({ rows, caption, showKey = true }: { rows: ReadoutRow[]; caption?: string; showKey?: boolean }) {
  const kinds = [...new Set(rows.map((r) => r.provenance))]
  return (
    <>
      <table className="data">
        {caption && <caption className="sr-only">{caption}</caption>}
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pr-4">
                <div className="text-label text-fg">{r.label}</div>
                {r.note && <div className="text-meta text-fg-muted mt-1">{r.note}</div>}
              </td>
              <td className="v">
                <span className="text-value font-medium text-fg">{r.value}</span>
                {r.unit && <span className="text-meta text-fg-secondary ml-1">{r.unit}</span>}
                <Dot kind={r.provenance} className="ml-2" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showKey && <div className="mt-3"><ProvenanceKey kinds={kinds} /></div>}
    </>
  )
}
