import { useMemo, useState } from 'react'
import { buildHouseholdPlan, planToText, type HouseholdInputs, type SiteContext, type SupplyDays, type HomeType } from '../lib/plan'
import type { AppLocation } from '../lib/types'
import type { SavedProfile } from '../lib/storage'
import { Dot } from './Mark'
import { ShowMore } from './ShowMore'
import { Disclaimer } from './Disclaimer'
import type { SiteClass } from '../lib/siteclass'
import type { ScenarioSiteResult } from '../lib/pipeline'
import { SectionHead } from './SectionHead'

interface Props {
  household: HouseholdInputs
  onChange: (h: HouseholdInputs) => void
  site: SiteContext | null
  location: AppLocation | null
  scenarioLabel: string
  saved: SavedProfile[]
  cloud: { enabled: boolean; signedIn: boolean; email: string | null; error: string | null }
  onLoadSaved: (p: SavedProfile) => void
  onDeleteSaved: (id: string) => void
  onSignIn: (email: string) => void
  onSignOut: () => void
  onGoToSite: () => void
  evaluatePlace: (lat: number, lon: number, siteClass: SiteClass) => ScenarioSiteResult
}

export function PlanPanel({ household, onChange, site, location, scenarioLabel, saved, cloud, onLoadSaved, onDeleteSaved, onSignIn, onSignOut, onGoToSite, evaluatePlace }: Props) {
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')
  const ctx: SiteContext = site ?? { mmiLevel: 6, siteClass: 'D', siteClassIsProxy: true, liquefactionProxy: 'unknown' }
  const plan = useMemo(() => buildHouseholdPlan(household, ctx), [household, ctx])
  const set = <K extends keyof HouseholdInputs>(k: K, v: HouseholdInputs[K]) => onChange({ ...household, [k]: v })

  async function copy() {
    try { await navigator.clipboard.writeText(planToText(plan, location?.label ?? 'not set')); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* ignore */ }
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-border-strong pb-3">
        <div className="text-meta text-fg-secondary">Household plan · deterministic, no AI</div>
        <h2 className="text-h2 font-semibold mt-1">A plan that works with the power out</h2>
        <p className="text-label text-fg-secondary mt-1">
          {site && location
            ? <>Sized for {scenarioLabel} at {location.label}, modeled intensity <span className="num">{roman(site.mmiLevel)}</span>.</>
            : <>Intensity defaults to VI until you <button onClick={onGoToSite} className="link">set an address</button>. <Dot kind="assumed" /></>}
        </p>
      </div>

      <section className="space-y-6 no-print">
        <div>
          <SectionHead title="Household" meta={`${plan.people} ${plan.people === 1 ? 'person' : 'people'}`} />
          <div className="border-t border-border-strong">
            <Counter label="Adults" value={household.adults} onChange={(v) => set('adults', v)} />
            <Counter label="Children" value={household.children} onChange={(v) => set('children', v)} />
            <Counter label="Infants" value={household.infants} onChange={(v) => set('infants', v)} />
            <Counter label="Pets" value={household.pets} onChange={(v) => set('pets', v)} />
          </div>
        </div>
        <div>
          <div className="text-meta text-fg-secondary mb-2">Supply horizon</div>
          <div className="seg grid-cols-3">
            {([3, 7, 14] as SupplyDays[]).map((d) => (
              <button key={d} onClick={() => set('supplyDays', d)} aria-pressed={household.supplyDays === d}><span className="num">{d}</span> days</button>
            ))}
          </div>
          <p className="text-label text-fg-secondary mt-2">Recommended here: <span className="num">{plan.recommendedDays}</span> days. {plan.recommendedDaysReason}</p>
        </div>
        <div>
          <div className="text-meta text-fg-secondary mb-2">Home</div>
          <div className="seg grid-cols-3">
            {([['house', 'House'], ['apartment', 'Apartment'], ['mobile', 'Manufactured']] as [HomeType, string][]).map(([v, l]) => (
              <button key={v} onClick={() => set('homeType', v)} aria-pressed={household.homeType === v}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Check label="Natural gas service" checked={household.hasNaturalGas} onChange={(v) => set('hasNaturalGas', v)} />
          <Check label="Daily prescriptions" checked={household.dailyMedications} onChange={(v) => set('dailyMedications', v)} />
          <Check label="Powered medical device" checked={household.powerDependentMedical} onChange={(v) => set('powerDependentMedical', v)} />
          <Check label="Mobility assistance" checked={household.mobilityAssistance} onChange={(v) => set('mobilityAssistance', v)} />
        </div>
      </section>

      <div className="space-y-8">
        {plan.sections.map((s) => (
          <section key={s.id}>
            <SectionHead title={s.title} />
            <p className="text-label text-fg-secondary -mt-1">{s.summary}</p>
            {s.quantities.length > 0 && (
              <table className="data text-body mt-3">
                <thead><tr className="text-meta text-fg-secondary"><th scope="col">Supply</th><th scope="col" className="v">Quantity</th></tr></thead>
                <tbody>
                  {s.quantities.map((q) => (
                    <tr key={q.label}>
                      <td className="pr-4">
                        <div>{q.label} {q.assumption && <Dot kind="assumed" />}</div>
                        <div className="num text-label text-fg-secondary">{q.arithmetic}</div>
                        <div className="text-label text-fg-secondary">{q.source}{q.assumption ? ` · ${q.assumption}` : ''}</div>
                      </td>
                      <td className="v"><span className="text-value font-medium">{formatQty(q.value)}</span> <span className="text-label text-fg-secondary">{q.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <ul className="mt-3 border-t border-border">
              <ShowMore
                items={s.items}
                as="li"
                itemClassName="py-2 border-b border-border text-label"
                keyOf={(it) => it.text}
                render={(it) => <>{it.text} <span className="num text-meta text-fg-muted">{it.source}</span></>}
              />
            </ul>
          </section>
        ))}
      </div>

      <div className="flex gap-2 no-print">
        <button onClick={copy} className="btn flex-1">{copied ? 'Copied' : 'Copy as text'}</button>
        <button onClick={() => window.print()} className="btn-quiet flex-1">Print</button>
      </div>

      <section className="no-print border-t border-border-strong pt-4">
        <SectionHead title="Saved households" meta={cloud.enabled && cloud.signedIn ? `synced · ${cloud.email}` : 'this device'} />
        {saved.length === 0 ? (
          <p className="text-label text-fg-secondary mt-2">Nothing saved yet. Save home, school and work from the “Your ground” tab to compare them under the current scenario.</p>
        ) : (
          <table className="data text-body">
            <caption className="text-meta text-fg-secondary text-left pb-1" style={{ captionSide: 'top' }}>Modeled intensity at each place for {scenarioLabel}</caption>
            <thead><tr className="text-meta text-fg-secondary"><th scope="col">Place</th><th scope="col" className="v">Class</th><th scope="col" className="v">MMI</th><th scope="col" className="src"><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {saved.map((p) => (
                <tr key={p.id}>
                  <td className="pr-4">
                    <button onClick={() => onLoadSaved(p)} className="link text-left">{p.label}</button>
                    <div className="text-label text-fg-secondary">{p.household.adults + p.household.children + p.household.infants} people</div>
                  </td>
                  <td className="v">{p.siteClass}</td>
                  <td className="v font-semibold">{evaluatePlace(p.lat, p.lon, p.siteClass).band.roman}</td>
                  <td className="src"><button onClick={() => onDeleteSaved(p.id)} className="link text-label">remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {cloud.enabled && (
          <div className="mt-4">
            {cloud.signedIn ? (
              <button onClick={onSignOut} className="link text-label">Sign out of sync</button>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); onSignIn(email) }}>
                <label htmlFor="sync-email" className="text-meta text-fg-secondary block mb-2">Email for a sign-in link</label>
                <div className="flex gap-2"><input id="sync-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" /><button className="btn-quiet">Sync</button></div>
              </form>
            )}
            {cloud.error && <p className="text-label mt-2">{cloud.error}</p>}
          </div>
        )}
      </section>

      <Disclaimer print />
    </div>
  )
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1">
      <span className="text-body">{label}</span>
      <div className="flex items-center">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="btn-quiet min-w-12 px-0" aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
        <span className="num text-value w-12 text-center" aria-live="polite">{value}</span>
        <button onClick={() => onChange(Math.min(20, value + 1))} className="btn-quiet min-w-12 px-0" aria-label={`More ${label.toLowerCase()}`}>+</button>
      </div>
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 min-h-12 cursor-pointer text-body">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-accent" style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  )
}

function formatQty(v: number): string { return Number.isInteger(v) ? String(v) : v.toFixed(1) }
function roman(level: number): string { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(10, Math.max(1, level))] }
