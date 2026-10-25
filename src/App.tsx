import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadDistrict, sampleSite, gridBounds, type DistrictGrid, type SiteProfile } from './lib/district'
import type { SiteClass } from './lib/siteclass'
import type { MapLayers } from './components/MapView'
import { intensityFromReferencePga, scenarioAtSite } from './lib/pipeline'
import { segmentById, rrupToSegmentKm, NMSZ_SEGMENTS, type SegmentId } from './lib/faults'
import { distanceToTraceKm } from './lib/distance'
import { fetchMappedReferenceValues, type MappedReferenceValues } from './lib/designmaps'
import { loadSeismicity, type Quake } from './lib/seismicity'
import { DEFAULT_HOUSEHOLD, type HouseholdInputs, type SiteContext } from './lib/plan'
import { loadLocalProfiles, upsertLocalProfile, deleteLocalProfile, supabaseEnabled, supabase, signInWithEmail, signOut, syncProfileToCloud, pullProfilesFromCloud, type SavedProfile } from './lib/storage'
import { useScenarioGrid } from './hooks/useScenarioGrid'
import { useOnline } from './hooks/useOnline'
import type { AppLocation, Tab } from './lib/types'
import type { RenderSpec } from './workers/scenario.worker'
import { MapView } from './components/MapView'
import { ScenarioBar } from './components/ScenarioBar'
import { Legend } from './components/Legend'
import { SiteReadout } from './components/SiteReadout'
import { ScenarioPanel } from './components/ScenarioPanel'
import { PlanPanel } from './components/PlanPanel'
import { MethodsPanel } from './components/MethodsPanel'
import { mag } from './lib/format'

const LS_LOC = 'faultline.location.v1'
const LS_HH = 'faultline.household.v1'
const LS_SC = 'faultline.siteclass.v1'
const LS_LAYERS = 'faultline.layers.v1'
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

interface UrlState { location: AppLocation | null; segmentId: SegmentId | null; magMw: number | null; epsilon: 0 | 1 | null }
/** Shareable state in the query string: ?lat=&lon=&seg=&m=&p=84 */
function readUrl(): UrlState {
  try {
    const q = new URLSearchParams(window.location.search)
    const lat = Number(q.get('lat')), lon = Number(q.get('lon'))
    const seg = q.get('seg') as SegmentId | null
    const m = Number(q.get('m'))
    return {
      location: Number.isFinite(lat) && Number.isFinite(lon) && q.has('lat') ? { lat, lon, label: q.get('label') || 'Shared location', source: 'saved' } : null,
      segmentId: seg && NMSZ_SEGMENTS.some((x) => x.id === seg) ? seg : null,
      magMw: Number.isFinite(m) && q.has('m') ? m : null,
      epsilon: q.get('p') === '84' ? 1 : q.has('p') ? 0 : null,
    }
  } catch { return { location: null, segmentId: null, magMw: null, epsilon: null } }
}
const urlState = typeof window !== 'undefined' ? readUrl() : { location: null, segmentId: null, magMw: null, epsilon: null }

function readLs<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? { ...fallback, ...(JSON.parse(v) as T) } : fallback } catch { return fallback }
}

