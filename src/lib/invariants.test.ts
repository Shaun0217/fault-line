import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Repository-level checks for CLAUDE.md's hard invariants. They read the source
 * tree, so a violation anywhere in /src fails the suite.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}
const SRC = new URL('..', import.meta.url).pathname
const files = walk(SRC)
const read = (f: string) => readFileSync(f, 'utf8')

describe('Hard Invariant 1 — amplification lives in exactly one file', () => {
  // Rows of ASCE 7-16 Tables 11.8-1 / 11.4-1 as they would appear in any transcription.
  const signatures = [/1\.6,\s*1\.4,\s*1\.3,\s*1\.2,\s*1\.1/, /2\.4,\s*1\.9,\s*1\.6,\s*1\.4/, /1\.6,\s*1\.4,\s*1\.2,\s*1\.1,\s*1\.0/, /2\.4,\s*1\.7,\s*1\.3/, /F_PGA_TABLE|F_A_TABLE/]
  it('site coefficient tables appear only in siteamp.ts', () => {
    const offenders = files.filter((f) => !f.endsWith('siteamp.ts') && signatures.some((re) => re.test(read(f))))
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([])
  })
  it('the worker and the components never import gmpe/siteamp directly; they use pipeline.ts', () => {
    const offenders = files
      .filter((f) => /\/(workers|components)\//.test(f))
      .filter((f) => /from '\.\.\/lib\/(siteamp|gmpe)'/.test(read(f)) && !/import (type )?\{[^}]*\b(GMPE_NAME|GMPE_VALIDITY|GMPE_SIGMA_LOG10|REFERENCE_CONVERSION_FACTOR|DESIGN_MAP_REFERENCE_VS30_MS|DESIGN_MAP_EDITION|RockMotion)\b/.test(read(f)))
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([])
  })
  it('no GLSL shader in the tree carries coefficients', () => {
    expect(files.some((f) => /\.(glsl|frag|vert)$/.test(f))).toBe(false)
  })
})

describe('Hard Invariant 2 — never imply prediction', () => {
  const forbidden = /\b(overdue|will strike|is likely to (occur|happen|strike)|imminent|next big one|due for (an|the) earthquake|countdown)\b/i
  it('no UI copy or identifier suggests an earthquake is coming', () => {
    const offenders = files.filter((f) => forbidden.test(read(f)))
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([])
  })
})

describe('Hard Invariant 4 — citations in code', () => {
  it('every physics module names its published source in the header comment', () => {
    for (const name of ['gmpe.ts', 'gmice.ts', 'siteamp.ts', 'siteclass.ts', 'distance.ts', 'faults.ts', 'vs30proxy.ts', 'plan.ts']) {
      const head = read(join(SRC, 'lib', name)).slice(0, 4000)
      expect(head, name).toMatch(/\(19\d\d|20\d\d\)|ASCE|Ready\.gov|IUGG/)
    }
  })
})
