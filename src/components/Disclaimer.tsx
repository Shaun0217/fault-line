/** Two lines. The long version lives in the Methods tab (DESIGN.md, density rules). */
export function Disclaimer({ print = false }: { print?: boolean }) {
  return (
    <p className={`text-meta text-fg-muted ${print ? 'print-disclaimer' : ''}`}>
      Modeled medians: ground motion carries about a factor-of-two spread and intensity about one band. Conditional on an event of the stated size on the stated source; no one can predict when one will occur.
    </p>
  )
}