export default function App() {
  const online = useOnline()
  const [grid, setGrid] = useState<DistrictGrid | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('site')
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }) }, [tab])
  const [location, setLocationState] = useState<AppLocation | null>(() => urlState.location ?? readLs<AppLocation | null>(LS_LOC, null))
  const [liveRef, setLiveRef] = useState<MappedReferenceValues | null>(null)
  const [segmentId, setSegmentId] = useState<SegmentId>(urlState.segmentId ?? 'reelfoot')
  const [magMw, setMagMw] = useState(urlState.magMw ?? 7.5)
  const [epsilon, setEpsilon] = useState<0 | 1>(urlState.epsilon ?? 0)
  const [installEvent, setInstallEvent] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)
  const [household, setHousehold] = useState<HouseholdInputs>(() => readLs(LS_HH, DEFAULT_HOUSEHOLD))
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [siteClassOverride, setSiteClassOverrideState] = useState<SiteClass | null>(() => { try { return (localStorage.getItem(LS_SC) as SiteClass | null) || null } catch { return null } })
  const [layers, setLayersState] = useState<MapLayers>(() => readLs<MapLayers>(LS_LAYERS, { quakes: true, liquefaction: false, district: true }))
  const setSiteClassOverride = (sc: SiteClass | null) => { setSiteClassOverrideState(sc); try { sc ? localStorage.setItem(LS_SC, sc) : localStorage.removeItem(LS_SC) } catch { /* ignore */ } }
  const setLayers = (l: MapLayers) => { setLayersState(l); try { localStorage.setItem(LS_LAYERS, JSON.stringify(l)) } catch { /* ignore */ } }
  const [saved, setSaved] = useState<SavedProfile[]>(() => loadLocalProfiles())
  const [cloud, setCloud] = useState({ enabled: supabaseEnabled(), signedIn: false, email: null as string | null, error: null as string | null })

  // ---- data ------------------------------------------------------------------------
  useEffect(() => { loadDistrict().then(setGrid).catch((e: Error) => setGridError(e.message)) }, [])
  useEffect(() => { loadSeismicity().then((r) => setQuakes(r.quakes)).catch(() => undefined) }, [])
  useEffect(() => { try { localStorage.setItem(LS_HH, JSON.stringify(household)) } catch { /* ignore */ } }, [household])
  // Keep the URL shareable (no street address ever appears in it: only coordinates and a label).
  useEffect(() => {
    try {
      const q = new URLSearchParams()
      if (location) { q.set('lat', location.lat.toFixed(4)); q.set('lon', location.lon.toFixed(4)); if (location.label && location.label !== 'Dropped pin') q.set('label', location.label) }
      q.set('seg', segmentId); q.set('m', magMw.toFixed(1)); if (epsilon) q.set('p', '84')
      window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`)
    } catch { /* ignore */ }
  }, [location, segmentId, magMw, epsilon])
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as Event & { prompt: () => Promise<void> }) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const setLocation = useCallback((loc: AppLocation | null) => {
    setLocationState(loc)
    setLiveRef(null)
    try { loc ? localStorage.setItem(LS_LOC, JSON.stringify(loc)) : localStorage.removeItem(LS_LOC) } catch { /* ignore */ }
    if (loc) setTab('site')
  }, [])

  // Live design-map refinement: an enhancement, never a dependency.
  useEffect(() => {
    if (!location || !online) return
    const ctl = new AbortController()
    fetchMappedReferenceValues(location.lat, location.lon, ctl.signal).then(setLiveRef).catch(() => undefined)
    return () => ctl.abort()
  }, [location, online])

  // Supabase session (optional).
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setCloud((c) => ({ ...c, signedIn: !!session, email: session?.user.email ?? null }))
      if (session) pullProfilesFromCloud().then((cloudList) => { if (cloudList.length) setSaved((local) => mergeProfiles(local, cloudList)) })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ---- derived ---------------------------------------------------------------------
  const sampled = useMemo(() => (grid && location ? sampleSite(grid, location.lat, location.lon) : null), [grid, location])
  // A user-supplied site class (from a geotechnical report) replaces the proxy and is marked "assumed".
  const profile = useMemo<SiteProfile | null>(() => (sampled && siteClassOverride ? { ...sampled, siteClass: siteClassOverride, siteClassSource: 'user' } : sampled), [sampled, siteClassOverride])
  const refPga = liveRef?.pgaG ?? (profile?.inGrid ? profile.pgaRefG : NaN)
  const readout = useMemo(() => (profile && Number.isFinite(refPga) ? intensityFromReferencePga(refPga, profile.siteClass) : null), [profile, refPga])
  const referenceSource: 'live' | 'grid' | 'none' = liveRef ? 'live' : profile?.inGrid ? 'grid' : 'none'

  const segment = segmentById(segmentId)
  const rjbKm = useMemo(() => (location ? distanceToTraceKm([location.lon, location.lat], segment.trace) : null), [location, segment])
  const scenario = useMemo(() => (profile && location ? scenarioAtSite(magMw, rrupToSegmentKm([location.lon, location.lat], segment), profile.siteClass, epsilon) : null), [profile, location, magMw, segment, epsilon])
  /** Same pipeline for any saved place, so places can be compared under the current scenario. */
  const evaluatePlace = useCallback((lat: number, lon: number, siteClass: SiteClass) => scenarioAtSite(magMw, rrupToSegmentKm([lon, lat], segment), siteClass, epsilon), [magMw, segment, epsilon])

  const render = useMemo<RenderSpec | null>(() => {
    if (!grid) return null
    const [w, s, e, n] = gridBounds(grid)
    const h = grid.stepDeg / 2
    const west = w - h, east = e + h, south = s - h, north = n + h
    const width = 480
    const height = Math.round((width * (mercY(north) - mercY(south))) / (((east - west) * Math.PI) / 180))
    return { west, south, east, north, width, height }
  }, [grid])
  const { raster, busy } = useScenarioGrid(grid, magMw, segmentId, epsilon, render)

  const siteContext: SiteContext | null = profile && scenario ? { mmiLevel: scenario.band.level, siteClass: profile.siteClass, siteClassIsProxy: profile.siteClassSource === 'slope-proxy', liquefactionProxy: profile.liquefactionProxy } : null

  // ---- actions -----------------------------------------------------------------------
  const onPick = useCallback((lat: number, lon: number) => setLocation({ lat, lon, label: 'Dropped pin', source: 'pin' }), [setLocation])

  function savePlace(label: string) {
    if (!location || !profile) return
    const p: SavedProfile = { id: crypto.randomUUID(), label, lat: location.lat, lon: location.lon, siteClass: profile.siteClass, vs30Ms: profile.vs30Ms, household, updatedAt: new Date().toISOString() }
    setSaved(upsertLocalProfile(p))
    if (cloud.signedIn) syncProfileToCloud(p).then((r) => r.error && setCloud((c) => ({ ...c, error: r.error ?? null })))
    setTab('plan')
  }
  function loadSaved(p: SavedProfile) {
    setHousehold(p.household)
    setLocation({ lat: p.lat, lon: p.lon, label: p.label, source: 'saved' })
  }
  async function signIn(email: string) {
    const r = await signInWithEmail(email)
    setCloud((c) => ({ ...c, error: r.error ?? 'Check your email for the sign-in link.' }))
  }

  const scenarioLabel = `${mag(magMw)} on the ${segment.shortName}${epsilon ? ' · 84th percentile' : ''}`

  // ---- render ------------------------------------------------------------------------
  const tabs: [Tab, string][] = [['site', 'Your ground'], ['scenario', 'Scenario'], ['plan', 'Plan'], ['methods', 'Methods']]
  return (
    <div className="h-full grid grid-rows-[38vh_1fr] wide:grid-rows-1 wide:grid-cols-[var(--panel-w)_1fr] print-flow">
      <aside className="order-2 wide:order-1 bg-bg wide:border-r border-border flex flex-col min-h-0 z-10 print-flow">
        <header className="px-4 py-3 flex items-center justify-between gap-4 border-b border-border no-print">
          <span className="wordmark text-fg">Fault Line</span>
          <span className="flex items-center gap-2 text-meta text-fg-secondary" role="status" aria-live="polite">
            <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full" style={{ background: online ? 'var(--text-muted)' : 'var(--src-assumed)' }} />
            {online ? 'Online' : 'Offline'}
          </span>
        </header>
        <nav className="px-4 border-b border-border no-print" aria-label="Sections">
          <div className="grid grid-cols-4">
            {tabs.map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
                className={`min-h-10 text-label border-b-2 -mb-px transition-colors duration-ui ${tab === t ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg'}`}>{l}</button>
            ))}
          </div>
        </nav>
        <div ref={panelRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 py-4 print-flow">
          {gridError && (
            <div className="border border-border p-3 mb-4 text-label">
              <div className="text-fg">Prebaked dataset missing</div>
              <p className="text-fg-secondary text-meta mt-1">/data/district.json could not be loaded ({gridError}). Run <span className="num">npm run prebake</span> and rebuild.</p>
            </div>
          )}
          {tab === 'site' && (
            <SiteReadout online={online} location={location} profile={profile} readout={readout} referenceSource={referenceSource}
              onLocate={setLocation} onClear={() => setLocation(null)} onSave={savePlace} onGoToScenario={() => setTab('scenario')}
              siteClassOverride={siteClassOverride} onSiteClassOverride={setSiteClassOverride} />
          )}
          {tab === 'scenario' && (
            <ScenarioPanel segmentId={segmentId} magMw={magMw} epsilon={epsilon} onChange={(n) => { if (n.segmentId) setSegmentId(n.segmentId); if (n.magMw != null) setMagMw(n.magMw); if (n.epsilon != null) setEpsilon(n.epsilon) }}
              location={location} result={scenario} rjbKm={rjbKm} busy={busy} maxMmi={raster?.maxMmi ?? null}
              siteClassProvenance={profile?.siteClassSource === 'slope-proxy' ? 'proxy' : 'assumed'} onGoToSite={() => setTab('site')} grid={grid} />
          )}
          {tab === 'plan' && (
            <PlanPanel household={household} onChange={setHousehold} site={siteContext} location={location} scenarioLabel={scenarioLabel}
              saved={saved} cloud={cloud} onLoadSaved={loadSaved} onDeleteSaved={(id) => setSaved(deleteLocalProfile(id))}
              onSignIn={signIn} onSignOut={() => signOut()} onGoToSite={() => setTab('site')} evaluatePlace={evaluatePlace} />
          )}
          {tab === 'methods' && <MethodsPanel onInstall={installEvent ? () => { installEvent.prompt().finally(() => setInstallEvent(null)) } : undefined} />}
        </div>
      </aside>

      <main className="order-1 wide:order-2 min-h-0 grid grid-rows-[auto_1fr] no-print">
        <ScenarioBar title={`${mag(magMw)} · ${segment.name.split(' (')[0]}`} level={epsilon ? '84th percentile (+1σ)' : 'median ground motion'} busy={busy} />
        <div className="relative min-h-0 bg-bg">
          {grid ? (
            <MapView grid={grid} raster={raster} location={location} selectedSegment={segmentId} quakes={quakes} layers={layers} onLayers={setLayers}
              onPick={onPick} onSelectSegment={(id) => { setSegmentId(id); setTab('scenario') }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-meta text-fg-muted">{gridError ? 'Dataset unavailable' : 'Loading dataset'}</div>
          )}
          <div className="absolute left-3 bottom-12 wide:left-auto wide:right-3 wide:bottom-3 pointer-events-none"><Legend showLiq={layers.liquefaction} /></div>
        </div>
      </main>
    </div>
  )
}

function mergeProfiles(local: SavedProfile[], remote: SavedProfile[]): SavedProfile[] {
  const byId = new Map<string, SavedProfile>()
  for (const p of [...remote, ...local]) { const cur = byId.get(p.id); if (!cur || cur.updatedAt < p.updatedAt) byId.set(p.id, p) }
  return [...byId.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}
