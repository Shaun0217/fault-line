import { useState, type ReactNode, createElement } from 'react'

/**
 * No list shows more than `limit` rows without asking. Every item stays in the
 * DOM; the extras carry a class the print stylesheet un-hides, so a printed
 * plan is never missing a line.
 */
export function ShowMore<T>({ items, limit = 5, as = 'div', itemClassName = '', render, keyOf }: {
  items: T[]
  limit?: number
  as?: 'div' | 'li'
  itemClassName?: string
  render: (item: T) => ReactNode
  keyOf: (item: T) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {items.map((it, i) =>
        createElement(as, { key: keyOf(it), className: `${itemClassName} ${!open && i >= limit ? 'more-hidden' : ''}` }, render(it)),
      )}
      {items.length > limit &&
        createElement(as, { key: '__more', className: 'show-more-btn' },
          <button onClick={() => setOpen((v) => !v)} className="link text-meta mt-2">
            {open ? 'Show less' : `Show ${items.length - limit} more`}
          </button>,
        )}
    </>
  )
}
